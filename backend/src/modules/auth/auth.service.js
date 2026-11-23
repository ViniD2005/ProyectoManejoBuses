const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { pool } = require('../../config/db')
const {
  agregar, limpiar, validarNombrePersona, validarCedulaEcuador, validarCorreo,
  validarTelefono, validarContrasena, validarFechaNacimiento,
} = require('../../utils/validaciones')
const correo = require('../../utils/correo')

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
    `SELECT ${CAMPOS_PUBLICOS}, u.password_hash, u.activo, u.correo_verificado
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
  // GC-12: el cliente que se registró solo debe confirmar su correo antes de entrar
  if (!usuario.correo_verificado) {
    throw errorHttp('Confirma tu correo para ingresar. Revisa tu bandeja de entrada (y la carpeta de spam).', 403,
      { correo_no_verificado: true, email: usuario.email })
  }

  delete usuario.password_hash
  delete usuario.activo
  delete usuario.correo_verificado
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
  // GC-12: la cuenta nace sin verificar y NO inicia sesión hasta confirmar el correo
  const { rows } = await pool.query(
    `INSERT INTO usuario (rol_id, cedula, nombres, apellidos, email, telefono, fecha_nacimiento, password_hash, correo_verificado)
     VALUES ($1, $2, $3, $4, LOWER($5), $6, $7, $8, FALSE)
     RETURNING id, nombres, email`,
    [ROL_CLIENTE, cedula.trim(), limpiar(nombres), limpiar(apellidos), email.trim(),
      telefono ? String(telefono).replace(/[\s-]/g, '') : null, fecha_nacimiento, hash]
  )

  const token = await crearToken(rows[0].id, 'verificacion')
  const correoEnviado = await correo.enviarVerificacion(rows[0], token, HORAS_VERIFICACION)
  return {
    mensaje: 'Cuenta creada. Te enviamos un correo para confirmar tu dirección.',
    email: rows[0].email,
    correo_enviado: correoEnviado,
  }
}

/*
  ── GC-12: verificación de correo y recuperación de contraseña ──────────
  Los enlaces llevan un token aleatorio de 64 caracteres. En la base solo se
  guarda su SHA-256, sirve UNA vez y vence (24 h verificación, 30 min clave).
  Pedir un enlace nuevo invalida los anteriores del mismo tipo.
*/
const HORAS_VERIFICACION = 24
const MINUTOS_RECUPERACION = 30
const ESPERA_REENVIO_SEG = 60

const hashDe = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

const fechaEcuador = (fecha = new Date()) => fecha.toLocaleString('es-EC', {
  timeZone: 'America/Guayaquil', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

async function crearToken(usuarioId, tipo) {
  const token = crypto.randomBytes(32).toString('hex')
  const vigencia = tipo === 'verificacion' ? `${HORAS_VERIFICACION} hours` : `${MINUTOS_RECUPERACION} minutes`
  await pool.query(
    `UPDATE token_correo SET usado_en = NOW() WHERE usuario_id = $1 AND tipo = $2 AND usado_en IS NULL`,
    [usuarioId, tipo]
  )
  await pool.query(
    `INSERT INTO token_correo (usuario_id, tipo, token_hash, expira_en) VALUES ($1, $2, $3, NOW() + $4::interval)`,
    [usuarioId, tipo, hashDe(token), vigencia]
  )
  return token
}

// Segundos que faltan para poder pedir otro correo del mismo tipo (0 = ya puede)
async function esperaPendiente(usuarioId, tipo) {
  const { rows } = await pool.query(
    `SELECT CEIL(EXTRACT(EPOCH FROM (MAX(creado_en) + make_interval(secs => $3) - NOW())))::int AS segundos
       FROM token_correo WHERE usuario_id = $1 AND tipo = $2`,
    [usuarioId, tipo, ESPERA_REENVIO_SEG]
  )
  return Math.max(0, rows[0]?.segundos || 0)
}

// Busca el token y explica por qué no sirve (vencido, usado, inexistente)
async function leerToken(token, tipo) {
  if (!/^[a-f0-9]{64}$/.test(String(token ?? ''))) {
    throw errorHttp('El enlace no es válido. Revisa que lo copiaste completo.', 400, { motivo: 'invalido' })
  }
  const { rows } = await pool.query(
    `SELECT t.id, t.usuario_id, t.usado_en, t.expira_en < NOW() AS vencido,
            u.nombres, u.email, u.activo, u.correo_verificado
       FROM token_correo t JOIN usuario u ON u.id = t.usuario_id
      WHERE t.token_hash = $1 AND t.tipo = $2`,
    [hashDe(token), tipo]
  )
  const fila = rows[0]
  if (!fila) throw errorHttp('El enlace no es válido o ya fue reemplazado por uno más reciente.', 400, { motivo: 'invalido' })
  if (!fila.activo) throw errorHttp('Tu cuenta está desactivada. Comunícate con el administrador.', 403, { motivo: 'desactivada' })
  return fila
}

const ocultarCorreo = (email) => email.replace(/^(.)(.*)(.@.*)$/, (_, a, medio, b) => a + '•'.repeat(Math.min(medio.length, 6)) + b)

async function verificarCorreo({ token }) {
  const fila = await leerToken(token, 'verificacion')
  if (fila.correo_verificado) {
    return { mensaje: 'Tu correo ya estaba confirmado. Ya puedes iniciar sesión.', email: fila.email, ya_verificado: true }
  }
  if (fila.usado_en) throw errorHttp('Este enlace ya no sirve porque pediste uno más reciente. Usa el último correo que te enviamos.', 410, { motivo: 'usado', email: fila.email })
  if (fila.vencido) throw errorHttp(`El enlace venció (dura ${HORAS_VERIFICACION} horas). Pide uno nuevo y confirma tu correo.`, 410, { motivo: 'vencido', email: fila.email })

  await pool.query('UPDATE token_correo SET usado_en = NOW() WHERE id = $1', [fila.id])
  await pool.query('UPDATE usuario SET correo_verificado = TRUE, correo_verificado_en = NOW() WHERE id = $1', [fila.usuario_id])
  await correo.enviarBienvenida(fila)
  return { mensaje: '¡Correo confirmado! Tu cuenta ya está activa.', email: fila.email, ya_verificado: false }
}

// Respuesta igual exista o no la cuenta: así nadie averigua qué correos están registrados
async function reenviarVerificacion({ email }) {
  const errorEmail = validarCorreo(email)
  if (errorEmail) throw errorHttp(errorEmail, 400, { email: errorEmail })
  const respuesta = { mensaje: 'Si la cuenta existe y aún no está confirmada, te enviamos un nuevo enlace. Revisa tu correo.', espera: ESPERA_REENVIO_SEG }

  const { rows } = await pool.query(
    'SELECT id, nombres, email, correo_verificado, activo FROM usuario WHERE LOWER(email) = LOWER($1)',
    [String(email).trim()]
  )
  const usuario = rows[0]
  if (!usuario || usuario.correo_verificado || !usuario.activo) return respuesta
  // Pedidos muy seguidos no envían otro correo (la pantalla ya muestra la cuenta regresiva)
  if ((await esperaPendiente(usuario.id, 'verificacion')) > 0) return respuesta

  const token = await crearToken(usuario.id, 'verificacion')
  await correo.enviarVerificacion(usuario, token, HORAS_VERIFICACION)
  return respuesta
}

async function olvideContrasena({ email }) {
  const errorEmail = validarCorreo(email)
  if (errorEmail) throw errorHttp(errorEmail, 400, { email: errorEmail })
  const respuesta = {
    mensaje: 'Si el correo pertenece a una cuenta, en unos segundos recibirás un enlace para crear una nueva contraseña.',
    espera: ESPERA_REENVIO_SEG,
    minutos: MINUTOS_RECUPERACION,
  }

  const { rows } = await pool.query(
    'SELECT id, nombres, email, activo FROM usuario WHERE LOWER(email) = LOWER($1)',
    [String(email).trim()]
  )
  const usuario = rows[0]
  if (!usuario || !usuario.activo) return respuesta
  // Si pide muchas veces seguidas no se envían más correos (pero la respuesta es la misma)
  if ((await esperaPendiente(usuario.id, 'recuperacion')) > 0) return respuesta

  const token = await crearToken(usuario.id, 'recuperacion')
  await correo.enviarRecuperacion(usuario, token, MINUTOS_RECUPERACION, { fecha: fechaEcuador() })
  return respuesta
}

// La página de nueva contraseña revisa el enlace antes de mostrar el formulario
async function revisarEnlaceRecuperacion({ token }) {
  const fila = await leerToken(token, 'recuperacion')
  if (fila.usado_en) throw errorHttp('Este enlace ya se usó o fue reemplazado por uno más reciente. Pide uno nuevo.', 410, { motivo: 'usado' })
  if (fila.vencido) throw errorHttp(`El enlace venció (dura ${MINUTOS_RECUPERACION} minutos). Pide uno nuevo.`, 410, { motivo: 'vencido' })
  return { valido: true, nombres: fila.nombres.split(' ')[0], email: ocultarCorreo(fila.email) }
}

async function restablecerContrasena({ token, password, confirmar }) {
  const fila = await leerToken(token, 'recuperacion')
  if (fila.usado_en) throw errorHttp('Este enlace ya se usó o fue reemplazado por uno más reciente. Pide uno nuevo.', 410, { motivo: 'usado' })
  if (fila.vencido) throw errorHttp(`El enlace venció (dura ${MINUTOS_RECUPERACION} minutos). Pide uno nuevo.`, 410, { motivo: 'vencido' })

  const errores = {}
  agregar(errores, 'password', validarContrasena(password))
  if (!errores.password && confirmar !== undefined && confirmar !== password) errores.confirmar = 'Las contraseñas no coinciden'
  if (!errores.password) {
    const { rows } = await pool.query('SELECT password_hash FROM usuario WHERE id = $1', [fila.usuario_id])
    if (await bcrypt.compare(password, rows[0].password_hash)) errores.password = 'La nueva contraseña debe ser distinta de la anterior'
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa la nueva contraseña', 400, errores)

  const hash = await bcrypt.hash(password, 10)
  // Cambiar la clave desde el correo también demuestra que el correo es suyo
  await pool.query(
    `UPDATE usuario SET password_hash = $1,
            correo_verificado_en = CASE WHEN correo_verificado THEN correo_verificado_en ELSE NOW() END,
            correo_verificado = TRUE
      WHERE id = $2`,
    [hash, fila.usuario_id]
  )
  await pool.query(
    `UPDATE token_correo SET usado_en = NOW() WHERE usuario_id = $1 AND tipo = 'recuperacion' AND usado_en IS NULL`,
    [fila.usuario_id]
  )
  await correo.enviarAvisoCambioClave(fila, fechaEcuador())
  return { mensaje: 'Tu contraseña se cambió correctamente. Ya puedes iniciar sesión con la nueva.', email: fila.email }
}

module.exports = {
  login, registrarCliente, obtenerPerfil,
  verificarCorreo, reenviarVerificacion, olvideContrasena, revisarEnlaceRecuperacion, restablecerContrasena,
}
