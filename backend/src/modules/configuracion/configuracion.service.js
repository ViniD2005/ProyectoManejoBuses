const { pool, transaccion } = require('../../config/db')

function errorHttp(mensaje, status, detalles) {
  const error = new Error(mensaje)
  error.status = status
  error.detalles = detalles
  return error
}

// Claves que el administrador puede editar (tabla configuracion_app)
const CLAVES = [
  'nombre_app', 'logo_url', 'color_primario', 'color_acento',
  'soporte_email', 'soporte_telefono', 'facebook_url', 'instagram_url', 'cuenta_bancaria',
]

const COLOR = /^#[0-9a-fA-F]{6}$/
const URL_WEB = /^https?:\/\/\S+$/
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Devuelve la configuración como objeto: { nombre_app: '...', color_primario: '#...', ... }
async function obtener() {
  const { rows } = await pool.query('SELECT clave, valor FROM configuracion_app')
  const configuracion = Object.fromEntries(CLAVES.map((clave) => [clave, '']))
  for (const fila of rows) {
    if (CLAVES.includes(fila.clave)) configuracion[fila.clave] = fila.valor || ''
  }
  return configuracion
}

function validar(datos) {
  const errores = {}
  if (!datos.nombre_app?.trim()) errores.nombre_app = 'El nombre de la aplicación es obligatorio'
  if (!COLOR.test(datos.color_primario || '')) errores.color_primario = 'Usa un color en formato #RRGGBB'
  if (!COLOR.test(datos.color_acento || '')) errores.color_acento = 'Usa un color en formato #RRGGBB'
  for (const clave of ['logo_url', 'facebook_url', 'instagram_url']) {
    if (datos[clave] && !URL_WEB.test(datos[clave])) errores[clave] = 'Debe ser una dirección que empiece con http:// o https://'
  }
  if (datos.soporte_email && !CORREO.test(datos.soporte_email)) errores.soporte_email = 'El correo no es válido'
  if (Object.keys(errores).length) throw errorHttp('Revisa la configuración', 400, errores)
}

// Guarda solo las claves permitidas (inserta o actualiza cada una)
async function actualizar(datos) {
  validar(datos)
  await transaccion(async (cliente) => {
    for (const clave of CLAVES) {
      if (datos[clave] === undefined) continue
      await cliente.query(
        `INSERT INTO configuracion_app (clave, valor, actualizado_en)
         VALUES ($1, $2, NOW())
         ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, actualizado_en = NOW()`,
        [clave, String(datos[clave]).trim()]
      )
    }
  })
  return obtener()
}

module.exports = { obtener, actualizar }
