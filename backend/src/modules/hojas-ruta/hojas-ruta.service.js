const { pool, transaccion } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-19 - Hoja de ruta por grupo (como en una cooperativa real).

  Se elige un GRUPO y una fecha de inicio. La hoja es una tabla:
    filas    = las frecuencias activas del grupo + las filas de "Parada"
    columnas = los días (desde la fecha de inicio)
    celda    = el bus que cubre esa frecuencia ese día

  Reglas del negocio:
    - Un bus hace una sola ruta (frecuencia) al día.
    - Cada día debe haber al menos 2 buses en parada:
        buses activos del grupo >= frecuencias activas + 2
      Si sobran buses se agregan más filas de parada (nadie se queda sin trabajar:
      la rotación hace que todos pasen por todas las filas).
    - Generación automática con aprobación: el sistema propone la rotación
      (cada día cada bus baja una fila), el usuario cambia lo que necesite
      (bus dañado → otro que esté en parada) y recién al aprobar se guarda.
    - Un viaje que ya tiene boletos vendidos conserva su bus.
*/

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const MIN_PARADAS = 2
const MAX_DIAS = 31

const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// Número absoluto del día: la rotación continúa igual de un periodo a otro
const numeroDia = (fecha) => Math.floor(new Date(`${fecha}T12:00:00Z`).getTime() / 86400000)

function leerPeriodo({ grupo_id, desde, dias }, { permitirPasado = false } = {}) {
  const errores = {}
  const grupoId = Number(grupo_id)
  const cantidad = Number(dias ?? 7)
  if (!Number.isInteger(grupoId) || grupoId <= 0) errores.grupo_id = 'Elige el grupo'
  if (!FECHA.test(desde || '')) errores.desde = 'Elige la fecha de inicio'
  else if (!permitirPasado && desde < hoyEcuador()) errores.desde = 'La hoja de ruta debe empezar hoy o en una fecha futura'
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_DIAS) errores.dias = `El periodo debe ser de 1 a ${MAX_DIAS} días`
  if (Object.keys(errores).length) throw errorHttp('Revisa el grupo y el periodo', 400, errores)
  return { grupoId, desde, fechas: Array.from({ length: cantidad }, (_, i) => sumarDias(desde, i)) }
}

// Grupo, frecuencias y buses activos del grupo, y los viajes ya guardados en el periodo
async function contexto(cooperativaId, grupoId, fechas) {
  const grupo = await pool.query(
    'SELECT id, nombre, activo FROM grupo WHERE id = $1 AND cooperativa_id = $2',
    [grupoId, cooperativaId]
  )
  if (!grupo.rows[0]) throw errorHttp('El grupo no existe o no es de tu cooperativa', 404)
  if (!grupo.rows[0].activo) throw errorHttp('El grupo está desactivado. Actívalo en Grupos para trabajar su hoja de ruta.', 409)

  const frecuencias = await pool.query(
    `SELECT f.id, f.hora_salida::text AS hora_salida, f.tipo_viaje,
            co.nombre AS origen, cd.nombre AS destino,
            COALESCE(po.nombre || ' - ', '') || co.nombre AS origen_etiqueta,
            COALESCE(pd.nombre || ' - ', '') || cd.nombre AS destino_etiqueta
       FROM frecuencia f
       JOIN ciudad co ON co.id = f.ciudad_origen_id
       JOIN ciudad cd ON cd.id = f.ciudad_destino_id
       LEFT JOIN provincia po ON po.id = co.provincia_id
       LEFT JOIN provincia pd ON pd.id = cd.provincia_id
      WHERE f.cooperativa_id = $1 AND f.grupo_id = $2 AND f.activa
      ORDER BY f.hora_salida, co.nombre`,
    [cooperativaId, grupoId]
  )
  const buses = await pool.query(
    `SELECT id, numero_disco, placa FROM bus
      WHERE cooperativa_id = $1 AND grupo_id = $2 AND activo
      ORDER BY numero_disco::int, numero_disco`,
    [cooperativaId, grupoId]
  )
  const ids = frecuencias.rows.map((f) => f.id)
  const viajes = ids.length
    ? (await pool.query(
        `SELECT v.id, v.frecuencia_id, v.bus_id, v.fecha::text AS fecha,
                (SELECT COUNT(*)::int FROM boleto b WHERE b.viaje_id = v.id AND b.estado <> 'anulado') AS vendidos
           FROM viaje v
          WHERE v.frecuencia_id = ANY($1::int[]) AND v.fecha = ANY($2::date[])`,
        [ids, fechas]
      )).rows
    : []
  return { grupo: grupo.rows[0], frecuencias: frecuencias.rows, buses: buses.rows, viajes }
}

