const { pool, transaccion } = require('../../config/db')

// ======================================
// MANEJO DE ERRORES HTTP
// ======================================

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-21 - Frecuencias (rutas autorizadas por la ANT) con edición.
  Reglas:
    - origen y destino distintos, cantones activos del catálogo;
    - hora HH:MM; resolución de la ANT obligatoria; fecha de resolución no futura;
    - el viaje dura de 10 minutos a 24 horas y el pasaje cuesta de $0.25 a $100;
    - en las paradas, minutos y precio acumulado aumentan hasta el destino y
      ninguna ciudad se repite;
    - no se repite la misma ruta a la misma hora en la cooperativa;
    - si ya hay boletos vendidos para viajes de hoy en adelante, solo se
      pueden corregir los datos de la resolución (no la ruta, la hora ni los precios).
*/
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const RESOLUCION = /^[A-Za-z0-9ÁÉÍÓÚÑáéíóúñ][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\-./ ]{3,58}[A-Za-z0-9]$/
const MAX_MINUTOS = 24 * 60
const MAX_PRECIO = 100

const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
const dosDecimales = (n) => Math.round(Number(n) * 100) / 100

// Etiqueta "Provincia - Cantón" de una ciudad (alias de la tabla ciudad y de su provincia)
const etiqueta = (c, p) => `COALESCE(${p}.nombre || ' - ', '') || ${c}.nombre`

// ======================================
// LISTAR FRECUENCIAS
// ======================================

async function listar(cooperativaId) {
  const hoy = hoyEcuador()
  const { rows } = await pool.query(
    `SELECT f.id,
            f.hora_salida::text AS hora_salida,
            f.numero_resolucion,
            f.fecha_resolucion::text AS fecha_resolucion,
            f.tipo_viaje,
            f.activa,
            f.destacada, -- GC-35
            f.ciudad_origen_id,
            co.nombre AS origen,
            ${etiqueta('co', 'po')} AS origen_etiqueta,
            f.ciudad_destino_id,
            cd.nombre AS destino,
            ${etiqueta('cd', 'pd')} AS destino_etiqueta,
            (SELECT COUNT(*)::int FROM parada p WHERE p.frecuencia_id = f.id) AS total_paradas,
            (SELECT MAX(p.precio_acumulado) FROM parada p WHERE p.frecuencia_id = f.id) AS precio_total,
            (SELECT MAX(p.minutos_desde_salida) FROM parada p WHERE p.frecuencia_id = f.id) AS duracion_minutos,
            (SELECT COUNT(*)::int FROM viaje v WHERE v.frecuencia_id = f.id AND v.fecha >= $2) AS viajes_programados,
            (SELECT COUNT(*)::int FROM boleto b JOIN viaje v ON v.id = b.viaje_id
              WHERE v.frecuencia_id = f.id AND v.fecha >= $2 AND b.estado <> 'anulado') AS boletos_futuros
       FROM frecuencia f
       JOIN ciudad co ON co.id = f.ciudad_origen_id
       JOIN ciudad cd ON cd.id = f.ciudad_destino_id
       LEFT JOIN provincia po ON po.id = co.provincia_id
       LEFT JOIN provincia pd ON pd.id = cd.provincia_id
      WHERE f.cooperativa_id = $1
      ORDER BY f.hora_salida, co.nombre`,
    [cooperativaId, hoy]
  )
  return rows.map((f) => ({ ...f, precio_total: f.precio_total === null ? null : Number(f.precio_total) }))
}

// ======================================
// OBTENER FRECUENCIA Y PARADAS
// ======================================

async function obtener(cooperativaId, id) {
  const lista = await listar(cooperativaId)
  const frecuencia = lista.find((f) => f.id === Number(id))
  if (!frecuencia) throw errorHttp('Frecuencia no encontrada', 404)

  const paradas = await pool.query(
    `SELECT p.orden, p.ciudad_id, c.nombre AS ciudad, ${etiqueta('c', 'pr')} AS ciudad_etiqueta,
            p.minutos_desde_salida, p.precio_acumulado
       FROM parada p
       JOIN ciudad c ON c.id = p.ciudad_id
       LEFT JOIN provincia pr ON pr.id = c.provincia_id
      WHERE p.frecuencia_id = $1
      ORDER BY p.orden`,
    [id]
  )
  return {
    ...frecuencia,
    paradas: paradas.rows.map((p) => ({ ...p, precio_acumulado: Number(p.precio_acumulado) })),
  }
}

// ======================================
// ARMAR RECORRIDO COMPLETO
// ======================================

