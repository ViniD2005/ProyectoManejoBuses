const db = require('../../config/db')

async function verificarDisponibilidadAsientos(frecuenciaId, asientosIds) {
  const query = `
    SELECT asiento_id 
    FROM pasajes 
    WHERE frecuencia_id = $1 
      AND asiento_id = ANY($2::int[]) 
      AND estado != 'cancelado'
  `
  const result = await db.query(query, [frecuenciaId, asientosIds])
  return result.rows
}

module.exports = {
  verificarDisponibilidadAsientos
}