// Verifica que alcancen los buses: frecuencias + 2 en parada
function revisarCobertura({ frecuencias, buses }) {
  if (frecuencias.length === 0) {
    throw errorHttp('Este grupo no tiene frecuencias activas. Asígnale frecuencias en Grupos.', 409, { faltan_frecuencias: true })
  }
  const necesarios = frecuencias.length + MIN_PARADAS
  if (buses.length < necesarios) {
    throw errorHttp(
      `Para ${frecuencias.length} frecuencias necesitas al menos ${necesarios} buses activos en el grupo ` +
      `(${MIN_PARADAS} quedan en parada cada día). Tienes ${buses.length}: agrega ${necesarios - buses.length} más en Grupos.`,
      409,
      { necesarios, buses: buses.length, frecuencias: frecuencias.length }
    )
  }
}

// Viajes con boletos vendidos por fecha: { fecha: { frecuencia_id: { bus_id, vendidos } } }
function bloqueadosPorFecha(viajes) {
  const mapa = {}
  for (const v of viajes) {
    if (v.vendidos > 0) (mapa[v.fecha] ||= {})[v.frecuencia_id] = { bus_id: v.bus_id, vendidos: v.vendidos }
  }
  return mapa
}

function respuesta(ctx, fechas, filasPorFecha, extra = {}) {
  const guardadas = new Set(ctx.viajes.map((v) => v.fecha))
  return {
    grupo: { id: ctx.grupo.id, nombre: ctx.grupo.nombre },
    desde: fechas[0],
    hasta: fechas[fechas.length - 1],
    dias: fechas,
    frecuencias: ctx.frecuencias,
    buses: ctx.buses,
    paradas: Math.max(ctx.buses.length - ctx.frecuencias.length, 0),
    minimo_paradas: MIN_PARADAS,
    filas: filasPorFecha, // { fecha: [bus_id por fila: primero las frecuencias, luego las paradas] }
    bloqueados: bloqueadosPorFecha(ctx.viajes),
    guardado: Object.fromEntries(fechas.map((f) => [f, guardadas.has(f)])),
    ...extra,
  }
}

/*
  Propuesta automática (NO guarda nada).
  Con B buses ordenados por número de disco, el día d el bus k va a la fila (k + d) mod B:
  cada día todos bajan una fila; después de la última parada vuelven a la primera frecuencia.
*/
async function generar(cooperativaId, datos) {
  const { grupoId, fechas } = leerPeriodo(datos)
  const ctx = await contexto(cooperativaId, grupoId, fechas)
  revisarCobertura(ctx)

  const B = ctx.buses.length
  const bloqueados = bloqueadosPorFecha(ctx.viajes)
  const avisos = []
  const filas = {}

  for (const fecha of fechas) {
    const d = numeroDia(fecha)
    const dia = new Array(B)
    ctx.buses.forEach((bus, k) => { dia[(k + d) % B] = bus.id })

    // Los viajes con boletos vendidos conservan su bus: se intercambia con quien le tocaba
    for (const [frecuenciaId, { bus_id: busId, vendidos }] of Object.entries(bloqueados[fecha] || {})) {
      const fila = ctx.frecuencias.findIndex((f) => f.id === Number(frecuenciaId))
      const donde = dia.indexOf(busId)
      if (fila < 0 || donde < 0) continue
      if (fila !== donde) {
        ;[dia[fila], dia[donde]] = [dia[donde], dia[fila]]
        const f = ctx.frecuencias[fila]
        avisos.push(`${fecha}: ${f.origen} → ${f.destino} ${f.hora_salida.slice(0, 5)} tiene ${vendidos} boleto(s) vendido(s) y conserva su bus`)
      }
    }
    filas[fecha] = dia
  }
  return respuesta(ctx, fechas, filas, { propuesta: true, avisos })
}

