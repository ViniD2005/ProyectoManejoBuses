const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../../config/db')
const { validarCedula } = require('../../utils/cedula')

const ROL_CLIENTE = 5

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

const CAMPOS_PUBLICOS = `
  u.id, u.cedula, u.nombres, u.apellidos, u.email, u.telefono,
  u.fecha_nacimiento, u.cooperativa_id, r.nombre AS rol`

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, rol: usuario.rol, cooperativa_id: usuario.cooperativa_id },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )
}

async function obtenerPerfil(id) {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_PUBLICOS} FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE u.id = $1 AND u.activo`,
    [id]
  )
  if (!rows[0]) throw errorHttp('Usuario no encontrado', 404)
  return rows[0]
}

async function login({ email, password }) {
  if (!email || !password) throw errorHttp('Ingresa tu correo y contraseña', 400)

  const { rows } = await pool.query(
    `SELECT ${CAMPOS_PUBLICOS}, u.password_hash, u.activo
       FROM usuario u JOIN rol r ON r.id = u.rol_id
      WHERE LOWER(u.email) = LOWER($1)`,
    [email.trim()]
  )
  const usuario = rows[0]
  // Mismo mensaje si el correo no existe o la clave es incorrecta
  if (!usuario || !(await bcrypt.compare(password, usuario.password_hash))) {
    throw errorHttp('Correo o contraseña incorrectos', 401)
  }
  if (!usuario.activo) throw errorHttp('Tu cuenta está desactivada', 403)

  delete usuario.password_hash
  delete usuario.activo
  return { token: generarToken(usuario), usuario }
}

async function registrarCliente(datos) {
  const { cedula, nombres, apellidos, email, telefono, fecha_nacimiento, password } = datos

  const errores = {}
  if (!validarCedula(cedula)) errores.cedula = 'La cédula no es válida'
  if (!nombres?.trim()) errores.nombres = 'Ingresa tus nombres'
  if (!apellidos?.trim()) errores.apellidos = 'Ingresa tus apellidos'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) errores.email = 'El correo no es válido'
  if (!fecha_nacimiento) errores.fecha_nacimiento = 'Ingresa tu fecha de nacimiento'
  if (!password || password.length < 8) errores.password = 'Mínimo 8 caracteres'
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos del formulario', 400, errores)

  const hash = await bcrypt.hash(password, 10)
  const { rows } = await pool.query(
    `INSERT INTO usuario (rol_id, cedula, nombres, apellidos, email, telefono, fecha_nacimiento, password_hash)
     VALUES ($1, $2, $3, $4, LOWER($5), $6, $7, $8)
     RETURNING id`,
    [ROL_CLIENTE, cedula, nombres.trim(), apellidos.trim(), email.trim(), telefono || null, fecha_nacimiento, hash]
  )

  const usuario = await obtenerPerfil(rows[0].id)
  return { token: generarToken(usuario), usuario }
}

module.exports = { login, registrarCliente, obtenerPerfil }
