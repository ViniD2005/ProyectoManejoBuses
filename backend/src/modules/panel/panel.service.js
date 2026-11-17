const { pool } = require('../../config/db')

/*
  GC-9: panel de inicio del personal de una cooperativa.
  Todo se calcula SOLO con los datos de la cooperativa del usuario
  (cooperativa_id del token), con la fecha de Ecuador.
*/
async function resumen(cooperativaId) {
  const [cooperativa, indicadores, proximos, manana] = await Promise.all([
    pool.query(
      `SELECT id, nombre, logo_url, eslogan, color_primario
         FROM cooperativa WHERE id = $1`,
      [cooperativaId]
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM viaje v JOIN frecuencia f ON f.id = v.frecuencia_id
           WHERE f.cooperativa_id = $1 AND v.fecha = CURRENT_DATE AND v.estado <> 'cancelado')::int AS viajes_hoy,

         (SELECT COUNT(*) FROM boleto b JOIN viaje v ON v.id = b.viaje_id JOIN frecuencia f ON f.id = v.frecuencia_id
           WHERE f.cooperativa_id = $1 AND b.creado_en::date = CURRENT_DATE AND b.estado <> 'anulado')::int AS boletos_hoy,

         (SELECT COALESCE(SUM(b.precio_final), 0) FROM boleto b
             JOIN compra c ON c.id = b.compra_id
             JOIN viaje v ON v.id = b.viaje_id JOIN frecuencia f ON f.id = v.frecuencia_id
           WHERE f.cooperativa_id = $1 AND c.creado_en::date = CURRENT_DATE
             AND c.estado_pago = 'aprobado' AND b.estado <> 'anulado')::numeric(10,2) AS ingresos_hoy,

         (SELECT COUNT(DISTINCT c.id) FROM compra c
             JOIN boleto b ON b.compra_id = c.id
             JOIN viaje v ON v.id = b.viaje_id JOIN frecuencia f ON f.id = v.frecuencia_id
           WHERE f.cooperativa_id = $1 AND c.estado_pago = 'en_revision')::int AS pagos_por_validar,

         (SELECT COUNT(*) FROM acceso_pasajero a
             JOIN boleto b ON b.id = a.boleto_id
             JOIN viaje v ON v.id = b.viaje_id JOIN frecuencia f ON f.id = v.frecuencia_id
           WHERE f.cooperativa_id = $1 AND a.fecha::date = CURRENT_DATE)::int AS abordados_hoy,

         (SELECT COUNT(*) FROM bus WHERE cooperativa_id = $1 AND activo)::int AS buses_activos,

         (SELECT COUNT(*) FROM frecuencia WHERE cooperativa_id = $1 AND activa)::int AS frecuencias_activas,

         (SELECT COUNT(*) FROM usuario u JOIN rol r ON r.id = u.rol_id
           WHERE u.cooperativa_id = $1 AND u.activo AND r.nombre IN ('oficinista', 'personal_bus'))::int AS personal_activo`,
      [cooperativaId]
    ),
    pool.query(
      `SELECT v.id, v.estado, to_char(f.hora_salida, 'HH24:MI') AS hora_salida,
              co.nombre AS origen, cd.nombre AS destino,
              b.numero_disco, b.placa,
              (SELECT COUNT(*) FROM asiento a WHERE a.bus_id = b.id)::int AS capacidad,
              (SELECT COUNT(DISTINCT bo.asiento_id) FROM boleto bo
                WHERE bo.viaje_id = v.id AND bo.estado <> 'anulado')::int AS vendidos
         FROM viaje v
         JOIN frecuencia f ON f.id = v.frecuencia_id
         JOIN ciudad co ON co.id = f.ciudad_origen_id
         JOIN ciudad cd ON cd.id = f.ciudad_destino_id
         JOIN bus b ON b.id = v.bus_id
        WHERE f.cooperativa_id = $1 AND v.fecha = CURRENT_DATE AND v.estado <> 'cancelado'
        ORDER BY f.hora_salida
        LIMIT 8`,
      [cooperativaId]
    ),
    pool.query(
      `SELECT COUNT(*)::int AS viajes
         FROM viaje v JOIN frecuencia f ON f.id = v.frecuencia_id
        WHERE f.cooperativa_id = $1 AND v.fecha = CURRENT_DATE + 1 AND v.estado <> 'cancelado'`,
      [cooperativaId]
    ),
  ])

  const datos = indicadores.rows[0]
  return {
    cooperativa: cooperativa.rows[0] || null,
    indicadores: { ...datos, ingresos_hoy: Number(datos.ingresos_hoy) },
    proximos_viajes: proximos.rows,
    viajes_manana: manana.rows[0].viajes,
  }
}

module.exports = { resumen }
