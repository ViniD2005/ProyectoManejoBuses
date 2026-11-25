const { pool, transaccion } = require('../../config/db')
const { agregar, limpiar, validarTexto } = require('../../utils/validaciones')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-19 - Grupos de buses y frecuencias.
  La cooperativa separa su operación (Urbano, Interprovincial, Rural...).
  Reglas:
    - un bus y una frecuencia pertenecen a UN solo grupo;
    - la hoja de ruta se genera por grupo;
    - un grupo con hojas de ruta guardadas no se elimina (se desactiva).
*/

// Grupos de la cooperativa con el conteo de buses y frecuencias (activos y en total)
async function listar(cooperativaId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.nombre, g.descripcion, g.activo,
            (SELECT COUNT(*)::int FROM bus b WHERE b.grupo_id = g.id) AS buses,
            (SELECT COUNT(*)::int FROM bus b WHERE b.grupo_id = g.id AND b.activo) AS buses_activos,
            (SELECT COUNT(*)::int FROM frecuencia f WHERE f.grupo_id = g.id) AS frecuencias,
            (SELECT COUNT(*)::int FROM frecuencia f WHERE f.grupo_id = g.id AND f.activa) AS frecuencias_activas,
            EXISTS (SELECT 1 FROM hoja_ruta h WHERE h.grupo_id = g.id) AS tiene_hojas
       FROM grupo g
      WHERE g.cooperativa_id = $1
      ORDER BY g.activo DESC, g.nombre`,
    [cooperativaId]
  )
  return rows
}

// Todos los buses y frecuencias de la cooperativa con el grupo al que pertenecen
async function recursos(cooperativaId) {
  const buses = await pool.query(
    `SELECT b.id, b.numero_disco, b.placa, b.activo, b.grupo_id, g.nombre AS grupo,
            (SELECT COUNT(*)::int FROM asiento a WHERE a.bus_id = b.id) AS asientos
       FROM bus b LEFT JOIN grupo g ON g.id = b.grupo_id
      WHERE b.cooperativa_id = $1
      ORDER BY b.numero_disco::int`,
    [cooperativaId]
  )
  const frecuencias = await pool.query(
    `SELECT f.id, f.hora_salida::text AS hora_salida, f.tipo_viaje, f.activa, f.grupo_id, g.nombre AS grupo,
            co.nombre AS origen, cd.nombre AS destino,
            COALESCE(po.nombre || ' - ', '') || co.nombre AS origen_etiqueta,
            COALESCE(pd.nombre || ' - ', '') || cd.nombre AS destino_etiqueta
       FROM frecuencia f
       JOIN ciudad co ON co.id = f.ciudad_origen_id
       JOIN ciudad cd ON cd.id = f.ciudad_destino_id
       LEFT JOIN provincia po ON po.id = co.provincia_id
       LEFT JOIN provincia pd ON pd.id = cd.provincia_id
       LEFT JOIN grupo g ON g.id = f.grupo_id
      WHERE f.cooperativa_id = $1
      ORDER BY f.hora_salida, co.nombre`,
    [cooperativaId]
  )
  return { buses: buses.rows, frecuencias: frecuencias.rows }
}

async function obtenerPropio(cooperativaId, id) {
  const { rows } = await pool.query('SELECT * FROM grupo WHERE id = $1 AND cooperativa_id = $2', [id, cooperativaId])
  if (!rows[0]) throw errorHttp('El grupo no existe o no es de tu cooperativa', 404)
  return rows[0]
}

async function validar(cooperativaId, datos, idActual = null) {
  const errores = {}
  agregar(errores, 'nombre', validarTexto(datos.nombre, 'el nombre del grupo', { min: 3, max: 40 }))
  const descripcion = limpiar(datos.descripcion)
  if (descripcion.length > 200) errores.descripcion = 'La descripción puede tener hasta 200 caracteres'
  if (!errores.nombre) {
    const { rows } = await pool.query(
      'SELECT id FROM grupo WHERE cooperativa_id = $1 AND LOWER(nombre) = LOWER($2) AND id <> COALESCE($3, 0)',
      [cooperativaId, limpiar(datos.nombre), idActual]
    )
    if (rows[0]) errores.nombre = 'Ya tienes un grupo con este nombre'
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos del grupo', 400, errores)
  return { nombre: limpiar(datos.nombre), descripcion: descripcion || null }
}

async function crear(cooperativaId, datos) {
  const limpio = await validar(cooperativaId, datos)
  const { rows } = await pool.query(
    'INSERT INTO grupo (cooperativa_id, nombre, descripcion) VALUES ($1, $2, $3) RETURNING id',
    [cooperativaId, limpio.nombre, limpio.descripcion]
  )
  return (await listar(cooperativaId)).find((g) => g.id === rows[0].id)
}

async function actualizar(cooperativaId, id, datos) {
  await obtenerPropio(cooperativaId, id)
  const limpio = await validar(cooperativaId, datos, Number(id))
  await pool.query('UPDATE grupo SET nombre = $1, descripcion = $2 WHERE id = $3', [limpio.nombre, limpio.descripcion, id])
  return (await listar(cooperativaId)).find((g) => g.id === Number(id))
}

async function cambiarEstado(cooperativaId, id, activo) {
  await obtenerPropio(cooperativaId, id)
  await pool.query('UPDATE grupo SET activo = $1 WHERE id = $2', [Boolean(activo), id])
  return (await listar(cooperativaId)).find((g) => g.id === Number(id))
}

async function eliminar(cooperativaId, id) {
  await obtenerPropio(cooperativaId, id)
  const usado = await pool.query('SELECT 1 FROM hoja_ruta WHERE grupo_id = $1 LIMIT 1', [id])
  if (usado.rows[0]) {
    throw errorHttp('Este grupo ya tiene hojas de ruta guardadas: desactívalo en lugar de eliminarlo', 409)
  }
  // Sus buses y frecuencias quedan "sin grupo" (ON DELETE SET NULL)
  await pool.query('DELETE FROM grupo WHERE id = $1', [id])
  return { eliminado: true }
}

/*
  Define qué buses (o frecuencias) forman el grupo.
  - Solo se aceptan registros de la cooperativa.
  - Si alguno ya está en OTRO grupo se rechaza: primero hay que quitarlo de allá.
  - Los que se quitan del grupo quedan "sin grupo".
*/
async function asignar(cooperativaId, id, tabla, idsRecibidos) {
  await obtenerPropio(cooperativaId, id)
  const etiqueta = tabla === 'bus' ? 'bus' : 'frecuencia'
  if (!Array.isArray(idsRecibidos)) throw errorHttp(`Envía la lista de ${etiqueta === 'bus' ? 'buses' : 'frecuencias'}`, 400)
  const ids = [...new Set(idsRecibidos.map(Number).filter(Number.isInteger))]

  const { rows } = await pool.query(
    `SELECT t.id, t.grupo_id, g.nombre AS grupo
       FROM ${tabla} t LEFT JOIN grupo g ON g.id = t.grupo_id
      WHERE t.cooperativa_id = $1 AND t.id = ANY($2::int[])`,
    [cooperativaId, ids]
  )
  if (rows.length !== ids.length) {
    throw errorHttp(`Alguna ${etiqueta === 'bus' ? 'unidad' : 'frecuencia'} no existe o no es de tu cooperativa`, 400)
  }
  const enOtro = rows.find((r) => r.grupo_id && r.grupo_id !== Number(id))
  if (enOtro) {
    throw errorHttp(
      etiqueta === 'bus'
        ? `Uno de los buses ya pertenece al grupo "${enOtro.grupo}". Quítalo de ese grupo primero.`
        : `Una de las frecuencias ya pertenece al grupo "${enOtro.grupo}": una frecuencia solo puede estar en un grupo.`,
      409
    )
  }

  await transaccion(async (cliente) => {
    await cliente.query(
      `UPDATE ${tabla} SET grupo_id = NULL WHERE grupo_id = $1 AND NOT (id = ANY($2::int[]))`,
      [id, ids]
    )
    await cliente.query(`UPDATE ${tabla} SET grupo_id = $1 WHERE id = ANY($2::int[])`, [id, ids])
  })
  return { grupo: (await listar(cooperativaId)).find((g) => g.id === Number(id)), ...(await recursos(cooperativaId)) }
}

module.exports = {
  listar, recursos, crear, actualizar, cambiarEstado, eliminar,
  asignarBuses: (cooperativaId, id, ids) => asignar(cooperativaId, id, 'bus', ids),
  asignarFrecuencias: (cooperativaId, id, ids) => asignar(cooperativaId, id, 'frecuencia', ids),
}