function armarRecorrido(datos) {
  const intermedias = Array.isArray(datos.paradas_intermedias) ? datos.paradas_intermedias : []
  const recorrido = [
    { ciudad_id: Number(datos.ciudad_origen_id), minutos_desde_salida: 0, precio_acumulado: 0 },
    ...intermedias.map((p) => ({
      ciudad_id: Number(p.ciudad_id),
      minutos_desde_salida: Number(p.minutos_desde_salida),
      precio_acumulado: dosDecimales(p.precio_acumulado),
    })),
    {
      ciudad_id: Number(datos.ciudad_destino_id),
      minutos_desde_salida: Number(datos.duracion_minutos),
      precio_acumulado: dosDecimales(datos.precio_total),
    },
  ]
  return recorrido.map((p, i) => ({ ...p, orden: i + 1 }))
}

// ======================================
// VALIDAR FRECUENCIA Y PARADAS
// ======================================

async function validar(cooperativaId, datos, recorrido, idActual = null) {
  const errores = {}
  const origen = Number(datos.ciudad_origen_id)
  const destino = Number(datos.ciudad_destino_id)

  if (!origen) errores.ciudad_origen_id = 'Elige el cantón de origen'
  if (!destino) errores.ciudad_destino_id = 'Elige el cantón de destino'
  else if (origen === destino) errores.ciudad_destino_id = 'El destino debe ser distinto del origen'

  if (!HORA.test(datos.hora_salida || '')) errores.hora_salida = 'Escribe la hora de salida (HH:MM, de 00:00 a 23:59)'

  const resolucion = String(datos.numero_resolucion ?? '').trim()
  if (!resolucion) errores.numero_resolucion = 'El número de resolución de la ANT es obligatorio'
  else if (!RESOLUCION.test(resolucion)) errores.numero_resolucion = 'Usa de 5 a 60 letras, números, guiones o barras (ej. ANT-RES-2025-0145)'

  if (datos.fecha_resolucion) {
    if (!FECHA.test(datos.fecha_resolucion)) errores.fecha_resolucion = 'Escribe una fecha válida'
    else if (datos.fecha_resolucion > hoyEcuador()) errores.fecha_resolucion = 'La resolución no puede tener fecha futura'
    else if (datos.fecha_resolucion < '1990-01-01') errores.fecha_resolucion = 'Revisa la fecha de la resolución'
  }

  const duracion = Number(datos.duracion_minutos)
  if (!Number.isInteger(duracion) || duracion < 10 || duracion > MAX_MINUTOS) {
    errores.duracion_minutos = 'La duración debe estar entre 10 minutos y 24 horas'
  }
  const precio = Number(datos.precio_total)
  if (!Number.isFinite(precio) || precio < 0.25 || precio > MAX_PRECIO) {
    errores.precio_total = `El precio debe estar entre $0.25 y $${MAX_PRECIO}`
  }

  // Paradas intermedias
  const intermedias = recorrido.slice(1, -1)
  if (intermedias.some((p) => !p.ciudad_id || !Number.isFinite(p.minutos_desde_salida) || !Number.isFinite(p.precio_acumulado))) {
    errores.paradas = 'Completa el cantón, los minutos y el precio de cada parada'
  } else {
    const ciudades = recorrido.map((p) => p.ciudad_id).filter(Boolean)
    if (new Set(ciudades).size !== ciudades.length) errores.paradas = 'Un cantón no puede repetirse en el recorrido'
    for (let i = 1; i < recorrido.length && !errores.paradas; i++) {
      if (recorrido[i].minutos_desde_salida <= recorrido[i - 1].minutos_desde_salida ||
          recorrido[i].precio_acumulado <= recorrido[i - 1].precio_acumulado) {
        errores.paradas = 'Los minutos y los precios acumulados deben aumentar en cada parada hasta el destino'
      }
    }
  }

  // Cantones activos del catálogo
  const ids = [...new Set(recorrido.map((p) => p.ciudad_id).filter(Boolean))]
  if (ids.length) {
    const { rows } = await pool.query('SELECT id FROM ciudad WHERE id = ANY($1::int[]) AND activa', [ids])
    if (rows.length !== ids.length) errores.paradas = errores.paradas || 'Algún cantón no existe o está desactivado en el catálogo'
  }

  // Misma ruta a la misma hora en la cooperativa
  if (!errores.ciudad_origen_id && !errores.ciudad_destino_id && !errores.hora_salida) {
    const { rows } = await pool.query(
      `SELECT 1 FROM frecuencia
        WHERE cooperativa_id = $1 AND ciudad_origen_id = $2 AND ciudad_destino_id = $3
          AND hora_salida = $4::time AND id <> COALESCE($5, 0)`,
      [cooperativaId, origen, destino, datos.hora_salida, idActual]
    )
    if (rows[0]) errores.hora_salida = 'Ya tienes una frecuencia con el mismo origen, destino y hora de salida'
  }

  if (Object.keys(errores).length) throw errorHttp('Revisa los datos de la frecuencia', 400, errores)
}

