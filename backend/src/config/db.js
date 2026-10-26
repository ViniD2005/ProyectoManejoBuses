const { Pool, types } = require('pg')

// DATE se devuelve como texto 'YYYY-MM-DD' (sin desfase de zona horaria)
types.setTypeParser(1082, (valor) => valor)
// NUMERIC (precios) se devuelve como número
types.setTypeParser(1700, (valor) => (valor === null ? null : Number(valor)))

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

// Consulta simple: db.query('SELECT ... WHERE id = $1', [id])
const query = (texto, parametros) => pool.query(texto, parametros)

// Varias consultas en una sola transacción; si algo falla se hace ROLLBACK.
//   await transaccion(async (cliente) => { await cliente.query(...) })
async function transaccion(callback) {
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const resultado = await callback(cliente)
    await cliente.query('COMMIT')
    return resultado
  } catch (error) {
    await cliente.query('ROLLBACK')
    throw error
  } finally {
    cliente.release()
  }
}

// Sirve para las dos formas de importar que ya usa el equipo:
//   const pool = require('../../config/db')      -> pool.query(...)
//   const { pool } = require('../../config/db')  -> pool.query(...)
module.exports = { pool, query, transaccion }
