const { pool, transaccion } = require('../../config/db')
const compras = require('../compras/compras.service')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-34 - Sección del chofer (rol personal_bus).
    1. Ve los viajes de hoy de su cooperativa.
    2. INICIA el viaje (desde 60 minutos antes de la salida). Desde ese momento
       el viaje queda "en curso", a su nombre, y los clientes ya no lo pueden comprar en línea.
    3. Mientras está en curso: valida los boletos (código QR) y vende boletos a bordo.
    4. FINALIZA el viaje con observaciones opcionales.
    5. Consulta su historial de viajes con pasajeros y lo recaudado a bordo.
  Un chofer solo puede tener un viaje en curso a la vez.
*/
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MINUTOS_ANTES = 60
const FECHA = /^\d{4}-\d{2}-\d{2}$/

const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

// Datos comunes de un viaje para el chofer
const SELECT_VIAJE = `
  SELECT v.id, v.fecha::text AS fecha, v.estado, v.chofer_id, v.bus_id,
         v.iniciado_en, v.finalizado_en, v.observaciones,
         f.id AS frecuencia_id, f.cooperativa_id, f.hora_salida::text AS hora_salida, f.tipo_viaje,
         co.nombre AS origen, cd.nombre AS destino,
         b.numero_disco, b.placa,
         TRIM(ch.nombres || ' ' || ch.apellidos) AS chofer,
         (EXTRACT(EPOCH FROM ((v.fecha + f.hora_salida) - (NOW() AT TIME ZONE 'America/Guayaquil'))) / 60)::int AS minutos_para_salir,
         (SELECT COUNT(*)::int FROM boleto bo WHERE bo.viaje_id = v.id AND bo.estado IN ('emitido', 'usado')) AS boletos,
         (SELECT COUNT(*)::int FROM boleto bo WHERE bo.viaje_id = v.id AND bo.estado = 'usado') AS abordados,
         (SELECT COUNT(*)::int FROM boleto bo JOIN compra c ON c.id = bo.compra_id
           WHERE bo.viaje_id = v.id AND c.a_bordo AND bo.estado <> 'anulado') AS vendidos_a_bordo,
         (SELECT COALESCE(SUM(bo.precio_final), 0)::numeric(10,2) FROM boleto bo JOIN compra c ON c.id = bo.compra_id
           WHERE bo.viaje_id = v.id AND c.a_bordo AND bo.estado <> 'anulado') AS recaudado_a_bordo,
         (SELECT COUNT(*)::int FROM asiento a WHERE a.bus_id = v.bus_id) AS capacidad
    FROM viaje v
    JOIN frecuencia f ON f.id = v.frecuencia_id
    JOIN ciudad co ON co.id = f.ciudad_origen_id
    JOIN ciudad cd ON cd.id = f.ciudad_destino_id
    JOIN bus b ON b.id = v.bus_id
    LEFT JOIN usuario ch ON ch.id = v.chofer_id`

const normalizar = (v, chofer) => ({
  ...v,
  recaudado_a_bordo: Number(v.recaudado_a_bordo),
  es_mio: v.chofer_id === chofer.id,
  puede_iniciar: v.estado === 'programado' && v.fecha === hoyEcuador() && v.minutos_para_salir <= MINUTOS_ANTES,
})

async function viajeDeMiCooperativa(chofer, viajeId, cliente = pool, bloquear = false) {
  const { rows } = await cliente.query(
    `${SELECT_VIAJE} WHERE v.id = $1 AND f.cooperativa_id = $2${bloquear ? ' FOR UPDATE OF v' : ''}`,
    [viajeId, chofer.cooperativa_id]
  )
  if (!rows[0]) throw errorHttp('El viaje no existe o no es de tu cooperativa', 404)
  return rows[0]
}

