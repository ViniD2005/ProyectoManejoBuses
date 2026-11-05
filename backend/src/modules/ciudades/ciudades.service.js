// MÓDULO DE REFERENCIA: copien esta estructura para sus CRUD.
//   ciudades.routes.js      -> URLs, autenticación y roles
//   ciudades.controller.js  -> lee req, llama al servicio y responde
//   ciudades.service.js     -> validaciones, reglas de negocio y SQL
const { pool } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

function validar({ nombre, provincia }) {
  const errores = {}
  if (!nombre?.trim()) errores.nombre = 'El nombre es obligatorio'
  if (!provincia?.trim()) errores.provincia = 'La provincia es obligatoria'
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos', 400, errores)
}

async function listar() {
  const { rows } = await pool.query('SELECT id, nombre, provincia FROM ciudad ORDER BY nombre')
  return rows
}

async function obtener(id) {
  const { rows } = await pool.query('SELECT id, nombre, provincia FROM ciudad WHERE id = $1', [id])
  if (!rows[0]) throw errorHttp('Ciudad no encontrada', 404)
  return rows[0]
}

async function crear(datos) {
  validar(datos)
  const { rows } = await pool.query(
    'INSERT INTO ciudad (nombre, provincia) VALUES ($1, $2) RETURNING id, nombre, provincia',
    [datos.nombre.trim(), datos.provincia.trim()]
  )
  return rows[0]
}

async function actualizar(id, datos) {
  validar(datos)
  const { rows } = await pool.query(
    'UPDATE ciudad SET nombre = $1, provincia = $2 WHERE id = $3 RETURNING id, nombre, provincia',
    [datos.nombre.trim(), datos.provincia.trim(), id]
  )
  if (!rows[0]) throw errorHttp('Ciudad no encontrada', 404)
  return rows[0]
}

async function eliminar(id) {
  const { rowCount } = await pool.query('DELETE FROM ciudad WHERE id = $1', [id])
  if (!rowCount) throw errorHttp('Ciudad no encontrada', 404)
}

module.exports = { listar, obtener, crear, actualizar, eliminar }
