const { pool, transaccion } = require('../../config/db')

function errorHttp(mensaje, status) {
  const error = new Error(mensaje)
  error.status = status
  return error
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

// Viajes de hoy de la cooperativa, con boletos emitidos y pasajeros que ya abordaron
async function viajesDeHoy(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.fecha::text AS fecha, f.hora_salida::text AS hora_salida,
            co.nombre AS origen, cd.nombre AS destino, b.numero_disco, b.placa,
            COUNT(bo.id) FILTER (WHERE bo.estado IN ('emitido', 'usado'))::int AS boletos_emitidos,
            COUNT(bo.id) FILTER (WHERE bo.estado = 'usado')::int AS abordados
       FROM viaje v
       JOIN frecuencia f ON f.id = v.frecuencia_id
       JOIN ciudad co ON co.id = f.ciudad_origen_id
       JOIN ciudad cd ON cd.id = f.ciudad_destino_id
       JOIN bus b ON b.id = v.bus_id
       LEFT JOIN boleto bo ON bo.viaje_id = v.id
      WHERE f.cooperativa_id = $1 AND v.fecha = $2
      GROUP BY v.id, f.hora_salida, co.nombre, cd.nombre, b.numero_disco, b.placa
      ORDER BY f.hora_salida`,
    [cooperativaId, hoyEcuador()]
  )
  return rows
}

/*
  Registra el abordaje de un pasajero escaneando el código QR de su boleto.
  Reglas: el boleto debe existir, ser de un viaje de la cooperativa, de hoy,
  estar emitido (pago aprobado) y no haber sido usado. Si se indica viaje_id,
  el boleto debe ser de ese viaje (el bus en el que está el chofer).
*/
async function registrarAbordaje(personal, { codigo, viaje_id: viajeId }) {
  const limpio = String(codigo || '').trim()
  if (!FORMATO_UUID.test(limpio)) throw errorHttp('El código escaneado no es un boleto válido', 400)

  return transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `SELECT bo.id, bo.estado, bo.pasajero_nombre, bo.pasajero_cedula, bo.viaje_id,
              a.numero AS numero_asiento, v.fecha::text AS fecha, f.cooperativa_id,
              cs.nombre AS sube_en, cb.nombre AS baja_en,
              (SELECT ap.fecha FROM acceso_pasajero ap WHERE ap.boleto_id = bo.id) AS abordo_en
         FROM boleto bo
         JOIN asiento a ON a.id = bo.asiento_id
         JOIN viaje v ON v.id = bo.viaje_id
         JOIN frecuencia f ON f.id = v.frecuencia_id
         JOIN parada ps ON ps.frecuencia_id = f.id AND ps.orden = bo.orden_subida
         JOIN parada pb ON pb.frecuencia_id = f.id AND pb.orden = bo.orden_bajada
         JOIN ciudad cs ON cs.id = ps.ciudad_id
         JOIN ciudad cb ON cb.id = pb.ciudad_id
        WHERE bo.codigo = $1
        FOR UPDATE OF bo`,
      [limpio]
    )
    const boleto = rows[0]
    if (!boleto) throw errorHttp('Boleto no encontrado', 404)
    if (boleto.cooperativa_id !== personal.cooperativa_id) throw errorHttp('El boleto es de otra cooperativa', 403)
    if (viajeId && Number(viajeId) !== boleto.viaje_id) throw errorHttp('El boleto es de otro viaje o de otro bus', 409)
    if (boleto.fecha !== hoyEcuador()) throw errorHttp(`El boleto es para el ${boleto.fecha}, no para hoy`, 409)
    if (boleto.estado === 'usado') {
      const hora = new Date(boleto.abordo_en).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
      throw errorHttp(`Este boleto ya se usó: el pasajero abordó a las ${hora}`, 409)
    }
    if (boleto.estado === 'anulado') throw errorHttp('El boleto está anulado (pago rechazado)', 409)
    if (boleto.estado !== 'emitido') throw errorHttp('El pago de este boleto todavía no está aprobado', 409)

    await cliente.query('UPDATE boleto SET estado = $1 WHERE id = $2', ['usado', boleto.id])
    await cliente.query('INSERT INTO acceso_pasajero (boleto_id, registrado_por) VALUES ($1, $2)', [boleto.id, personal.id])

    return {
      mensaje: 'Abordaje registrado',
      pasajero: boleto.pasajero_nombre,
      cedula: boleto.pasajero_cedula,
      asiento: boleto.numero_asiento,
      tramo: `${boleto.sube_en} → ${boleto.baja_en}`,
    }
  })
}

module.exports = { viajesDeHoy, registrarAbordaje }