// Viajes de hoy de la cooperativa (y el que el chofer tenga en curso, aunque sea de ayer)
async function viajesDeHoy(chofer) {
  const { rows } = await pool.query(
    `${SELECT_VIAJE}
      WHERE f.cooperativa_id = $1 AND (v.fecha = $2 OR (v.estado = 'en_curso' AND v.chofer_id = $3))
      ORDER BY (v.estado = 'en_curso' AND v.chofer_id = $3) DESC, f.hora_salida`,
    [chofer.cooperativa_id, hoyEcuador(), chofer.id]
  )
  return rows.map((v) => normalizar(v, chofer))
}

async function iniciar(chofer, viajeId) {
  await transaccion(async (cliente) => {
    const v = await viajeDeMiCooperativa(chofer, viajeId, cliente, true)
    if (v.estado === 'en_curso') throw errorHttp(v.chofer_id === chofer.id ? 'Ya iniciaste este viaje' : `Este viaje ya lo inició ${v.chofer}`, 409)
    if (v.estado === 'finalizado') throw errorHttp('Este viaje ya terminó', 409)
    if (v.estado === 'cancelado') throw errorHttp('Este viaje fue cancelado', 409)
    if (v.fecha !== hoyEcuador()) throw errorHttp(`Este viaje es del ${v.fecha}: solo puedes iniciar viajes de hoy`, 409)
    if (v.minutos_para_salir > MINUTOS_ANTES) {
      throw errorHttp(`Aún es temprano: puedes iniciar el viaje desde ${MINUTOS_ANTES} minutos antes de la salida (${v.hora_salida.slice(0, 5)})`, 409)
    }
    const otro = await cliente.query(
      `SELECT co.nombre || ' → ' || cd.nombre AS ruta FROM viaje x
         JOIN frecuencia f ON f.id = x.frecuencia_id
         JOIN ciudad co ON co.id = f.ciudad_origen_id JOIN ciudad cd ON cd.id = f.ciudad_destino_id
        WHERE x.chofer_id = $1 AND x.estado = 'en_curso'`,
      [chofer.id]
    )
    if (otro.rows[0]) throw errorHttp(`Tienes en curso el viaje ${otro.rows[0].ruta}. Finalízalo antes de iniciar otro.`, 409)
    await cliente.query(
      `UPDATE viaje SET estado = 'en_curso', chofer_id = $1, iniciado_en = NOW() WHERE id = $2`,
      [chofer.id, viajeId]
    )
  })
  return detalle(chofer, viajeId)
}

async function finalizar(chofer, viajeId, { observaciones } = {}) {
  const texto = String(observaciones ?? '').trim().replace(/\s+/g, ' ')
  if (texto.length > 300) throw errorHttp('Las observaciones pueden tener hasta 300 caracteres', 400, { observaciones: 'Máximo 300 caracteres' })
  if (/[<>{}]/.test(texto)) throw errorHttp('Las observaciones contienen caracteres no permitidos', 400, { observaciones: 'Quita los caracteres < > { }' })
  await transaccion(async (cliente) => {
    const v = await viajeDeMiCooperativa(chofer, viajeId, cliente, true)
    if (v.estado !== 'en_curso') throw errorHttp('Solo puedes finalizar un viaje que está en curso', 409)
    if (v.chofer_id !== chofer.id) throw errorHttp('Solo el chofer que inició el viaje puede finalizarlo', 403)
    await cliente.query(
      `UPDATE viaje SET estado = 'finalizado', finalizado_en = NOW(), observaciones = $1 WHERE id = $2`,
      [texto || null, viajeId]
    )
  })
  return detalle(chofer, viajeId)
}

