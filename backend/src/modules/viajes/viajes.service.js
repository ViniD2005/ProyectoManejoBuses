
const { pool } = require('../../config/db')

function errorHttp(mensaje, status = 400) {
  const error = new Error(mensaje)
  error.status = status
  return error
}

// Buscar viajes entre dos ciudades, incluso si son paradas intermedias.
async function buscarViajes(filtros) {
  const {
    origen, destino, fecha, cooperativa = null,
    tipoAsiento = null, marcaChasis = null,
    marcaCarroceria = null, tipoViaje = null,
  } = filtros

  const sql = `
    SELECT v.id, v.fecha::text AS fecha,
           f.hora_salida::text AS hora_salida,
           f.tipo_viaje,
           c.id AS cooperativa_id, c.nombre AS cooperativa,
           b.id AS bus_id, b.numero_disco, b.placa,
           b.marca_chasis, b.marca_carroceria,
           b.foto_url, b.pisos,
           po.orden AS orden_subida,
           pd.orden AS orden_bajada,
           po.minutos_desde_salida,
           origen_c.nombre AS origen,
           destino_c.nombre AS destino,
           disponibles.asientos_libres,
           disponibles.precio_desde,
           disponibles.tipos_asiento
    FROM viaje v
    JOIN frecuencia f ON f.id = v.frecuencia_id
    JOIN cooperativa c ON c.id = f.cooperativa_id
    JOIN bus b ON b.id = v.bus_id
      AND b.cooperativa_id = f.cooperativa_id
    JOIN parada po ON po.frecuencia_id = f.id
      AND po.ciudad_id = $1
    JOIN parada pd ON pd.frecuencia_id = f.id
      AND pd.ciudad_id = $2
    JOIN ciudad origen_c ON origen_c.id = po.ciudad_id
    JOIN ciudad destino_c ON destino_c.id = pd.ciudad_id

    CROSS JOIN LATERAL (
      SELECT COUNT(*)::integer AS asientos_libres,
             MIN(ROUND(
               (pd.precio_acumulado - po.precio_acumulado)
               * ta.factor_precio, 2
             )) AS precio_desde,
             COALESCE(
               JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
                 'id', ta.id, 'nombre', ta.nombre
               )),
               '[]'::jsonb
             ) AS tipos_asiento
      FROM asiento a
      JOIN tipo_asiento ta ON ta.id = a.tipo_asiento_id
        AND ta.cooperativa_id = f.cooperativa_id
      WHERE a.bus_id = v.bus_id
        AND ($5::integer IS NULL OR ta.id = $5)
        AND NOT EXISTS (
          SELECT 1 FROM boleto bo
          WHERE bo.viaje_id = v.id
            AND bo.asiento_id = a.id
            AND bo.estado <> 'anulado'
            AND int4range(
              bo.orden_subida, bo.orden_bajada
            ) && int4range(po.orden, pd.orden)
        )
    ) disponibles

    WHERE po.orden < pd.orden
      AND v.fecha = $3::date
      AND v.estado = 'programado'
      AND f.activa = true
      AND b.activo = true
      AND c.activa = true
      AND ($4::integer IS NULL OR c.id = $4)
      AND ($6::text IS NULL OR
        b.marca_chasis ILIKE '%' || $6 || '%')
      AND ($7::text IS NULL OR
        b.marca_carroceria ILIKE '%' || $7 || '%')
      AND ($8::text IS NULL OR f.tipo_viaje = $8)
    ORDER BY f.hora_salida, c.nombre, v.id
  `

  const parametros = [
    origen, destino, fecha, cooperativa,
    tipoAsiento, marcaChasis, marcaCarroceria, tipoViaje,
  ]

  const { rows } = await pool.query(sql, parametros)

  return rows.map((viaje) => ({
    ...viaje,
    precio_desde: viaje.precio_desde === null
      ? null : Number(viaje.precio_desde),
  }))
}

