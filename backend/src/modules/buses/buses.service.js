const fs = require('fs')
const { pool, transaccion } = require('../../config/db')
const { agregar, validarPlaca } = require('../../utils/validaciones')
const marcas = require('../marcas/marcas.service')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const CAMPOS = `id, numero_disco, placa, marca_chasis, marca_carroceria,
  anio_fabricacion, foto_url, pisos, activo`

async function validar(datos, esNuevo) {
  // CC-21: reglas completas del bus
  const errores = {}
  const disco = String(datos.numero_disco ?? '').trim()
  if (!disco) errores.numero_disco = 'El número de disco es obligatorio'
  else if (!/^\d{1,4}$/.test(disco)) errores.numero_disco = 'El número de disco debe tener de 1 a 4 números'
  agregar(errores, 'placa', validarPlaca(datos.placa))
  // GC-13: las marcas se eligen del catálogo que administra el admin
  if (!String(datos.marca_chasis ?? '').trim()) errores.marca_chasis = 'Elige la marca del chasis'
  else if (!(await marcas.existeActiva('chasis', datos.marca_chasis))) errores.marca_chasis = 'Elige una marca de chasis de la lista'
  if (!String(datos.marca_carroceria ?? '').trim()) errores.marca_carroceria = 'Elige la marca de la carrocería'
  else if (!(await marcas.existeActiva('carroceria', datos.marca_carroceria))) errores.marca_carroceria = 'Elige una marca de carrocería de la lista'
  if (datos.anio_fabricacion !== undefined && datos.anio_fabricacion !== null && datos.anio_fabricacion !== '') {
    const anio = Number(datos.anio_fabricacion)
    const maximo = new Date().getFullYear() + 1
    if (!Number.isInteger(anio) || anio < 1990 || anio > maximo) {
      errores.anio_fabricacion = `El año de fabricación debe estar entre 1990 y ${maximo}`
    }
  }
  if (![1, 2].includes(Number(datos.pisos))) errores.pisos = 'El bus debe tener 1 o 2 pisos'
  if (esNuevo) {
    const cantidad = Number(datos.cantidad_asientos)
    if (!Number.isInteger(cantidad) || cantidad < 10 || cantidad > 80) {
      errores.cantidad_asientos = 'La cantidad de asientos debe estar entre 10 y 80'
    }
    if (!datos.tipo_asiento_id) errores.tipo_asiento_id = 'Elige el tipo de asiento por defecto'
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados del bus', 400, errores)
}

// Buses de la cooperativa del usuario, con su número de asientos
async function listar(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.numero_disco, b.placa, b.marca_chasis, b.marca_carroceria,
            b.anio_fabricacion, b.foto_url, b.pisos, b.activo,
            COUNT(a.id)::int AS total_asientos
       FROM bus b
       LEFT JOIN asiento a ON a.bus_id = b.id
      WHERE b.cooperativa_id = $1
      GROUP BY b.id
      ORDER BY b.numero_disco`,
    [cooperativaId]
  )
  return rows
}

// Crea el bus y genera sus asientos (1..N) en la misma transacción
async function crear(cooperativaId, datos) {
  await validar(datos, true)

  return transaccion(async (cliente) => {
    // El tipo de asiento debe pertenecer a la misma cooperativa
    const tipo = await cliente.query(
      'SELECT id FROM tipo_asiento WHERE id = $1 AND cooperativa_id = $2',
      [datos.tipo_asiento_id, cooperativaId]
    )
    if (!tipo.rows[0]) throw errorHttp('El tipo de asiento no pertenece a tu cooperativa', 400)

    const { rows } = await cliente.query(
      `INSERT INTO bus (cooperativa_id, numero_disco, placa, marca_chasis, marca_carroceria, anio_fabricacion, pisos)
       VALUES ($1, $2, UPPER($3), $4, $5, $6, $7)
       RETURNING ${CAMPOS}`,
      [
        cooperativaId,
        datos.numero_disco.toString().trim(),
        datos.placa.trim(),
        datos.marca_chasis.trim(),
        datos.marca_carroceria.trim(),
        datos.anio_fabricacion || null,
        Number(datos.pisos),
      ]
    )
    const bus = rows[0]

    // Asientos numerados del 1 a N. En buses de 2 pisos, la primera mitad va en el piso 1.
    const cantidad = Number(datos.cantidad_asientos)
    const enPisoUno = bus.pisos === 2 ? Math.ceil(cantidad / 2) : cantidad
    await cliente.query(
      `INSERT INTO asiento (bus_id, tipo_asiento_id, numero, piso)
       SELECT $1, $2, n, CASE WHEN n <= $4 THEN 1 ELSE 2 END
         FROM generate_series(1, $3::int) AS n`,
      [bus.id, datos.tipo_asiento_id, cantidad, enPisoUno]
    )

    return { ...bus, total_asientos: cantidad }
  })
}

async function actualizar(cooperativaId, id, datos) {
  await validar(datos, false)
  const { rows } = await pool.query(
    `UPDATE bus
        SET numero_disco = $1, placa = UPPER($2), marca_chasis = $3,
            marca_carroceria = $4, anio_fabricacion = $5, pisos = $6
      WHERE id = $7 AND cooperativa_id = $8
      RETURNING ${CAMPOS}`,
    [
      datos.numero_disco.toString().trim(),
      datos.placa.trim(),
      datos.marca_chasis.trim(),
      datos.marca_carroceria.trim(),
      datos.anio_fabricacion || null,
      Number(datos.pisos),
      id,
      cooperativaId,
    ]
  )
  if (!rows[0]) throw errorHttp('Bus no encontrado', 404)
  return rows[0]
}

async function cambiarEstado(cooperativaId, id, activo) {
  const { rows } = await pool.query(
    `UPDATE bus SET activo = $1 WHERE id = $2 AND cooperativa_id = $3 RETURNING ${CAMPOS}`,
    [Boolean(activo), id, cooperativaId]
  )
  if (!rows[0]) throw errorHttp('Bus no encontrado', 404)
  return rows[0]
}

// CC-17: guarda la foto del bus (solo buses de la cooperativa del usuario)
async function actualizarFoto(cooperativaId, id, archivo) {
  if (!archivo) throw errorHttp('Adjunta una imagen JPG, PNG o WEBP', 400)
  const url = `/uploads/buses/${archivo.filename}`
  const { rows } = await pool.query(
    `UPDATE bus SET foto_url = $1 WHERE id = $2 AND cooperativa_id = $3 RETURNING ${CAMPOS}`,
    [url, id, cooperativaId]
  )
  if (!rows[0]) {
    fs.unlink(archivo.path, () => {})
    throw errorHttp('Bus no encontrado', 404)
  }
  return rows[0]
}

module.exports = { listar, crear, actualizar, cambiarEstado, actualizarFoto }