// Lo que está guardado en el periodo (las paradas son los buses del grupo sin viaje ese día)
async function obtener(cooperativaId, datos) {
  const { grupoId, fechas } = leerPeriodo(datos, { permitirPasado: true })
  const ctx = await contexto(cooperativaId, grupoId, fechas)
  const filas = {}
  for (const fecha of fechas) {
    const delDia = ctx.viajes.filter((v) => v.fecha === fecha)
    if (!delDia.length) { filas[fecha] = null; continue }
    const enRuta = ctx.frecuencias.map((f) => delDia.find((v) => v.frecuencia_id === f.id)?.bus_id || null)
    const usados = new Set(enRuta.filter(Boolean))
    const enParada = ctx.buses.filter((b) => !usados.has(b.id)).map((b) => b.id)
    filas[fecha] = [...enRuta, ...enParada]
  }
  return respuesta(ctx, fechas, filas, { propuesta: false, avisos: [] })
}

/*
  Guarda (aprueba) la hoja de ruta del periodo.
  Cuerpo: { grupo_id, desde, dias, generacion, filas: { fecha: [bus_id, ...] } }
  Solo se leen las primeras F posiciones (las frecuencias); las paradas se calculan solas.
*/
async function guardar(usuario, datos) {
  const { grupoId, fechas } = leerPeriodo(datos)
  const ctx = await contexto(usuario.cooperativa_id, grupoId, fechas)
  revisarCobertura(ctx)

  const busesValidos = new Map(ctx.buses.map((b) => [b.id, b]))
  const bloqueados = bloqueadosPorFecha(ctx.viajes)
  const filas = datos.filas && typeof datos.filas === 'object' ? datos.filas : {}
  const errores = {}
  const asignacion = {}

  for (const fecha of fechas) {
    const dia = Array.isArray(filas[fecha]) ? filas[fecha].map((x) => (x ? Number(x) : null)) : []
    const enRuta = ctx.frecuencias.map((_, i) => dia[i] || null)
    const vistos = new Map()
    ctx.frecuencias.forEach((f, i) => {
      const clave = `${fecha}_${f.id}`
      const busId = enRuta[i]
      const ruta = `${f.origen} → ${f.destino} ${f.hora_salida.slice(0, 5)}`
      if (!busId) errores[clave] = `${fecha}: falta el bus de ${ruta}`
      else if (!busesValidos.has(busId)) errores[clave] = `${fecha}: el bus elegido para ${ruta} no está activo en este grupo`
      else if (vistos.has(busId)) {
        errores[clave] = `${fecha}: el disco ${busesValidos.get(busId).numero_disco} está en dos rutas el mismo día (${vistos.get(busId)} y ${ruta})`
      } else vistos.set(busId, ruta)
      const bloqueado = bloqueados[fecha]?.[f.id]
      if (bloqueado && bloqueado.bus_id !== busId) {
        errores[clave] = `${fecha}: ${ruta} ya tiene ${bloqueado.vendidos} boleto(s) vendido(s), no se puede cambiar su bus`
      }
    })
    asignacion[fecha] = enRuta
  }
  if (Object.keys(errores).length) {
    throw errorHttp(Object.values(errores)[0], 400, errores)
  }

  const generacion = datos.generacion === 'automatica' ? 'automatica' : 'manual'
  await transaccion(async (cliente) => {
    for (const fecha of fechas) {
      const { rows } = await cliente.query(
        `INSERT INTO hoja_ruta (cooperativa_id, grupo_id, fecha, generacion, creado_por)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (grupo_id, fecha) DO UPDATE SET generacion = EXCLUDED.generacion, creado_por = EXCLUDED.creado_por
         RETURNING id`,
        [usuario.cooperativa_id, grupoId, fecha, generacion, usuario.id]
      )
      const hojaId = rows[0].id
      for (let i = 0; i < ctx.frecuencias.length; i++) {
        await cliente.query(
          `INSERT INTO viaje (hoja_ruta_id, frecuencia_id, bus_id, fecha)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (frecuencia_id, fecha) DO UPDATE SET bus_id = EXCLUDED.bus_id, hoja_ruta_id = EXCLUDED.hoja_ruta_id`,
          [hojaId, ctx.frecuencias[i].id, asignacion[fecha][i], fecha]
        )
      }
    }
  })
  return obtener(usuario.cooperativa_id, datos)
}

module.exports = { generar, obtener, guardar }