// Recuperar la información de un viaje y tramo específico.
async function obtenerTramo(viajeId, subida, bajada) {
  const { rows } = await pool.query(`
    SELECT v.id, v.fecha::text AS fecha, v.estado,
           f.id AS frecuencia_id,
           f.hora_salida::text AS hora_salida,
           f.tipo_viaje, f.numero_resolucion,
           c.id AS cooperativa_id, c.nombre AS cooperativa,
           b.id AS bus_id, b.numero_disco, b.placa,
           b.marca_chasis, b.marca_carroceria,
           b.foto_url, b.pisos,
           po.orden AS orden_subida,
           pd.orden AS orden_bajada,
           co.nombre AS origen, cd.nombre AS destino,
           po.minutos_desde_salida,
           (pd.precio_acumulado - po.precio_acumulado)
             AS precio_normal
    FROM viaje v
    JOIN frecuencia f ON f.id = v.frecuencia_id
    JOIN cooperativa c ON c.id = f.cooperativa_id
    JOIN bus b ON b.id = v.bus_id
      AND b.cooperativa_id = f.cooperativa_id
    JOIN parada po ON po.frecuencia_id = f.id
      AND po.ciudad_id = $2
    JOIN parada pd ON pd.frecuencia_id = f.id
      AND pd.ciudad_id = $3
    JOIN ciudad co ON co.id = po.ciudad_id
    JOIN ciudad cd ON cd.id = pd.ciudad_id
    WHERE v.id = $1 AND po.orden < pd.orden
  `, [viajeId, subida, bajada])

  if (!rows.length) {
    throw errorHttp('Viaje o tramo no encontrado', 404)
  }

  return rows[0]
}

// Consultar los asientos disponibles para el tramo.
async function obtenerAsientos(viajeId, subida, bajada) {
  const viaje = await obtenerTramo(viajeId, subida, bajada)

  const { rows } = await pool.query(`
    SELECT a.id, a.numero, a.piso,
           ta.id AS tipo_asiento_id,
           ta.nombre AS tipo_asiento,
           ROUND($6::numeric * ta.factor_precio, 2) AS precio,
           NOT EXISTS (
             SELECT 1 FROM boleto bo
             WHERE bo.viaje_id = $3
               AND bo.asiento_id = a.id
               AND bo.estado <> 'anulado'
               AND int4range(
                 bo.orden_subida, bo.orden_bajada
               ) && int4range($4::integer, $5::integer)
           ) AS disponible
    FROM asiento a
    JOIN tipo_asiento ta ON ta.id = a.tipo_asiento_id
      AND ta.cooperativa_id = $2
    WHERE a.bus_id = $1
    ORDER BY a.piso, a.numero
  `, [
    viaje.bus_id,
    viaje.cooperativa_id,
    viajeId,
    viaje.orden_subida,
    viaje.orden_bajada,
    viaje.precio_normal,
  ])

  return rows.map((asiento) => ({
    ...asiento,
    precio: Number(asiento.precio),
  }))
}

// Detalle con todas las paradas de la frecuencia.
async function obtenerDetalle(viajeId, subida, bajada) {
  const viaje = await obtenerTramo(viajeId, subida, bajada)

  const { rows: paradas } = await pool.query(`
    SELECT p.ciudad_id, c.nombre AS ciudad, p.orden,
           p.minutos_desde_salida, p.precio_acumulado
    FROM parada p
    JOIN ciudad c ON c.id = p.ciudad_id
    WHERE p.frecuencia_id = $1
    ORDER BY p.orden
  `, [viaje.frecuencia_id])

  const asientos = await obtenerAsientos(
    viajeId, subida, bajada
  )

  const libres = asientos.filter(
    (asiento) => asiento.disponible
  )

  return {
    ...viaje,
    precio_normal: Number(viaje.precio_normal),
    paradas: paradas.map((parada) => ({
      ...parada,
      precio_acumulado: Number(parada.precio_acumulado),
    })),
    asientos_libres: libres.length,
    precio_desde: libres.length
      ? Math.min(...libres.map((a) => a.precio))
      : null,
  }
}

module.exports = {
  buscarViajes,
  obtenerDetalle,
  obtenerAsientos,
}
