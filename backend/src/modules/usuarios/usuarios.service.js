const bcrypt = require('bcryptjs')
const { pool } = require('../../config/db')
const { validarCedula } = require('../../utils/cedula')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

// Roles que puede crear cada tipo de usuario (CC-16)
const ROLES_PERMITIDOS = {
  admin: ['admin', 'cooperativa', 'oficinista', 'personal_bus'],
  cooperativa: ['oficinista', 'personal_bus'],
}
const ROLES_CON_COOPERATIVA = ['cooperativa', 'oficinista', 'personal_bus']

/*
  Lista de usuarios internos (no clientes).
  - admin: todos los usuarios internos de todas las cooperativas
  - cooperativa: solo oficinistas y personal del bus de su cooperativa
*/
async function listar(solicitante) {
  const soloSuCooperativa = solicitante.rol === 'cooperativa'
  const { rows } = await pool.query(
    `SELECT u.id, u.cedula, u.nombres, u.apellidos, u.email, u.telefono, u.activo, u.creado_en,
            r.nombre AS rol, u.cooperativa_id, c.nombre AS cooperativa
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN cooperativa c ON c.id = u.cooperativa_id
      WHERE r.nombre <> 'cliente'
        AND ($1::boolean = FALSE OR (u.cooperativa_id = $2 AND r.nombre IN ('oficinista', 'personal_bus')))
      ORDER BY c.nombre NULLS FIRST, r.id, u.apellidos`,
    [soloSuCooperativa, solicitante.cooperativa_id]
  )
  return rows
}

async function crear(solicitante, datos) {
  const permitidos = ROLES_PERMITIDOS[solicitante.rol] || []
  const errores = {}
  if (!permitidos.includes(datos.rol)) errores.rol = 'No puedes crear usuarios con ese rol'
  if (!validarCedula(datos.cedula)) errores.cedula = 'La cédula no es válida'
  if (!datos.nombres?.trim()) errores.nombres = 'Los nombres son obligatorios'
  if (!datos.apellidos?.trim()) errores.apellidos = 'Los apellidos son obligatorios'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email || '')) errores.email = 'El correo no es válido'
  if (!datos.password || datos.password.length < 8) errores.password = 'Mínimo 8 caracteres'

  // La cooperativa crea siempre en la suya; el admin la elige
  const cooperativaId = solicitante.rol === 'cooperativa'
    ? solicitante.cooperativa_id
    : (ROLES_CON_COOPERATIVA.includes(datos.rol) ? Number(datos.cooperativa_id) || null : null)
  if (ROLES_CON_COOPERATIVA.includes(datos.rol) && !cooperativaId) {
    errores.cooperativa_id = 'Elige la cooperativa'
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos del usuario', 400, errores)

  const hash = await bcrypt.hash(datos.password, 10)
  const { rows } = await pool.query(
    `INSERT INTO usuario (rol_id, cooperativa_id, cedula, nombres, apellidos, email, telefono, password_hash)
     VALUES ((SELECT id FROM rol WHERE nombre = $1), $2, $3, $4, $5, LOWER($6), $7, $8)
     RETURNING id`,
    [datos.rol, cooperativaId, datos.cedula, datos.nombres.trim(), datos.apellidos.trim(),
      datos.email.trim(), datos.telefono || null, hash]
  )
  return (await listar({ rol: 'admin' })).find((u) => u.id === rows[0].id)
}

async function cambiarEstado(solicitante, id, activo) {
  if (Number(id) === solicitante.id) throw errorHttp('No puedes desactivar tu propio usuario', 409)
  const visibles = await listar(solicitante)
  if (!visibles.some((u) => u.id === Number(id))) throw errorHttp('Usuario no encontrado', 404)
  await pool.query('UPDATE usuario SET activo = $1 WHERE id = $2', [Boolean(activo), id])
  return (await listar(solicitante)).find((u) => u.id === Number(id))
}

module.exports = { listar, crear, cambiarEstado }
