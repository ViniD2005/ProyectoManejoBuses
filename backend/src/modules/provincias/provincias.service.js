/*
  GC-13: provincias del Ecuador, administradas por el admin.
  Si mañana se crea una provincia nueva, se agrega desde la aplicación
  sin llamar a un desarrollador.
*/
const { pool, transaccion } = require('../../config/db')
const { limpiar } = require('../../utils/validaciones')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü][A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]*$/

const CAMPOS = `p.id, p.nombre, p.activa,
                (SELECT COUNT(*) FROM ciudad c WHERE c.provincia_id = p.id)::int AS cantones`

async function validar(datos, idActual = null) {
  const nombre = limpiar(datos.nombre)
  let error = null
  if (!nombre) error = 'Escribe el nombre de la provincia'
  else if (nombre.length < 3) error = 'El nombre de la provincia debe tener al menos 3 letras'
  else if (nombre.length > 100) error = 'El nombre de la provincia no puede superar los 100 caracteres'
  else if (!NOMBRE.test(nombre)) error = 'El nombre de la provincia solo puede contener letras y espacios'
  else {
    const { rows } = await pool.query(
      'SELECT id FROM provincia WHERE LOWER(nombre) = LOWER($1) AND ($2::int IS NULL OR id <> $2)',
      [nombre, idActual]
    )
    if (rows[0]) error = `La provincia ${nombre} ya está registrada`
  }
  if (error) throw errorHttp('Revisa el nombre de la provincia', 400, { nombre: error })
  return nombre
}

// Pública: solo provincias activas (para filtros)
async function listar() {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM provincia p WHERE p.activa ORDER BY p.nombre`)
  return rows
}

async function listarGestion() {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM provincia p ORDER BY p.nombre`)
  return rows
}

async function obtener(id) {
  const { rows } = await pool.query(`SELECT ${CAMPOS} FROM provincia p WHERE p.id = $1`, [id])
  if (!rows[0]) throw errorHttp('Provincia no encontrada', 404)
  return rows[0]
}

async function crear(datos) {
  const nombre = await validar(datos)
  const { rows } = await pool.query('INSERT INTO provincia (nombre) VALUES ($1) RETURNING id', [nombre])
  return obtener(rows[0].id)
}

// Al renombrar, los cantones guardan también el nombre nuevo
async function actualizar(id, datos) {
  await obtener(id)
  const nombre = await validar(datos, Number(id))
  await transaccion(async (cliente) => {
    await cliente.query('UPDATE provincia SET nombre = $1 WHERE id = $2', [nombre, id])
    await cliente.query('UPDATE ciudad SET provincia = $1 WHERE provincia_id = $2', [nombre, id])
  })
  return obtener(id)
}

async function cambiarEstado(id, activa) {
  await obtener(id)
  await pool.query('UPDATE provincia SET activa = $1 WHERE id = $2', [Boolean(activa), id])
  return obtener(id)
}

module.exports = { listar, listarGestion, obtener, crear, actualizar, cambiarEstado }
