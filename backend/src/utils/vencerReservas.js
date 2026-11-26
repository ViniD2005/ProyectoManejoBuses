const { pool } = require('../config/db')

/*
  GC-37 (emergencia) - Reservas que nunca se pagan.
  Problema en producción: una compra en línea queda "pendiente" hasta que el cliente
  sube el comprobante. Si nunca lo sube, los asientos quedan bloqueados para siempre
  y el bus sale con asientos vacíos que nadie más pudo comprar.

  Regla: una reserva en línea SIN comprobante (estado_pago = 'pendiente') vence
    · a los RESERVA_MINUTOS minutos de creada (30 por defecto), o
    · cuando el bus ya salió de la parada donde sube el pasajero,
  lo que ocurra primero. Al vencer:
    · los boletos pasan a "anulado" (el asiento queda libre otra vez),
    · la compra pasa a "rechazado" con el motivo "Reserva vencida…",
    · el cliente recibe una notificación.
  Las compras con comprobante en revisión NO se tocan: las decide el oficinista.
*/
const MINUTOS = Math.max(5, Number(process.env.RESERVA_MINUTOS) || 30)
const CADA_MS = 60 * 1000 // revisa cada minuto
const MOTIVO = 'Reserva vencida: no se subió el comprobante a tiempo'

async function vencerReservas() {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query(
      `UPDATE compra c
          SET estado_pago = 'rechazado', motivo_rechazo = $2
        WHERE c.estado_pago = 'pendiente'
          AND c.vendido_por IS NULL
          AND (
            c.creado_en < NOW() - make_interval(mins => $1::int)
            OR EXISTS (
              SELECT 1 FROM boleto b
                JOIN viaje v ON v.id = b.viaje_id
                JOIN frecuencia f ON f.id = v.frecuencia_id
                JOIN parada p ON p.frecuencia_id = f.id AND p.orden = b.orden_subida
               WHERE b.compra_id = c.id
                 AND (v.fecha + f.hora_salida + make_interval(mins => p.minutos_desde_salida))
                     <= (NOW() AT TIME ZONE 'America/Guayaquil')
            )
          )
        RETURNING c.id, c.cliente_id, c.total`,
      [MINUTOS, MOTIVO]
    )
    if (rows.length) {
      const ids = rows.map((r) => r.id)
      await cliente.query("UPDATE boleto SET estado = 'anulado' WHERE compra_id = ANY($1::int[]) AND estado = 'reservado'", [ids])
      for (const r of rows) {
        await cliente.query(
          'INSERT INTO notificacion (usuario_id, titulo, mensaje) VALUES ($1, $2, $3)',
          [r.cliente_id, `Reserva N.º ${r.id} vencida`,
            `No recibimos el comprobante de pago a tiempo y los asientos se liberaron. Si aún quieres viajar, haz una nueva compra.`]
        )
      }
    }
    await cliente.query('COMMIT')
    return rows.length
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
}

// Arranca la revisión periódica (se llama una vez desde server.js)
function iniciarVencimientoDeReservas() {
  const revisar = () => vencerReservas()
    .then((n) => { if (n) console.log(`[reservas] ${n} reserva(s) vencida(s) liberadas`) })
    .catch((err) => console.error('[reservas] No se pudieron revisar las reservas vencidas:', err.message))
  revisar()
  return setInterval(revisar, CADA_MS)
}

module.exports = { vencerReservas, iniciarVencimientoDeReservas, MINUTOS, MOTIVO }