async function guardarParadas(cliente, frecuenciaId, recorrido) {
  await cliente.query('DELETE FROM parada WHERE frecuencia_id = $1', [frecuenciaId])
  for (const p of recorrido) {
    await cliente.query(
      `INSERT INTO parada (frecuencia_id, ciudad_id, orden, minutos_desde_salida, precio_acumulado)
       VALUES ($1, $2, $3, $4, $5)`,
      [frecuenciaId, p.ciudad_id, p.orden, p.minutos_desde_salida, p.precio_acumulado]
    )
  }
}

// ======================================
// CREAR FRECUENCIA CON PARADAS
// ======================================

async function crear(cooperativaId, datos) {
  const recorrido = armarRecorrido(datos)
  await validar(cooperativaId, datos, recorrido)
  const tipoViaje = recorrido.length > 2 ? 'con_paradas' : 'directo'

  const id = await transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO frecuencia (cooperativa_id, ciudad_origen_id, ciudad_destino_id, hora_salida,
                               numero_resolucion, fecha_resolucion, tipo_viaje)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [cooperativaId, datos.ciudad_origen_id, datos.ciudad_destino_id, datos.hora_salida,
        String(datos.numero_resolucion).trim().toUpperCase(), datos.fecha_resolucion || null, tipoViaje]
    )
    await guardarParadas(cliente, rows[0].id, recorrido)
    return rows[0].id
  })
  return obtener(cooperativaId, id)
}

// ======================================
// EDITAR FRECUENCIA (GC-21)
// ======================================

async function actualizar(cooperativaId, id, datos) {
  const actual = await obtener(cooperativaId, id)
  const recorrido = armarRecorrido(datos)
  await validar(cooperativaId, datos, recorrido, Number(id))

  // ¿Cambia algo que ya conocen los pasajeros con boleto?
  const recorridoActual = actual.paradas.map((p) => `${p.ciudad_id}|${p.minutos_desde_salida}|${Number(p.precio_acumulado).toFixed(2)}`).join(';')
  const recorridoNuevo = recorrido.map((p) => `${p.ciudad_id}|${p.minutos_desde_salida}|${p.precio_acumulado.toFixed(2)}`).join(';')
  const cambiaOperacion = recorridoActual !== recorridoNuevo || actual.hora_salida.slice(0, 5) !== datos.hora_salida
  if (cambiaOperacion && actual.boletos_futuros > 0) {
    throw errorHttp(
      `Esta frecuencia tiene ${actual.boletos_futuros} boleto(s) vendido(s) para viajes de hoy en adelante: ` +
      'no puedes cambiar la ruta, la hora ni los precios. Solo puedes corregir los datos de la resolución.',
      409
    )
  }

  await transaccion(async (cliente) => {
    await cliente.query(
      `UPDATE frecuencia
          SET ciudad_origen_id = $1, ciudad_destino_id = $2, hora_salida = $3,
              numero_resolucion = $4, fecha_resolucion = $5, tipo_viaje = $6
        WHERE id = $7 AND cooperativa_id = $8`,
      [datos.ciudad_origen_id, datos.ciudad_destino_id, datos.hora_salida,
        String(datos.numero_resolucion).trim().toUpperCase(), datos.fecha_resolucion || null,
        recorrido.length > 2 ? 'con_paradas' : 'directo', id, cooperativaId]
    )
    if (cambiaOperacion) await guardarParadas(cliente, id, recorrido)
  })
  return obtener(cooperativaId, id)
}

// ======================================
// ACTIVAR O DESACTIVAR FRECUENCIA
// ======================================

async function cambiarEstado(cooperativaId, id, activa) {
  if (!activa) {
    const actual = await obtener(cooperativaId, id)
    if (actual.boletos_futuros > 0) {
      throw errorHttp(`Esta frecuencia tiene ${actual.boletos_futuros} boleto(s) vendido(s) para viajes próximos: no se puede desactivar hasta que pasen esos viajes.`, 409)
    }
  }
  const { rows } = await pool.query(
    // GC-35: una frecuencia desactivada deja de estar destacada y libera el cupo
    `UPDATE frecuencia SET activa = $1,
            destacada = CASE WHEN $1 THEN destacada ELSE FALSE END,
            destacada_en = CASE WHEN $1 THEN destacada_en ELSE NULL END
      WHERE id = $2 AND cooperativa_id = $3 RETURNING id, activa`,
    [Boolean(activa), id, cooperativaId]
  )
  if (!rows[0]) throw errorHttp('Frecuencia no encontrada', 404)
  return rows[0]
}

// ======================================
// EXPORTAR SERVICIOS
// ======================================

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  cambiarEstado,
}
