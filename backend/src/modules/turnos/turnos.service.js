const { pool, transaccion } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const DIAS = 7

const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

// Suma días a una fecha 'YYYY-MM-DD' (sin problemas de zona horaria)
function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Número de día absoluto: sirve para que la rotación continúe de una semana a otra
const numeroDia = (fecha) => Math.floor(new Date(`${fecha}T12:00:00Z`).getTime() / 86400000)

// Frecuencias activas de la cooperativa con su turno (o null)
async function frecuenciasConTurno(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT f.id, f.hora_salida::text AS hora_salida, co.nombre AS origen, cd.nombre AS destino,
            (SELECT MAX(p.minutos_desde_salida) FROM parada p WHERE p.frecuencia_id = f.id) AS duracion_minutos,
            tf.turno_id
       FROM frecuencia f
       JOIN ciudad co ON co.id = f.ciudad_origen_id
       JOIN ciudad cd ON cd.id = f.ciudad_destino_id
       LEFT JOIN turno_frecuencia tf ON tf.frecuencia_id = f.id
      WHERE f.cooperativa_id = $1 AND f.activa
      ORDER BY f.hora_salida`,
    [cooperativaId]
  )
  return rows
}

async function busesActivos(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT id, numero_disco, placa FROM bus
      WHERE cooperativa_id = $1 AND activo
      ORDER BY numero_disco`,
    [cooperativaId]
  )
  return rows
}

// Turnos de la cooperativa con sus frecuencias, y las frecuencias que no tienen turno
async function listar(cooperativaId) {
  const { rows: turnos } = await pool.query(
    'SELECT id, nombre, orden FROM turno WHERE cooperativa_id = $1 ORDER BY orden',
    [cooperativaId]
  )
  const frecuencias = await frecuenciasConTurno(cooperativaId)
  const buses = await busesActivos(cooperativaId)
  return {
    turnos: turnos.map((t) => ({ ...t, frecuencias: frecuencias.filter((f) => f.turno_id === t.id) })),
    frecuencias_sin_turno: frecuencias.filter((f) => !f.turno_id),
    total_buses: buses.length,
    dias_parada_por_dia: Math.max(buses.length - turnos.length, 0),
  }
}

/*
  Valida los datos de un turno:
  - nombre obligatorio
  - al menos una frecuencia, activa y de la cooperativa
  - ninguna frecuencia puede estar en otro turno
  - las frecuencias no pueden cruzarse en horario (las hace el mismo bus)
*/
async function validar(cooperativaId, datos, turnoId = null) {
  const errores = {}
  if (!datos.nombre?.trim()) errores.nombre = 'El nombre del turno es obligatorio'
  const ids = [...new Set((datos.frecuencias || []).map(Number))]
  if (ids.length === 0) errores.frecuencias = 'Elige al menos una frecuencia'

  const todas = await frecuenciasConTurno(cooperativaId)
  const elegidas = todas.filter((f) => ids.includes(f.id))
  if (ids.length && elegidas.length !== ids.length) {
    errores.frecuencias = 'Alguna frecuencia no existe, está inactiva o no es de tu cooperativa'
  }
  const ocupada = elegidas.find((f) => f.turno_id && f.turno_id !== turnoId)
  if (ocupada) {
    errores.frecuencias = `${ocupada.origen} → ${ocupada.destino} (${ocupada.hora_salida.slice(0, 5)}) ya pertenece a otro turno`
  }

  const ordenadas = [...elegidas].sort((a, b) => aMinutos(a.hora_salida) - aMinutos(b.hora_salida))
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1]
    const finAnterior = aMinutos(anterior.hora_salida) + Number(anterior.duracion_minutos || 0)
    if (aMinutos(ordenadas[i].hora_salida) < finAnterior) {
      errores.frecuencias = `${anterior.origen} → ${anterior.destino} todavía no llega cuando sale ` +
        `${ordenadas[i].origen} → ${ordenadas[i].destino}: un mismo bus no puede hacer las dos`
      break
    }
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa el turno', 400, errores)
  return ids
}

