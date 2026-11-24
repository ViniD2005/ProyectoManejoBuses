/*
  GC-13: marcas de chasis y de carrocería.
  Las administra el admin y las cooperativas solo las eligen de una lista,
  así una misma marca nunca queda escrita de dos formas distintas.
*/
const { pool, transaccion } = require('../../config/db')
const { validarTexto } = require('../../utils/validaciones')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const TIPOS = { chasis: 'chasis', carroceria: 'carrocería' }

const CAMPOS = `m.id, m.tipo, m.nombre, m.activa,
                (SELECT COUNT(*) FROM bus b
                  WHERE (m.tipo = 'chasis' AND b.marca_chasis = m.nombre)
                     OR (m.tipo = 'carroceria' AND b.marca_carroceria = m.nombre))::int AS buses`

async function validar(datos, idActual = null) {
  const errores = {}
  if (!TIPOS[datos.tipo]) errores.tipo = 'Elige si es una marca de chasis o de carrocería'
  const nombre = String(datos.nombre ?? '').trim().replace(/\s+/g, ' ')
  const errorNombre = validarTexto(nombre, 'el nombre de la marca', { min: 2, max: 40 })
  if (errorNombre) errores.nombre = errorNombre
  if (!Object.keys(errores).length) {
    const { rows } = await pool.query(
      'SELECT id FROM marca WHERE tipo = $1 AND LOWER(nombre) = LOWER($2) AND ($3::int IS NULL OR id <> $3)',
      [datos.tipo, nombre, idActual]
    )
    if (rows[0]) errores.nombre = `La marca de ${TIPOS[datos.tipo]} ${nombre} ya está registrada`
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos de la marca', 400, errores)
  return nombre
}

// Para las cooperativas: solo marcas activas. ?tipo=chasis|carroceria
async function listar({ tipo } = {}) {
  const { rows } = await pool.query(
    `SELECT m.id, m.tipo, m.nombre FROM marca m
      WHERE m.activa AND ($1::text IS NULL OR m.tipo = $1)
      ORDER BY m.tipo, m.nombre`,
    [TIPOS[tipo] ? tipo : null]
  )
  return rows
}

async function listarGestion() {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM marca m ORDER BY m.tipo, m.nombre`)
  return rows
}

async function obtener(id) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM marca m WHERE m.id = $1`, [id])
  if (!rows[0]) throw errorHttp('Marca no encontrada', 404)
  return rows[0]
}

async function crear(datos) {
  const nombre = await validar(datos)
  const { rows } = await pool.query('INSERT INTO marca (tipo, nombre) VALUES ($1, $2) RETURNING id', [datos.tipo, nombre])
  return obtener(rows[0].id)
}

// Al corregir el nombre, los buses que la usan quedan con el nombre corregido
async function actualizar(id, datos) {
  const actual = await obtener(id)
  const nombre = await validar({ ...datos, tipo: actual.tipo }, Number(id))
  const columna = actual.tipo === 'chasis' ? 'marca_chasis' : 'marca_carroceria'
  await transaccion(async (cliente) => {
    await cliente.query('UPDATE marca SET nombre = $1 WHERE id = $2', [nombre, id])
    await cliente.query(`UPDATE bus SET ${columna} = $1 WHERE ${columna} = $2`, [nombre, actual.nombre])
  })
  return obtener(id)
}

async function cambiarEstado(id, activa) {
  await obtener(id)
  await pool.query('UPDATE marca SET activa = $1 WHERE id = $2', [Boolean(activa), id])
  return obtener(id)
}

// Usada por buses.service: la marca debe existir en el catálogo y estar activa
async function existeActiva(tipo, nombre) {
  const { rows } = await pool.query('SELECT 1 FROM marca WHERE tipo = $1 AND nombre = $2 AND activa', [tipo, String(nombre ?? '').trim()])
  return Boolean(rows[0])
}

module.exports = { listar, listarGestion, obtener, crear, actualizar, cambiarEstado, existeActiva }
