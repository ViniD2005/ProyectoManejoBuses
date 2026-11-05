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

async function obtenerComprasPorUsuario(usuarioId) {
  const query = `
    SELECT c.id, c.fecha_compra, c.total, c.estado, c.metodo_pago,
           f.origen, f.destino, f.fecha_salida, f.hora_salida
    FROM compras c
    JOIN frecuencias f ON c.frecuencia_id = f.id
    WHERE c.usuario_id = $1
    ORDER BY c.fecha_compra DESC
  `
  const result = await db.query(query, [usuarioId])
  return result.rows
}

async function obtenerCompraPorId(compraId, usuarioId) {
  const queryCompra = `
    SELECT c.*, f.origen, f.destino, f.fecha_salida, f.hora_salida
    FROM compras c
    JOIN frecuencias f ON c.frecuencia_id = f.id
    WHERE c.id = $1 AND c.usuario_id = $2
  `
  const resCompra = await db.query(queryCompra, [compraId, usuarioId])
  if (resCompra.rows.length === 0) return null

  const queryPasajes = `
    SELECT p.id, p.asiento_id, p.precio, p.pasajero_nombre, p.pasajero_identificacion, p.estado
    FROM pasajes p
    WHERE p.compra_id = $1
  `
  const resPasajes = await db.query(queryPasajes, [compraId])

  return {
    ...resCompra.rows[0],
    pasajes: resPasajes.rows
  }
}

async function cancelarCompra(compraId, usuarioId) {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')

    const res = await client.query(
      `UPDATE compras SET estado = 'cancelada' WHERE id = $1 AND usuario_id = $2 RETURNING id`,
      [compraId, usuarioId]
    )

    if (res.rows.length === 0) {
      const err = new Error('Compra no encontrada o no pertenece al usuario')
      err.status = 404
      throw err
    }

    await client.query(
      `UPDATE pasajes SET estado = 'cancelado' WHERE compra_id = $1`,
      [compraId]
    )

    await client.query('COMMIT')
    return { mensaje: 'Compra cancelada exitosamente' }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = {
  verificarDisponibilidadAsientos,
  crearCompra,
  obtenerComprasPorUsuario,
  obtenerCompraPorId,
  cancelarCompra
}