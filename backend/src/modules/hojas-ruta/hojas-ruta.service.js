
const { pool, transaccion } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

// Minutos desde medianoche de una hora 'HH:MM[:SS]'
const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/*
  Hoja de ruta de un día para la cooperativa:
  - frecuencias activas con el bus asignado (o null) y los boletos vendidos
  - buses activos, y cuáles quedan en día de parada (sin ningún viaje ese día)
*/
async function obtener(cooperativaId, fecha) {
  if (!FECHA.test(fecha || '')) throw errorHttp('Indica la fecha en formato AAAA-MM-DD', 400)

  const hoja = await pool.query(
    `SELECT id, fecha::text AS fecha, generacion, creado_en
       FROM hoja_ruta WHERE cooperativa_id = $1 AND fecha = $2`,
    [cooperativaId, fecha]
  )

  const frecuencias = await pool.query(
    `SELECT f.id AS frecuencia_id, f.hora_salida::text AS hora_salida,
            co.nombre AS origen, cd.nombre AS destino, f.tipo_viaje,
            (SELECT MAX(p.minutos_desde_salida) FROM parada p WHERE p.frecuencia_id = f.id) AS duracion_minutos,
            v.id AS viaje_id, v.bus_id,
            (SELECT COUNT(*)::int FROM boleto b WHERE b.viaje_id = v.id AND b.estado <> 'anulado') AS boletos_vendidos
       FROM frecuencia f
       JOIN ciudad co ON co.id = f.ciudad_origen_id
       JOIN ciudad cd ON cd.id = f.ciudad_destino_id
       LEFT JOIN viaje v ON v.frecuencia_id = f.id AND v.fecha = $2
      WHERE f.cooperativa_id = $1 AND f.activa
      ORDER BY f.hora_salida`,
    [cooperativaId, fecha]
  )

  const buses = await pool.query(
    `SELECT id, numero_disco, placa FROM bus
      WHERE cooperativa_id = $1 AND activo
      ORDER BY numero_disco`,
    [cooperativaId]
  )

  const asignados = new Set(frecuencias.rows.filter((f) => f.bus_id).map((f) => f.bus_id))
  return {
    fecha,
    hoja: hoja.rows[0] || null,
    frecuencias: frecuencias.rows,
    buses: buses.rows,
    buses_en_parada: buses.rows.filter((b) => !asignados.has(b.id)),
  }
}

/*
  Guarda la hoja de ruta del día (generación manual o automática).
  Cuerpo: { fecha, generacion: 'manual' | 'automatica', asignaciones: [{ frecuencia_id, bus_id }] }
  - Cada frecuencia debe ser activa y de la cooperativa; cada bus, activo y de la cooperativa.
  - Un bus no puede tener dos viajes que se crucen en horario el mismo día.
  - Si un viaje ya tiene boletos vendidos, no se puede quitar ni cambiar de bus.
*/
async function guardar(usuario, datos) {
  const { fecha } = datos
  const generacion = datos.generacion === 'automatica' ? 'automatica' : 'manual'
  if (!FECHA.test(fecha || '')) throw errorHttp('Indica la fecha en formato AAAA-MM-DD', 400)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
  if (fecha < hoy) throw errorHttp('No se puede modificar la hoja de ruta de un día pasado', 409)

  const asignaciones = (Array.isArray(datos.asignaciones) ? datos.asignaciones : [])
    .filter((a) => a.bus_id)
    .map((a) => ({ frecuencia_id: Number(a.frecuencia_id), bus_id: Number(a.bus_id) }))

  const actual = await obtener(usuario.cooperativa_id, fecha)
  const frecuencias = new Map(actual.frecuencias.map((f) => [f.frecuencia_id, f]))
  const busesValidos = new Set(actual.buses.map((b) => b.id))

  const errores = {}
  for (const a of asignaciones) {
    if (!frecuencias.has(a.frecuencia_id)) errores[`frecuencia_${a.frecuencia_id}`] = 'Frecuencia no válida o inactiva'
    if (!busesValidos.has(a.bus_id)) errores[`frecuencia_${a.frecuencia_id}`] = 'El bus no está activo o no es de tu cooperativa'
  }

  // Cruce de horarios: el mismo bus en dos viajes que se superponen
  const porBus = new Map()
  for (const a of asignaciones) {
    const f = frecuencias.get(a.frecuencia_id)
    if (!f) continue
    const inicio = aMinutos(f.hora_salida)
    const fin = inicio + Number(f.duracion_minutos || 0)
    const viajesBus = porBus.get(a.bus_id) || []
    for (const otro of viajesBus) {
      if (inicio < otro.fin && otro.inicio < fin) {
        errores[`frecuencia_${a.frecuencia_id}`] =
          `El bus ya está asignado a ${otro.ruta} y los horarios se cruzan`
      }
    }
    viajesBus.push({ inicio, fin, ruta: `${f.origen} → ${f.destino} (${f.hora_salida.slice(0, 5)})` })
    porBus.set(a.bus_id, viajesBus)
  }

  // Viajes con boletos vendidos: no se pueden quitar ni cambiar de bus
  for (const f of actual.frecuencias) {
    if (!f.viaje_id || f.boletos_vendidos === 0) continue
    const nueva = asignaciones.find((a) => a.frecuencia_id === f.frecuencia_id)
    if (!nueva || nueva.bus_id !== f.bus_id) {
      errores[`frecuencia_${f.frecuencia_id}`] =
        `${f.origen} → ${f.destino} ya tiene ${f.boletos_vendidos} boleto(s) vendido(s): no se puede cambiar su bus`
    }
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa la hoja de ruta', 400, errores)

  await transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO hoja_ruta (cooperativa_id, fecha, generacion, creado_por)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cooperativa_id, fecha) DO UPDATE SET generacion = EXCLUDED.generacion
       RETURNING id`,
      [usuario.cooperativa_id, fecha, generacion, usuario.id]
    )
    const hojaId = rows[0].id

    for (const f of actual.frecuencias) {
      const nueva = asignaciones.find((a) => a.frecuencia_id === f.frecuencia_id)
      if (f.viaje_id && !nueva) {
        await cliente.query('DELETE FROM viaje WHERE id = $1', [f.viaje_id])
      } else if (f.viaje_id && nueva) {
        await cliente.query('UPDATE viaje SET bus_id = $1, hoja_ruta_id = $2 WHERE id = $3', [nueva.bus_id, hojaId, f.viaje_id])
      } else if (!f.viaje_id && nueva) {
        await cliente.query(
          'INSERT INTO viaje (hoja_ruta_id, frecuencia_id, bus_id, fecha) VALUES ($1, $2, $3, $4)',
          [hojaId, f.frecuencia_id, nueva.bus_id, fecha]
        )
      }
    }
  })

  return obtener(usuario.cooperativa_id, fecha)
}

module.exports = { obtener, guardar }
