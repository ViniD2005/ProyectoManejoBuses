/*
  Registra una notificación para un usuario.
  "db" puede ser el pool o el cliente de una transacción (los dos tienen .query),
  así la notificación se guarda junto con la operación que la origina.
*/
async function notificar(db, usuarioId, titulo, mensaje) {
  await db.query(
    'INSERT INTO notificacion (usuario_id, titulo, mensaje) VALUES ($1, $2, $3)',
    [usuarioId, titulo, mensaje]
  )
}

// Notifica a todos los oficinistas activos de una cooperativa
async function notificarOficinistas(db, cooperativaId, titulo, mensaje) {
  await db.query(
    `INSERT INTO notificacion (usuario_id, titulo, mensaje)
     SELECT u.id, $2, $3
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE r.nombre = 'oficinista' AND u.cooperativa_id = $1 AND u.activo`,
    [cooperativaId, titulo, mensaje]
  )
}

module.exports = { notificar, notificarOficinistas }
