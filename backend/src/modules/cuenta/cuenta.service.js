const bcrypt = require('bcryptjs')
const { pool } = require('../../config/db')
const { agregar, validarTelefono, validarFechaNacimiento, validarContrasena } = require('../../utils/validaciones')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

/*
  GC-36 - Mi cuenta (todos los roles).
    · Ver sus datos.
    · Cambiar su celular.
    · Registrar su fecha de nacimiento SOLO si no la tiene (después no se cambia,
      porque de ella dependen los descuentos por edad).
    · Cambiar su contraseña escribiendo la actual.
  La cédula, los nombres y el correo no se cambian aquí: identifican a la persona.
*/
// Años cumplidos hoy (Ecuador) para una fecha 'AAAA-MM-DD'
function edad(fecha) {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
  const [a, m, d] = fecha.split('-').map(Number)
  const [ha, hm, hd] = hoy.split('-').map(Number)
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
}

async function obtener(usuarioId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.cedula, u.nombres, u.apellidos, u.email, u.telefono,
            u.fecha_nacimiento::text AS fecha_nacimiento, u.creado_en,
            r.nombre AS rol, c.nombre AS cooperativa
       FROM usuario u
       JOIN rol r ON r.id = u.rol_id
       LEFT JOIN cooperativa c ON c.id = u.cooperativa_id
      WHERE u.id = $1 AND u.activo`,
    [usuarioId]
  )
  if (!rows[0]) throw errorHttp('Tu cuenta no existe o está desactivada', 404)
  return rows[0]
}

async function actualizar(usuarioId, datos = {}) {
  const actual = await obtener(usuarioId)
  const errores = {}
  const telefono = String(datos.telefono ?? '').replace(/[\s-]/g, '')
  agregar(errores, 'telefono', validarTelefono(telefono))

  let fecha = actual.fecha_nacimiento
  if (datos.fecha_nacimiento && datos.fecha_nacimiento !== actual.fecha_nacimiento) {
    if (actual.fecha_nacimiento) {
      errores.fecha_nacimiento = 'La fecha de nacimiento ya está registrada y no se puede cambiar. Si hay un error, escribe a soporte.'
    } else {
      agregar(errores, 'fecha_nacimiento', validarFechaNacimiento(datos.fecha_nacimiento))
      // Quien tiene cuenta debe ser mayor de edad, igual que al registrarse
      if (!errores.fecha_nacimiento && edad(datos.fecha_nacimiento) < 18) errores.fecha_nacimiento = 'Debes tener al menos 18 años cumplidos'
      fecha = datos.fecha_nacimiento
    }
  }
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados', 400, errores)

  await pool.query('UPDATE usuario SET telefono = $1, fecha_nacimiento = $2 WHERE id = $3', [telefono || null, fecha, usuarioId])
  return obtener(usuarioId)
}

async function cambiarContrasena(usuarioId, { actual, nueva, confirmar } = {}) {
  const errores = {}
  if (!actual) errores.actual = 'Escribe tu contraseña actual'
  agregar(errores, 'nueva', validarContrasena(nueva))
  if (!errores.nueva && nueva !== confirmar) errores.confirmar = 'Las contraseñas no coinciden'
  if (!errores.nueva && actual && nueva === actual) errores.nueva = 'La nueva contraseña debe ser distinta de la actual'
  if (Object.keys(errores).length) throw errorHttp('Revisa los datos marcados', 400, errores)

  const { rows } = await pool.query('SELECT password_hash FROM usuario WHERE id = $1 AND activo', [usuarioId])
  if (!rows[0]) throw errorHttp('Tu cuenta no existe o está desactivada', 404)
  if (!(await bcrypt.compare(actual, rows[0].password_hash))) {
    throw errorHttp('Revisa los datos marcados', 400, { actual: 'La contraseña actual no es correcta' })
  }
  const hash = await bcrypt.hash(nueva, 10)
  await pool.query('UPDATE usuario SET password_hash = $1 WHERE id = $2', [hash, usuarioId])
  await pool.query(
    "INSERT INTO notificacion (usuario_id, titulo, mensaje) VALUES ($1, 'Contraseña actualizada', 'Cambiaste tu contraseña. Si no fuiste tú, comunícate con soporte.')",
    [usuarioId]
  )
  return { mensaje: 'Tu contraseña se cambió correctamente' }
}

module.exports = { obtener, actualizar, cambiarContrasena }
