const { pool } = require('../../config/db')

function errorHttp(mensaje, status) {
  const error = new Error(mensaje)
  error.status = status
  return error
}

// Últimas 20 notificaciones del usuario y cuántas no ha leído
async function listar(usuarioId) {
  const { rows } = await pool.query(
    `SELECT id, titulo, mensaje, leida, creado_en
       FROM notificacion
      WHERE usuario_id = $1
      ORDER BY creado_en DESC, id DESC
      LIMIT 20`,
    [usuarioId]
  )
  const conteo = await pool.query(
    'SELECT COUNT(*)::int AS no_leidas FROM notificacion WHERE usuario_id = $1 AND NOT leida',
    [usuarioId]
  )
  return { no_leidas: conteo.rows[0].no_leidas, notificaciones: rows }
}

async function marcarLeida(usuarioId, id) {
  const { rowCount } = await pool.query(
    'UPDATE notificacion SET leida = TRUE WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId]
  )
  if (!rowCount) throw errorHttp('Notificación no encontrada', 404)
}

async function marcarTodasLeidas(usuarioId) {
  await pool.query('UPDATE notificacion SET leida = TRUE WHERE usuario_id = $1 AND NOT leida', [usuarioId])
}

module.exports = { listar, marcarLeida, marcarTodasLeidas }
