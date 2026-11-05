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

async function crearCompra({ usuarioId, frecuenciaId, asientos, metodoPago }) {
  const client = await db.getClient()
  
  try {
    await client.query('BEGIN')

    const ocupados = await verificarDisponibilidadAsientos(frecuenciaId, asientos.map(a => a.asientoId))
    if (ocupados.length > 0) {
      const err = new Error('Uno o mas asientos ya se encuentran reservados u ocupados')
      err.status = 409
      throw err
    }

    const total = asientos.reduce((sum, a) => sum + Number(a.precio), 0)

    const resCompra = await client.query(
      `INSERT INTO compras (usuario_id, frecuencia_id, total, metodo_pago, estado)
       VALUES ($1, $2, $3, $4, 'completada')
       RETURNING id, fecha_compra, total, estado`,
      [usuarioId, frecuenciaId, total, metodoPago]
    )
    const compra = resCompra.rows[0]

    for (const asiento of asientos) {
      await client.query(
        `INSERT INTO pasajes (compra_id, frecuencia_id, asiento_id, precio, pasajero_nombre, pasajero_identificacion, estado)
         VALUES ($1, $2, $3, $4, $5, $6, 'emitido')`,
        [compra.id, frecuenciaId, asiento.asientoId, asiento.precio, asiento.nombre, asiento.identificacion]
      )
    }

    await client.query('COMMIT')
    return compra
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  verificarDisponibilidadAsientos,
  crearCompra
}