// Detalle del viaje con el manifiesto de pasajeros y las paradas
async function detalle(chofer, viajeId) {
  const v = normalizar(await viajeDeMiCooperativa(chofer, viajeId), chofer)
  const pasajeros = await pool.query(
    `SELECT bo.id, bo.codigo, bo.estado, bo.pasajero_nombre, bo.pasajero_cedula, bo.precio_final,
            a.numero AS asiento, ta.nombre AS tipo_asiento,
            cs.nombre AS sube_en, cb.nombre AS baja_en, bo.orden_subida, bo.orden_bajada,
            c.a_bordo, to_char(ap.fecha, 'HH24:MI') AS abordo_hora
       FROM boleto bo
       JOIN compra c ON c.id = bo.compra_id
       JOIN asiento a ON a.id = bo.asiento_id
       JOIN tipo_asiento ta ON ta.id = a.tipo_asiento_id
       JOIN parada ps ON ps.frecuencia_id = $2 AND ps.orden = bo.orden_subida
       JOIN parada pb ON pb.frecuencia_id = $2 AND pb.orden = bo.orden_bajada
       JOIN ciudad cs ON cs.id = ps.ciudad_id
       JOIN ciudad cb ON cb.id = pb.ciudad_id
       LEFT JOIN acceso_pasajero ap ON ap.boleto_id = bo.id
      WHERE bo.viaje_id = $1 AND bo.estado IN ('emitido', 'usado')
      ORDER BY bo.orden_subida, a.numero`,
    [viajeId, v.frecuencia_id]
  )
  const paradas = await pool.query(
    `SELECT p.orden, p.ciudad_id, c.nombre AS ciudad, p.minutos_desde_salida, p.precio_acumulado
       FROM parada p JOIN ciudad c ON c.id = p.ciudad_id
      WHERE p.frecuencia_id = $1 ORDER BY p.orden`,
    [v.frecuencia_id]
  )
  return {
    ...v,
    paradas: paradas.rows.map((p) => ({ ...p, precio_acumulado: Number(p.precio_acumulado) })),
    pasajeros: pasajeros.rows.map((p) => ({ ...p, precio_final: Number(p.precio_final) })),
  }
}

/*
  Valida el boleto escaneado (código QR) y registra el abordaje.
  El viaje debe estar en curso y a nombre de este chofer.
*/
async function validarBoleto(chofer, viajeId, { codigo }) {
  const limpio = String(codigo || '').trim()
  if (!FORMATO_UUID.test(limpio)) throw errorHttp('El código escaneado no es un boleto válido', 400)

  return transaccion(async (cliente) => {
    const v = await viajeDeMiCooperativa(chofer, viajeId, cliente)
    if (v.estado !== 'en_curso') throw errorHttp('Inicia el viaje para validar boletos', 409)
    if (v.chofer_id !== chofer.id) throw errorHttp('Este viaje lo maneja otro chofer', 403)

    const { rows } = await cliente.query(
      `SELECT bo.id, bo.estado, bo.pasajero_nombre, bo.pasajero_cedula, bo.viaje_id,
              a.numero AS asiento, cs.nombre AS sube_en, cb.nombre AS baja_en,
              v.fecha::text AS fecha, co.nombre AS origen, cd.nombre AS destino, f.hora_salida::text AS hora_salida,
              f.cooperativa_id,
              (SELECT to_char(ap.fecha, 'HH24:MI') FROM acceso_pasajero ap WHERE ap.boleto_id = bo.id) AS abordo_hora
         FROM boleto bo
         JOIN asiento a ON a.id = bo.asiento_id
         JOIN viaje v ON v.id = bo.viaje_id
         JOIN frecuencia f ON f.id = v.frecuencia_id
         JOIN ciudad co ON co.id = f.ciudad_origen_id
         JOIN ciudad cd ON cd.id = f.ciudad_destino_id
         JOIN parada ps ON ps.frecuencia_id = f.id AND ps.orden = bo.orden_subida
         JOIN parada pb ON pb.frecuencia_id = f.id AND pb.orden = bo.orden_bajada
         JOIN ciudad cs ON cs.id = ps.ciudad_id
         JOIN ciudad cb ON cb.id = pb.ciudad_id
        WHERE bo.codigo = $1
        FOR UPDATE OF bo`,
      [limpio]
    )
    const b = rows[0]
    if (!b) throw errorHttp('Boleto no encontrado: el código no existe', 404)
    if (b.cooperativa_id !== chofer.cooperativa_id) throw errorHttp('El boleto es de otra cooperativa', 409)
    if (b.viaje_id !== Number(viajeId)) {
      throw errorHttp(`El boleto es de otro viaje: ${b.origen} → ${b.destino}, ${b.fecha} a las ${b.hora_salida.slice(0, 5)}`, 409)
    }
    if (b.estado === 'usado') {
      throw errorHttp(`Este boleto ya se usó: el pasajero abordó a las ${b.abordo_hora}`, 409)
    }
    if (b.estado === 'anulado') throw errorHttp('El boleto está anulado', 409)
    if (b.estado !== 'emitido') throw errorHttp('El pago de este boleto todavía no está aprobado: el pasajero no puede abordar', 409)

    await cliente.query("UPDATE boleto SET estado = 'usado' WHERE id = $1", [b.id])
    await cliente.query('INSERT INTO acceso_pasajero (boleto_id, registrado_por) VALUES ($1, $2)', [b.id, chofer.id])
    return {
      mensaje: 'Boleto válido: puede abordar',
      pasajero: b.pasajero_nombre,
      cedula: b.pasajero_cedula,
      asiento: b.asiento,
      tramo: `${b.sube_en} → ${b.baja_en}`,
    }
  })
}

