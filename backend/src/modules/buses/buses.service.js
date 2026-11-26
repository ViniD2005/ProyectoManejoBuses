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
  anio_fabricacion, foto_url, pisos, activo,
  numero_chasis, numero_motor, servicios, vence_matricula::text AS vence_matricula, observaciones`

// GC-20: servicios a bordo que se pueden marcar (clave → nombre para el cliente)
const SERVICIOS = {
  wifi: 'Wi-Fi',
  bano: 'Baño',
  aire: 'Aire acondicionado',
  tv: 'TV / pantallas',
  usb: 'Cargador USB',
  reclinables: 'Asientos reclinables',
  bodega: 'Bodega para equipaje',
  accesible: 'Acceso para silla de ruedas',
}
// VIN: 17 caracteres, letras y números sin I, O ni Q (norma ISO 3779)
const VIN = /^[A-HJ-NPR-Z0-9]{17}$/
const FECHA = /^\d{4}-\d{2}-\d{2}$/

// Normaliza los campos opcionales de la ficha (vacío → null)
function fichaOpcional(datos) {
  const texto = (v) => {
    const t = String(v ?? '').trim().replace(/\s+/g, ' ')
    return t || null
  }
  return {
    numero_chasis: texto(datos.numero_chasis)?.toUpperCase() || null,
    numero_motor: texto(datos.numero_motor)?.toUpperCase() || null,
    servicios: [...new Set(Array.isArray(datos.servicios) ? datos.servicios : [])],
    vence_matricula: texto(datos.vence_matricula),
    observaciones: texto(datos.observaciones),
  }
}

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

  // GC-20: ficha completa (todos opcionales, pero si se llenan deben ser válidos)
  const ficha = fichaOpcional(datos)
  if (ficha.numero_chasis && !VIN.test(ficha.numero_chasis)) {
    errores.numero_chasis = 'El número de chasis (VIN) tiene 17 letras y números, sin I, O ni Q'
  }
  if (ficha.numero_motor && !/^[A-Z0-9-]{5,30}$/.test(ficha.numero_motor)) {
    errores.numero_motor = 'El número de motor debe tener de 5 a 30 letras, números o guiones'
  }
  const desconocido = ficha.servicios.find((x) => !SERVICIOS[x])
  if (desconocido) errores.servicios = 'Elige los servicios de la lista'
  if (ficha.vence_matricula) {
    const fecha = new Date(`${ficha.vence_matricula}T12:00:00`)
    if (!FECHA.test(ficha.vence_matricula) || Number.isNaN(fecha.getTime())) errores.vence_matricula = 'Escribe una fecha válida'
    else if (fecha.getFullYear() < 2000 || fecha.getFullYear() > new Date().getFullYear() + 2) {
      errores.vence_matricula = 'La matrícula se renueva cada año: revisa la fecha de vencimiento'
    }
  }
  if (ficha.observaciones && ficha.observaciones.length > 300) errores.observaciones = 'Las observaciones pueden tener hasta 300 caracteres'
  if (esNuevo) {
    const cantidad = Number(datos.cantidad_asientos)
    if (!Number.isInteger(cantidad) || cantidad < 10 || cantidad > 80) {
      errores.cantidad_asientos = 'La cantidad de asientos debe estar entre 10 y 80'
    }
    if (!datos.tipo_asiento_id) errores.tipo_asiento_id = 'Elige el tipo de asiento inicial. Si no tienes ninguno, créalo primero en «Tipos de asiento».'
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados del bus', 400, errores)
}

// GC-20: el número de chasis no se repite entre buses (de ninguna cooperativa)
async function revisarChasis(numeroChasis, idActual = null) {
  if (!numeroChasis) return
  const { rows } = await pool.query(
    'SELECT 1 FROM bus WHERE UPPER(numero_chasis) = UPPER($1) AND id <> COALESCE($2, 0)',
    [numeroChasis, idActual]
  )
  if (rows[0]) {
    throw errorHttp('Revisa los datos marcados del bus', 409, { numero_chasis: 'Ya existe un bus registrado con este número de chasis' })
  }
}

// Buses de la cooperativa del usuario, con su número de asientos
async function listar(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.numero_disco, b.placa, b.marca_chasis, b.marca_carroceria,
            b.anio_fabricacion, b.foto_url, b.pisos, b.activo,
            b.numero_chasis, b.numero_motor, b.servicios, b.vence_matricula::text AS vence_matricula, b.observaciones,
            COUNT(a.id)::int AS total_asientos,
            COUNT(a.id) FILTER (WHERE ta.factor_precio > 1)::int AS asientos_especiales,
            (SELECT COUNT(*)::int FROM viaje v WHERE v.bus_id = b.id AND v.fecha >= CURRENT_DATE) AS viajes_programados
       FROM bus b
       LEFT JOIN asiento a ON a.bus_id = b.id
       LEFT JOIN tipo_asiento ta ON ta.id = a.tipo_asiento_id
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
  const ficha = fichaOpcional(datos)
  await revisarChasis(ficha.numero_chasis)

  return transaccion(async (cliente) => {
    // El tipo de asiento debe pertenecer a la misma cooperativa
    const tipo = await cliente.query(
      'SELECT id FROM tipo_asiento WHERE id = $1 AND cooperativa_id = $2',
      [datos.tipo_asiento_id, cooperativaId]
    )
    if (!tipo.rows[0]) throw errorHttp('El tipo de asiento no pertenece a tu cooperativa', 400)

    const { rows } = await cliente.query(
      `INSERT INTO bus (cooperativa_id, numero_disco, placa, marca_chasis, marca_carroceria, anio_fabricacion, pisos,
                        numero_chasis, numero_motor, servicios, vence_matricula, observaciones)
       VALUES ($1, $2, UPPER($3), $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${CAMPOS}`,
      [
        cooperativaId,
        datos.numero_disco.toString().trim(),
        datos.placa.trim(),
        datos.marca_chasis.trim(),
        datos.marca_carroceria.trim(),
        datos.anio_fabricacion || null,
        Number(datos.pisos),
        ficha.numero_chasis,
        ficha.numero_motor,
        ficha.servicios,
        ficha.vence_matricula,
        ficha.observaciones,
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
  const ficha = fichaOpcional(datos)
  await revisarChasis(ficha.numero_chasis, Number(id))
  const { rows } = await pool.query(
    `UPDATE bus
        SET numero_disco = $1, placa = UPPER($2), marca_chasis = $3,
            marca_carroceria = $4, anio_fabricacion = $5, pisos = $6,
            numero_chasis = $9, numero_motor = $10, servicios = $11, vence_matricula = $12, observaciones = $13
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
      ficha.numero_chasis,
      ficha.numero_motor,
      ficha.servicios,
      ficha.vence_matricula,
      ficha.observaciones,
    ]
  )
  if (!rows[0]) throw errorHttp('Bus no encontrado', 404)
  return rows[0]
}

async function cambiarEstado(cooperativaId, id, activo) {
  // GC-20: un bus con boletos vendidos en viajes futuros no se puede sacar de circulación
  if (!activo) {
    const { rows: vendidos } = await pool.query(
      `SELECT COUNT(DISTINCT v.id)::int AS viajes
         FROM viaje v JOIN boleto bo ON bo.viaje_id = v.id AND bo.estado <> 'anulado'
         JOIN bus b ON b.id = v.bus_id AND b.cooperativa_id = $2
        WHERE v.bus_id = $1 AND v.fecha >= CURRENT_DATE`,
      [id, cooperativaId]
    )
    if (vendidos[0].viajes > 0) {
      throw errorHttp(`Este bus tiene ${vendidos[0].viajes} viaje(s) próximos con boletos vendidos. Cámbialo por otro bus en la hoja de ruta antes de desactivarlo.`, 409)
    }
  }
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

// GC-20: lista de servicios para el formulario
const servicios = () => Object.entries(SERVICIOS).map(([clave, nombre]) => ({ clave, nombre }))

module.exports = { listar, crear, actualizar, cambiarEstado, actualizarFoto, servicios }
