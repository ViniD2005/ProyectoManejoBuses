const { pool } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

function validar({ nombre, factor_precio }) {
  const errores = {}
  if (!nombre?.trim()) errores.nombre = 'El nombre es obligatorio'
  const factor = Number(factor_precio)
  if (!Number.isFinite(factor) || factor <= 0 || factor > 9.99) {
    errores.factor_precio = 'El factor debe ser un número mayor a 0 (ej. 1.00 o 1.35)'
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos', 400, errores)
}

// Todas las consultas filtran por la cooperativa del usuario que inició sesión
async function listar(cooperativaId) {
  const { rows } = await pool.query(
    'SELECT id, nombre, factor_precio FROM tipo_asiento WHERE cooperativa_id = $1 ORDER BY factor_precio, nombre',
    [cooperativaId]
  )
  return rows
}

async function crear(cooperativaId, datos) {
  validar(datos)
  const { rows } = await pool.query(
    `INSERT INTO tipo_asiento (cooperativa_id, nombre, factor_precio)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, factor_precio`,
    [cooperativaId, datos.nombre.trim(), Number(datos.factor_precio)]
  )
  return rows[0]
}

async function actualizar(cooperativaId, id, datos) {
  validar(datos)
  const { rows } = await pool.query(
    `UPDATE tipo_asiento SET nombre = $1, factor_precio = $2
      WHERE id = $3 AND cooperativa_id = $4
      RETURNING id, nombre, factor_precio`,
    [datos.nombre.trim(), Number(datos.factor_precio), id, cooperativaId]
  )
  if (!rows[0]) throw errorHttp('Tipo de asiento no encontrado', 404)
  return rows[0]
}

async function eliminar(cooperativaId, id) {
  // Si algún asiento usa este tipo, PostgreSQL lo impide (error 23503 -> 409)
  const { rowCount } = await pool.query(
    'DELETE FROM tipo_asiento WHERE id = $1 AND cooperativa_id = $2',
    [id, cooperativaId]
  )
  if (!rowCount) throw errorHttp('Tipo de asiento no encontrado', 404)
}

module.exports = { listar, crear, actualizar, eliminar }
