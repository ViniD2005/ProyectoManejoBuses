const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../../config/db')
const {
  agregar, limpiar, validarNombrePersona, validarCedulaEcuador, validarCorreo,
  validarTelefono, validarContrasena, validarFechaNacimiento,
} = require('../../utils/validaciones')

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
  if (!email || !password) throw errorHttp('Escribe tu correo y tu contraseña para ingresar', 400)

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
  if (!usuario.activo) throw errorHttp('Tu cuenta está desactivada. Comunícate con el administrador.', 403)

  delete usuario.password_hash
  delete usuario.activo
  return { token: generarToken(usuario), usuario }
}

async function registrarCliente(datos) {
  const { cedula, nombres, apellidos, email, telefono, fecha_nacimiento, password } = datos

  // CC-21: validaciones completas con mensajes para el usuario
  const errores = {}
  agregar(errores, 'cedula', validarCedulaEcuador(cedula))
  agregar(errores, 'nombres', validarNombrePersona(nombres, 'tus nombres', true))
  agregar(errores, 'apellidos', validarNombrePersona(apellidos, 'tus apellidos', true))
  agregar(errores, 'email', validarCorreo(email))
  agregar(errores, 'telefono', validarTelefono(telefono))
  agregar(errores, 'fecha_nacimiento', validarFechaNacimiento(fecha_nacimiento))
  agregar(errores, 'password', validarContrasena(password))

  // Cédula y correo únicos: se avisa antes de intentar guardar
  if (!errores.cedula || !errores.email) {
    const { rows: existentes } = await pool.query(
      'SELECT cedula, LOWER(email) AS email FROM usuario WHERE cedula = $1 OR LOWER(email) = LOWER($2)',
      [String(cedula ?? '').trim(), String(email ?? '').trim()]
    )
    if (existentes.some((u) => u.cedula === String(cedula).trim())) {
      agregar(errores, 'cedula', 'Ya existe una cuenta registrada con esta cédula')
    }
    if (existentes.some((u) => u.email === String(email).trim().toLowerCase())) {
      agregar(errores, 'email', 'Este correo electrónico ya está registrado')
    }
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados en el formulario', 400, errores)

  const hash = await bcrypt.hash(password, 10)
  const { rows } = await pool.query(
    `INSERT INTO usuario (rol_id, cedula, nombres, apellidos, email, telefono, fecha_nacimiento, password_hash)
     VALUES ($1, $2, $3, $4, LOWER($5), $6, $7, $8)
     RETURNING id`,
    [ROL_CLIENTE, cedula.trim(), limpiar(nombres), limpiar(apellidos), email.trim(),
      telefono ? String(telefono).replace(/[\s-]/g, '') : null, fecha_nacimiento, hash]
  )

  const usuario = await obtenerPerfil(rows[0].id)
  return { token: generarToken(usuario), usuario }
}

module.exports = { login, registrarCliente, obtenerPerfil }
