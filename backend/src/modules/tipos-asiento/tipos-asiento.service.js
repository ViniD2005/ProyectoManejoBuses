const { pool } = require('../../config/db')
const { agregar, validarTexto } = require('../../utils/validaciones')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

function validar({ nombre, factor_precio }) {
  // CC-21: nombre y factor dentro de rangos razonables
  const errores = {}
  agregar(errores, 'nombre', validarTexto(nombre, 'el nombre del tipo de asiento', { min: 3, max: 40 }))
  const factor = Number(factor_precio)
  if (!Number.isFinite(factor) || factor < 0.5 || factor > 3) {
    errores.factor_precio = 'El factor de precio debe estar entre 0.50 y 3.00 (por ejemplo 1.00 o 1.35)'
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos del tipo de asiento', 400, errores)
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
