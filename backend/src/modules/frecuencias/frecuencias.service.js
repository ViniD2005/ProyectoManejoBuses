
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

// ======================================
// LISTAR FRECUENCIAS
// ======================================

async function listar(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT f.id,
            f.hora_salida::text AS hora_salida,
            f.numero_resolucion,
            f.fecha_resolucion::text AS fecha_resolucion,
            f.tipo_viaje,
            f.activa,
            f.ciudad_origen_id,
            co.nombre AS origen,
            f.ciudad_destino_id,
            cd.nombre AS destino,
            (SELECT COUNT(*)::int
             FROM parada p
             WHERE p.frecuencia_id = f.id) AS total_paradas,
            (SELECT MAX(p.precio_acumulado)
             FROM parada p
             WHERE p.frecuencia_id = f.id) AS precio_total
     FROM frecuencia f
     JOIN ciudad co ON co.id = f.ciudad_origen_id
     JOIN ciudad cd ON cd.id = f.ciudad_destino_id
     WHERE f.cooperativa_id = $1
     ORDER BY f.hora_salida, co.nombre`,
    [cooperativaId]
  )

  return rows
}

// ======================================
// OBTENER FRECUENCIA Y PARADAS
// ======================================

async function obtener(cooperativaId, id) {
  const { rows } = await pool.query(
    `SELECT f.id,
            f.hora_salida::text AS hora_salida,
            f.numero_resolucion,
            f.fecha_resolucion::text AS fecha_resolucion,
            f.tipo_viaje,
            f.activa,
            co.nombre AS origen,
            cd.nombre AS destino
     FROM frecuencia f
     JOIN ciudad co ON co.id = f.ciudad_origen_id
     JOIN ciudad cd ON cd.id = f.ciudad_destino_id
     WHERE f.id = $1 AND f.cooperativa_id = $2`,
    [id, cooperativaId]
  )

  if (!rows[0]) {
    throw errorHttp('Frecuencia no encontrada', 404)
  }

  const paradas = await pool.query(
    `SELECT p.orden,
            p.ciudad_id,
            c.nombre AS ciudad,
            p.minutos_desde_salida,
            p.precio_acumulado
     FROM parada p
     JOIN ciudad c ON c.id = p.ciudad_id
     WHERE p.frecuencia_id = $1
     ORDER BY p.orden`,
    [id]
  )

  return {
    ...rows[0],
    paradas: paradas.rows
  }
}

// ======================================
// ARMAR RECORRIDO COMPLETO
// ======================================

function armarRecorrido(datos) {
  const intermedias = Array.isArray(datos.paradas_intermedias)
    ? datos.paradas_intermedias
    : []

  const recorrido = [
    {
      ciudad_id: Number(datos.ciudad_origen_id),
      minutos_desde_salida: 0,
      precio_acumulado: 0
    },

    ...intermedias.map((p) => ({
      ciudad_id: Number(p.ciudad_id),
      minutos_desde_salida: Number(p.minutos_desde_salida),
      precio_acumulado: Number(p.precio_acumulado)
    })),

    {
      ciudad_id: Number(datos.ciudad_destino_id),
      minutos_desde_salida: Number(datos.duracion_minutos),
      precio_acumulado: Number(datos.precio_total)
    }
  ]

  return recorrido.map((p, i) => ({
    ...p,
    orden: i + 1
  }))
}

// ======================================
// VALIDAR FRECUENCIA Y PARADAS
// ======================================

function validar(datos, recorrido) {
  const errores = {}

  if (!datos.ciudad_origen_id) {
    errores.ciudad_origen_id =
      'Elige la ciudad de origen'
  }

  if (!datos.ciudad_destino_id) {
    errores.ciudad_destino_id =
      'Elige la ciudad de destino'
  }

  if (!/^\d{2}:\d{2}$/.test(datos.hora_salida || '')) {
    errores.hora_salida =
      'La hora debe tener formato HH:MM'
  }

  if (!datos.numero_resolucion?.trim()) {
    errores.numero_resolucion =
      'El número de resolución de la ANT es obligatorio'
  }

  if (!(Number(datos.duracion_minutos) > 0)) {
    errores.duracion_minutos =
      'La duración debe ser mayor a 0'
  }

  if (!(Number(datos.precio_total) > 0)) {
    errores.precio_total =
      'El precio total debe ser mayor a 0'
  }

  const ciudades = recorrido.map((p) => p.ciudad_id)

  if (new Set(ciudades).size !== ciudades.length) {
    errores.paradas =
      'Una ciudad no puede repetirse en el recorrido'
  }

  for (let i = 1; i < recorrido.length; i++) {
    if (
      recorrido[i].minutos_desde_salida <=
        recorrido[i - 1].minutos_desde_salida ||
      recorrido[i].precio_acumulado <=
        recorrido[i - 1].precio_acumulado
    ) {
      errores.paradas =
        'Los minutos y precios acumulados deben aumentar en cada parada hasta el destino'
      break
    }
  }

  if (Object.keys(errores).length) {
    throw errorHttp(
      'Revisa los datos de la frecuencia',
      400,
      errores
    )
  }
}

// ======================================
// CREAR FRECUENCIA CON PARADAS
// ======================================

async function crear(cooperativaId, datos) {
  const recorrido = armarRecorrido(datos)

  validar(datos, recorrido)

  const tipoViaje =
    recorrido.length > 2 ? 'con_paradas' : 'directo'

  const id = await transaccion(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO frecuencia (
        cooperativa_id,
        ciudad_origen_id,
        ciudad_destino_id,
        hora_salida,
        numero_resolucion,
        fecha_resolucion,
        tipo_viaje
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        cooperativaId,
        datos.ciudad_origen_id,
        datos.ciudad_destino_id,
        datos.hora_salida,
        datos.numero_resolucion.trim(),
        datos.fecha_resolucion || null,
        tipoViaje
      ]
    )

    const frecuenciaId = rows[0].id

    for (const parada of recorrido) {
      await cliente.query(
        `INSERT INTO parada (
          frecuencia_id,
          ciudad_id,
          orden,
          minutos_desde_salida,
          precio_acumulado
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [
          frecuenciaId,
          parada.ciudad_id,
          parada.orden,
          parada.minutos_desde_salida,
          parada.precio_acumulado
        ]
      )
    }

    return frecuenciaId
  })

  return obtener(cooperativaId, id)
}

// ======================================
// ACTIVAR O DESACTIVAR FRECUENCIA
// ======================================

async function cambiarEstado(cooperativaId, id, activa) {
  const { rows } = await pool.query(
    `UPDATE frecuencia
     SET activa = $1
     WHERE id = $2 AND cooperativa_id = $3
     RETURNING id, activa`,
    [Boolean(activa), id, cooperativaId]
  )

  if (!rows[0]) {
    throw errorHttp('Frecuencia no encontrada', 404)
  }

  return rows[0]
}

// ======================================
// EXPORTAR SERVICIOS
// ======================================

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado
}