async function crear(cooperativaId, datos) {
  const ids = await validar(cooperativaId, datos)
  await transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO turno (cooperativa_id, nombre, orden)
       VALUES ($1, $2, COALESCE((SELECT MAX(orden) FROM turno WHERE cooperativa_id = $1), 0) + 1)
       RETURNING id`,
      [cooperativaId, datos.nombre.trim()]
    )
    for (const id of ids) {
      await cliente.query('INSERT INTO turno_frecuencia (turno_id, frecuencia_id) VALUES ($1, $2)', [rows[0].id, id])
    }
  })
  return listar(cooperativaId)
}

async function actualizar(cooperativaId, turnoId, datos) {
  const existe = await pool.query('SELECT id FROM turno WHERE id = $1 AND cooperativa_id = $2', [turnoId, cooperativaId])
  if (!existe.rows[0]) throw errorHttp('Turno no encontrado', 404)
  const ids = await validar(cooperativaId, datos, Number(turnoId))
  await transaccion(async (cliente) => {
    await cliente.query('UPDATE turno SET nombre = $1 WHERE id = $2', [datos.nombre.trim(), turnoId])
    await cliente.query('DELETE FROM turno_frecuencia WHERE turno_id = $1', [turnoId])
    for (const id of ids) {
      await cliente.query('INSERT INTO turno_frecuencia (turno_id, frecuencia_id) VALUES ($1, $2)', [turnoId, id])
    }
  })
  return listar(cooperativaId)
}

async function eliminar(cooperativaId, turnoId) {
  const { rowCount } = await pool.query('DELETE FROM turno WHERE id = $1 AND cooperativa_id = $2', [turnoId, cooperativaId])
  if (!rowCount) throw errorHttp('Turno no encontrado', 404)
  return listar(cooperativaId)
}

/*
  Genera la hoja de ruta de 7 días a partir de "desde" con rotación:
  - Los buses activos se ordenan por número de disco (posición k).
  - Las casillas del día son los turnos (por orden) más casillas "P" hasta igualar el número de buses.
  - El día d, el bus en la posición k recibe la casilla (k + d) mod número_de_buses.
  Así cada día todos "avanzan una casilla": rotan los turnos y los días de parada.
  Los viajes que ya tienen boletos vendidos conservan su bus (se informan en "avisos").
*/
async function generarSemana(usuario, desde) {
  if (!FECHA.test(desde || '')) throw errorHttp('Indica la fecha de inicio en formato AAAA-MM-DD', 400)
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
  if (desde < hoy) throw errorHttp('La semana debe empezar hoy o en una fecha futura', 409)

  const { turnos } = await listar(usuario.cooperativa_id)
  const buses = await busesActivos(usuario.cooperativa_id)
  if (turnos.length === 0) throw errorHttp('Primero crea al menos un turno', 409)
  if (buses.length < turnos.length) {
    throw errorHttp(`Hay ${turnos.length} turnos y solo ${buses.length} buses activos: no alcanzan para cubrir todos los turnos`, 409)
  }

  const avisos = []
  await transaccion(async (cliente) => {
    for (let i = 0; i < DIAS; i++) {
      const fecha = sumarDias(desde, i)
      const d = numeroDia(fecha)

      const hoja = await cliente.query(
        `INSERT INTO hoja_ruta (cooperativa_id, fecha, generacion, creado_por)
         VALUES ($1, $2, 'automatica', $3)
         ON CONFLICT (cooperativa_id, fecha) DO UPDATE SET generacion = 'automatica'
         RETURNING id`,
        [usuario.cooperativa_id, fecha, usuario.id]
      )
      const hojaId = hoja.rows[0].id

      for (let k = 0; k < buses.length; k++) {
        const casilla = (k + d) % buses.length
        if (casilla >= turnos.length) continue // día de parada
        const turno = turnos[casilla]

        for (const f of turno.frecuencias) {
          const actual = await cliente.query(
            `SELECT v.id, v.bus_id,
                    (SELECT COUNT(*)::int FROM boleto b WHERE b.viaje_id = v.id AND b.estado <> 'anulado') AS vendidos
               FROM viaje v WHERE v.frecuencia_id = $1 AND v.fecha = $2`,
            [f.id, fecha]
          )
          const viaje = actual.rows[0]
          if (!viaje) {
            await cliente.query(
              'INSERT INTO viaje (hoja_ruta_id, frecuencia_id, bus_id, fecha) VALUES ($1, $2, $3, $4)',
              [hojaId, f.id, buses[k].id, fecha]
            )
          } else if (viaje.bus_id !== buses[k].id) {
            if (viaje.vendidos > 0) {
              avisos.push(`${fecha}: ${f.origen} → ${f.destino} (${f.hora_salida.slice(0, 5)}) tiene boletos vendidos y conserva su bus`)
            } else {
              await cliente.query('UPDATE viaje SET bus_id = $1, hoja_ruta_id = $2 WHERE id = $3', [buses[k].id, hojaId, viaje.id])
            }
          }
        }
      }
    }
  })

  return { ...(await semana(usuario.cooperativa_id, desde)), avisos }
}

/*
  Hoja de ruta semanal tal como está guardada (incluye cambios manuales hechos en Hojas de ruta):
  una fila por bus y una columna por día; cada celda tiene el turno y sus viajes, o "P".
*/
async function semana(cooperativaId, desde) {
  if (!FECHA.test(desde || '')) throw errorHttp('Indica la fecha de inicio en formato AAAA-MM-DD', 400)
  const hasta = sumarDias(desde, DIAS - 1)
  const buses = await busesActivos(cooperativaId)

  const { rows: viajes } = await pool.query(
    `SELECT v.bus_id, v.fecha::text AS fecha, f.hora_salida::text AS hora_salida,
            co.nombre AS origen, cd.nombre AS destino, t.nombre AS turno, t.orden AS turno_orden
       FROM viaje v
       JOIN frecuencia f ON f.id = v.frecuencia_id
       JOIN ciudad co ON co.id = f.ciudad_origen_id
       JOIN ciudad cd ON cd.id = f.ciudad_destino_id
       LEFT JOIN turno_frecuencia tf ON tf.frecuencia_id = f.id
       LEFT JOIN turno t ON t.id = tf.turno_id
      WHERE f.cooperativa_id = $1 AND v.fecha BETWEEN $2 AND $3
      ORDER BY f.hora_salida`,
    [cooperativaId, desde, hasta]
  )

  const dias = Array.from({ length: DIAS }, (_, i) => sumarDias(desde, i))
  const filas = buses.map((bus) => ({
    bus,
    dias: dias.map((fecha) => {
      const delDia = viajes.filter((v) => v.bus_id === bus.id && v.fecha === fecha)
      return {
        fecha,
        parada: delDia.length === 0,
        turno: delDia.find((v) => v.turno)?.turno || null,
        turno_orden: delDia.find((v) => v.turno_orden)?.turno_orden || null,
        viajes: delDia.map((v) => ({ hora: v.hora_salida.slice(0, 5), origen: v.origen, destino: v.destino })),
      }
    }),
  }))
  return { desde, hasta, dias, filas }
}

module.exports = { listar, crear, actualizar, eliminar, generarSemana, semana }