// Venta a bordo: misma validación de pasajeros y asientos que la ventanilla
async function venderABordo(chofer, viajeId, datos) {
  const v = await viajeDeMiCooperativa(chofer, viajeId)
  if (v.estado !== 'en_curso') throw errorHttp('Inicia el viaje para vender boletos a bordo', 409)
  if (v.chofer_id !== chofer.id) throw errorHttp('Este viaje lo maneja otro chofer', 403)
  // A bordo solo se cobra en efectivo
  const efectivo = await pool.query("SELECT id FROM metodo_pago WHERE codigo = 'efectivo' AND activo")
  if (!efectivo.rows[0]) throw errorHttp('El pago en efectivo no está habilitado', 409)
  return compras.venderABordo(chofer, { ...datos, viaje_id: Number(viajeId), metodo_pago_id: efectivo.rows[0].id })
}

// Historial de viajes del chofer entre dos fechas (por defecto, los últimos 30 días)
async function historial(chofer, { desde, hasta } = {}) {
  const hoy = hoyEcuador()
  const fin = FECHA.test(hasta || '') ? hasta : hoy
  const inicioPorDefecto = new Date(`${fin}T12:00:00Z`)
  inicioPorDefecto.setUTCDate(inicioPorDefecto.getUTCDate() - 30)
  const inicio = FECHA.test(desde || '') ? desde : inicioPorDefecto.toISOString().slice(0, 10)
  if (inicio > fin) throw errorHttp('La fecha "desde" no puede ser posterior a "hasta"', 400, { desde: 'Revisa el rango de fechas' })
  const { rows } = await pool.query(
    `${SELECT_VIAJE}
      WHERE v.chofer_id = $1 AND v.fecha BETWEEN $2 AND $3
      ORDER BY v.fecha DESC, f.hora_salida DESC`,
    [chofer.id, inicio, fin]
  )
  const viajes = rows.map((v) => normalizar(v, chofer))
  return {
    desde: inicio,
    hasta: fin,
    viajes,
    resumen: {
      viajes: viajes.length,
      finalizados: viajes.filter((v) => v.estado === 'finalizado').length,
      pasajeros: viajes.reduce((s, v) => s + v.abordados, 0),
      vendidos_a_bordo: viajes.reduce((s, v) => s + v.vendidos_a_bordo, 0),
      recaudado_a_bordo: Math.round(viajes.reduce((s, v) => s + v.recaudado_a_bordo, 0) * 100) / 100,
    },
  }
}

module.exports = { viajesDeHoy, iniciar, finalizar, detalle, validarBoleto, venderABordo, historial }
