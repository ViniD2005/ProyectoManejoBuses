const { pool, transaccion } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-35 - Rutas destacadas.
    · Administrador: registra el plan de cada cooperativa (cuántas rutas y hasta qué fecha).
      El pago se hace por fuera del sistema.
    · Cooperativa: marca o desmarca sus frecuencias destacadas sin pasar el cupo.
    · Cliente: en la búsqueda, los viajes destacados salen primero (viajes.service).
  Un plan está VIGENTE si tiene cupo > 0 y la fecha "hasta" es hoy o posterior.
*/
const MAXIMO = 20
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

const PLAN = `
  SELECT c.id, c.nombre, c.activa, c.rutas_destacadas, c.destacadas_hasta::text AS destacadas_hasta,
         (c.rutas_destacadas > 0 AND c.destacadas_hasta >= $1::date) AS vigente,
         (SELECT COUNT(*)::int FROM frecuencia f WHERE f.cooperativa_id = c.id AND f.destacada) AS usadas
    FROM cooperativa c`

// ── Administrador ─────────────────────────────────────────────────
async function listarPlanes() {
  const { rows } = await pool.query(`${PLAN} ORDER BY c.nombre`, [hoyEcuador()])
  return rows
}

async function plan(cooperativaId, db = pool) {
  const { rows } = await db.query(`${PLAN} WHERE c.id = $2`, [hoyEcuador(), cooperativaId])
  if (!rows[0]) throw errorHttp('Cooperativa no encontrada', 404)
  return rows[0]
}

function validarPlan({ cantidad, hasta }) {
  const errores = {}
  const n = Number(cantidad)
  if (cantidad === '' || cantidad === null || cantidad === undefined) errores.cantidad = 'Escribe cuántas rutas puede destacar (0 para quitar el plan)'
  else if (!Number.isInteger(n)) errores.cantidad = 'La cantidad debe ser un número entero'
  else if (n < 0 || n > MAXIMO) errores.cantidad = `La cantidad debe estar entre 0 y ${MAXIMO}`

  let fecha = null
  if (!errores.cantidad && n > 0) {
    const hoy = hoyEcuador()
    const limite = new Date(`${hoy}T12:00:00Z`)
    limite.setUTCFullYear(limite.getUTCFullYear() + 1)
    const maximo = limite.toISOString().slice(0, 10)
    if (!hasta) errores.hasta = 'Indica hasta qué fecha está pagado el plan'
    else if (!FECHA.test(hasta) || Number.isNaN(Date.parse(hasta))) errores.hasta = 'La fecha no es válida'
    else if (hasta < hoy) errores.hasta = 'La fecha no puede ser anterior a hoy'
    else if (hasta > maximo) errores.hasta = 'El plan puede registrarse por máximo un año'
    else fecha = hasta
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos del plan', 400, errores)
  return { cantidad: n, hasta: fecha }
}

/*
  Guarda el plan. Si la nueva cantidad es menor que las rutas ya destacadas,
  se quitan las marcadas más recientemente y se avisa a la cooperativa.
*/
async function guardarPlan(cooperativaId, datos) {
  const { cantidad, hasta } = validarPlan(datos || {})
  return transaccion(async (cliente) => {
    const actual = await plan(cooperativaId, cliente)
    await cliente.query('UPDATE cooperativa SET rutas_destacadas = $1, destacadas_hasta = $2 WHERE id = $3', [cantidad, hasta, cooperativaId])

    let quitadas = []
    if (actual.usadas > cantidad) {
      const { rows } = await cliente.query(
        `UPDATE frecuencia SET destacada = FALSE, destacada_en = NULL
          WHERE id IN (SELECT id FROM frecuencia WHERE cooperativa_id = $1 AND destacada
                        ORDER BY destacada_en DESC NULLS LAST, id DESC LIMIT $2)
          RETURNING id`,
        [cooperativaId, actual.usadas - cantidad]
      )
      quitadas = rows.map((r) => r.id)
    }

    const mensaje = cantidad === 0
      ? 'Tu cooperativa ya no tiene rutas destacadas.'
      : `Puedes destacar hasta ${cantidad} ruta(s) hasta el ${hasta}.` +
        (quitadas.length ? ` Se quitaron ${quitadas.length} ruta(s) destacada(s) porque superaban el nuevo cupo.` : '')
    await cliente.query(
      `INSERT INTO notificacion (usuario_id, titulo, mensaje)
       SELECT u.id, 'Plan de rutas destacadas actualizado', $2
         FROM usuario u JOIN rol r ON r.id = u.rol_id
        WHERE r.nombre = 'cooperativa' AND u.cooperativa_id = $1 AND u.activo`,
      [cooperativaId, mensaje]
    )
    return { ...(await plan(cooperativaId, cliente)), quitadas: quitadas.length }
  })
}

// ── Cooperativa ───────────────────────────────────────────────────
async function marcar(cooperativaId, frecuenciaId, { destacada }) {
  if (typeof destacada !== 'boolean') throw errorHttp('Indica si la ruta queda destacada (true o false)', 400)
  return transaccion(async (cliente) => {
    // Bloquea la cooperativa para que dos marcas simultáneas no pasen el cupo
    await cliente.query('SELECT id FROM cooperativa WHERE id = $1 FOR UPDATE', [cooperativaId])
    const f = await cliente.query(
      `SELECT f.id, f.activa, f.destacada, co.nombre || ' → ' || cd.nombre AS ruta, f.hora_salida::text AS hora
         FROM frecuencia f
         JOIN ciudad co ON co.id = f.ciudad_origen_id JOIN ciudad cd ON cd.id = f.ciudad_destino_id
        WHERE f.id = $1 AND f.cooperativa_id = $2`,
      [frecuenciaId, cooperativaId]
    )
    const frecuencia = f.rows[0]
    if (!frecuencia) throw errorHttp('Frecuencia no encontrada', 404)

    if (destacada && !frecuencia.destacada) {
      const p = await plan(cooperativaId, cliente)
      if (p.rutas_destacadas === 0) {
        throw errorHttp('Tu cooperativa no tiene permiso para destacar rutas. Contrata un plan con el administrador del sistema.', 403)
      }
      if (!p.vigente) throw errorHttp(`Tu plan de rutas destacadas venció el ${p.destacadas_hasta}. Renuévalo con el administrador del sistema.`, 403)
      if (!frecuencia.activa) throw errorHttp('Activa la frecuencia antes de destacarla', 409)
      if (p.usadas >= p.rutas_destacadas) {
        throw errorHttp(`Ya usaste tus ${p.rutas_destacadas} ruta(s) destacada(s). Quita una para destacar esta o amplía tu plan.`, 409)
      }
    }
    await cliente.query(
      `UPDATE frecuencia SET destacada = $1, destacada_en = CASE WHEN $1 THEN COALESCE(destacada_en, NOW()) ELSE NULL END WHERE id = $2`,
      [destacada, frecuenciaId]
    )
    return { id: frecuencia.id, destacada, ruta: frecuencia.ruta, plan: await plan(cooperativaId, cliente) }
  })
}

module.exports = { listarPlanes, plan, guardarPlan, marcar }
