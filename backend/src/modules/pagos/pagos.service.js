const { pool, transaccion } = require('../../config/db')
const { notificar } = require('../../utils/notificar')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const ESTADOS = ['pendiente', 'en_revision', 'aprobado', 'rechazado']

/*
  Compras de los viajes de la cooperativa del oficinista, filtradas por estado de pago.
  Incluye los pasajeros y sus descuentos para que el oficinista verifique, por ejemplo,
  el carné de discapacidad.
*/
async function listar(cooperativaId, estado = 'en_revision') {
  if (!ESTADOS.includes(estado)) throw errorHttp('Estado de pago no válido', 400)

  const { rows } = await pool.query(
    `SELECT c.id, c.total, c.estado_pago, c.creado_en, c.comprobante_url,
            c.referencia_bancaria, c.motivo_rechazo, c.validado_en,
            mp.nombre AS metodo_pago,
            u.nombres || ' ' || u.apellidos AS cliente, u.email AS cliente_email, u.cedula AS cliente_cedula,
            MIN(v.fecha)::text AS fecha_viaje,
            MIN(f.hora_salida)::text AS hora_salida,
            MIN(cs.nombre) AS origen,
            MIN(cb.nombre) AS destino,
            json_agg(json_build_object(
              'numero_asiento', a.numero,
              'pasajero_nombre', b.pasajero_nombre,
              'pasajero_cedula', b.pasajero_cedula,
              'descuento', td.nombre,
              'precio_final', b.precio_final,
              'estado', b.estado
            ) ORDER BY a.numero) AS boletos
       FROM compra c
       JOIN metodo_pago mp ON mp.id = c.metodo_pago_id
       JOIN usuario u ON u.id = c.cliente_id
       JOIN boleto b ON b.compra_id = c.id
       JOIN asiento a ON a.id = b.asiento_id
       LEFT JOIN tipo_descuento td ON td.id = b.tipo_descuento_id
       JOIN viaje v ON v.id = b.viaje_id
       JOIN frecuencia f ON f.id = v.frecuencia_id
       JOIN parada ps ON ps.frecuencia_id = f.id AND ps.orden = b.orden_subida
       JOIN parada pb ON pb.frecuencia_id = f.id AND pb.orden = b.orden_bajada
       JOIN ciudad cs ON cs.id = ps.ciudad_id
       JOIN ciudad cb ON cb.id = pb.ciudad_id
      WHERE f.cooperativa_id = $1 AND c.estado_pago = $2
      GROUP BY c.id, mp.nombre, u.nombres, u.apellidos, u.email, u.cedula
      ORDER BY c.creado_en`,
    [cooperativaId, estado]
  )
  return rows
}

/*
  Aprobar:  la compra pasa a 'aprobado' y sus boletos a 'emitido'.
  Rechazar: la compra pasa a 'rechazado' con un motivo y sus boletos a 'anulado',
            lo que libera los asientos para otros clientes.
  Solo se validan compras 'en_revision' de viajes de la cooperativa del oficinista.
*/
async function validar(oficinista, compraId, { aprobado, motivo }) {
  if (typeof aprobado !== 'boolean') throw errorHttp('Indica si el pago se aprueba o se rechaza', 400)
  if (!aprobado && !motivo?.trim()) {
    throw errorHttp('Escribe el motivo del rechazo', 400, { motivo: 'El motivo es obligatorio al rechazar' })
  }

  return transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `SELECT c.id, c.estado_pago, c.cliente_id
         FROM compra c
        WHERE c.id = $1
          AND EXISTS (
            SELECT 1 FROM boleto b
              JOIN viaje v ON v.id = b.viaje_id
              JOIN frecuencia f ON f.id = v.frecuencia_id
             WHERE b.compra_id = c.id AND f.cooperativa_id = $2
          )
        FOR UPDATE`,
      [compraId, oficinista.cooperativa_id]
    )
    const compra = rows[0]
    if (!compra) throw errorHttp('Compra no encontrada en tu cooperativa', 404)
    if (compra.estado_pago !== 'en_revision') {
      throw errorHttp(`Solo se validan compras en revisión; esta está "${compra.estado_pago}"`, 409)
    }

    const nuevoEstado = aprobado ? 'aprobado' : 'rechazado'
    const actualizada = await cliente.query(
      `UPDATE compra
          SET estado_pago = $1, validado_por = $2, validado_en = NOW(), motivo_rechazo = $3
        WHERE id = $4
        RETURNING id, estado_pago, validado_en, motivo_rechazo`,
      [nuevoEstado, oficinista.id, aprobado ? null : motivo.trim(), compraId]
    )
    await cliente.query(
      'UPDATE boleto SET estado = $1 WHERE compra_id = $2',
      [aprobado ? 'emitido' : 'anulado', compraId]
    )
    // Notificación al cliente (CC-11)
    if (aprobado) {
      await notificar(cliente, compra.cliente_id, `Pago aprobado — compra N.º ${compraId}`,
        'Tus boletos están emitidos. Descárgalos con su código QR desde Mis boletos.')
    } else {
      await notificar(cliente, compra.cliente_id, `Pago rechazado — compra N.º ${compraId}`,
        `Motivo: ${motivo.trim()}. Los asientos quedaron liberados; puedes realizar una nueva compra.`)
    }

    return actualizada.rows[0]
  })
}

module.exports = { listar, validar }
