// MÓDULO DE REFERENCIA: copien esta estructura para sus CRUD.
//   ciudades.routes.js      -> URLs, autenticación y roles
//   ciudades.controller.js  -> lee req, llama al servicio y responde
//   ciudades.service.js     -> validaciones, reglas de negocio y SQL
//
// GC-13: la ciudad es el CANTÓN y pertenece a una provincia.
// En las listas se muestra como "Provincia - Cantón" (campo etiqueta).
const { pool } = require('../../config/db')
const { agregar, limpiar } = require('../../utils/validaciones')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

// Letras (con tildes), números, espacios, punto y guion: "24 de Mayo", "Coronel Marcelino Maridueña"
const NOMBRE_CANTON = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9][A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9 .'-]*$/

const CAMPOS = `c.id, c.nombre, c.provincia_id, p.nombre AS provincia, c.activa,
                p.nombre || ' - ' || c.nombre AS etiqueta`

async function validar(datos, idActual = null) {
  const errores = {}
  const nombre = limpiar(datos.nombre)
  if (!nombre) errores.nombre = 'Escribe el nombre del cantón'
  else if (nombre.length < 2) errores.nombre = 'El nombre del cantón debe tener al menos 2 caracteres'
  else if (nombre.length > 100) errores.nombre = 'El nombre del cantón no puede superar los 100 caracteres'
  else if (!NOMBRE_CANTON.test(nombre)) errores.nombre = 'El nombre solo puede contener letras, números y espacios'

  const provinciaId = Number(datos.provincia_id)
  let provincia = null
  if (!provinciaId) errores.provincia_id = 'Elige la provincia del cantón'
  else {
    const { rows } = await pool.query('SELECT id, nombre FROM provincia WHERE id = $1', [provinciaId])
    provincia = rows[0]
    if (!provincia) errores.provincia_id = 'La provincia elegida no existe'
  }

  if (!errores.nombre && provincia) {
    const { rows } = await pool.query(
      'SELECT id FROM ciudad WHERE LOWER(nombre) = LOWER($1) AND provincia_id = $2 AND ($3::int IS NULL OR id <> $3)',
      [nombre, provinciaId, idActual]
    )
    agregar(errores, 'nombre', rows[0] && `${provincia.nombre} ya tiene un cantón llamado ${nombre}`)
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados del cantón', 400, errores)
  return { nombre, provincia }
}

/*
  Lista pública (buscador de viajes, frecuencias): solo cantones activos.
  ?texto=  filtra por nombre del cantón o de la provincia
  ?provincia_id=  solo los de una provincia
*/
async function listar({ texto, provincia_id: provinciaId } = {}) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS}
       FROM ciudad c JOIN provincia p ON p.id = c.provincia_id
      WHERE c.activa AND p.activa
        AND ($1::text IS NULL OR c.nombre ILIKE '%' || $1 || '%' OR p.nombre ILIKE '%' || $1 || '%')
        AND ($2::int IS NULL OR c.provincia_id = $2)
      ORDER BY p.nombre, c.nombre`,
    [limpiar(texto) || null, Number(provinciaId) || null]
  )
  return rows
}

// Lista completa para el administrador, con cuántas frecuencias usan cada cantón
async function listarGestion() {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS},
            (SELECT COUNT(*) FROM parada pa WHERE pa.ciudad_id = c.id)::int AS en_uso
       FROM ciudad c JOIN provincia p ON p.id = c.provincia_id
      ORDER BY p.nombre, c.nombre`
  )
  return rows
}

async function obtener(id) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM ciudad c JOIN provincia p ON p.id = c.provincia_id WHERE c.id = $1`, [id])
  if (!rows[0]) throw errorHttp('Cantón no encontrado', 404)
  return rows[0]
}

async function crear(datos) {
  const { nombre, provincia } = await validar(datos)
  const { rows } = await pool.query(
    'INSERT INTO ciudad (nombre, provincia, provincia_id) VALUES ($1, $2, $3) RETURNING id',
    [nombre, provincia.nombre, provincia.id]
  )
  return obtener(rows[0].id)
}

async function actualizar(id, datos) {
  await obtener(id)
  const { nombre, provincia } = await validar(datos, Number(id))
  await pool.query('UPDATE ciudad SET nombre = $1, provincia = $2, provincia_id = $3 WHERE id = $4', [nombre, provincia.nombre, provincia.id, id])
  return obtener(id)
}

// Desactivar en lugar de borrar: un cantón usado en frecuencias no se puede eliminar
async function cambiarEstado(id, activa) {
  await obtener(id)
  await pool.query('UPDATE ciudad SET activa = $1 WHERE id = $2', [Boolean(activa), id])
  return obtener(id)
}

async function eliminar(id) {
  const ciudad = await obtener(id)
  const { rows } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM parada WHERE ciudad_id = $1) + (SELECT COUNT(*) FROM frecuencia
              WHERE ciudad_origen_id = $1 OR ciudad_destino_id = $1) AS usos`,
    [id]
  )
  if (Number(rows[0].usos) > 0) {
    throw errorHttp(`${ciudad.nombre} se usa en frecuencias registradas. Desactívalo en lugar de eliminarlo.`, 409)
  }
  await pool.query('DELETE FROM ciudad WHERE id = $1', [id])
}

module.exports = { listar, listarGestion, obtener, crear, actualizar, cambiarEstado, eliminar }
