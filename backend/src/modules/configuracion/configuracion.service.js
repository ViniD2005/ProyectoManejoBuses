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
const CELULAR = /^09\d{8}$/
const CONVENCIONAL = /^0[2-7]\d{7}$/

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
  // GC-33: nombre, teléfono de soporte y cuenta bancaria con formato correcto
  const nombre = String(datos.nombre_app ?? '').trim()
  if (nombre && (nombre.length < 2 || nombre.length > 40)) errores.nombre_app = 'El nombre debe tener entre 2 y 40 caracteres'
  const telefono = String(datos.soporte_telefono ?? '').replace(/[\s-]/g, '')
  if (telefono && !CELULAR.test(telefono) && !CONVENCIONAL.test(telefono)) {
    errores.soporte_telefono = 'Escribe un celular (09XXXXXXXX) o un teléfono fijo con código de provincia (02XXXXXXX)'
  }
  const cuenta = String(datos.cuenta_bancaria ?? '').trim()
  if (cuenta.length > 200) errores.cuenta_bancaria = 'Los datos de la cuenta no pueden superar los 200 caracteres'
  else if (cuenta && !/\d{6,}/.test(cuenta.replace(/[\s-]/g, ''))) errores.cuenta_bancaria = 'Incluye el número de cuenta (al menos 6 dígitos), el banco y el titular'
  else if (/[<>{}]/.test(cuenta)) errores.cuenta_bancaria = 'Los datos de la cuenta contienen caracteres no permitidos'
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
        [clave, clave === 'soporte_telefono' ? String(datos[clave]).replace(/[\s-]/g, '') : String(datos[clave]).trim()]
      )
    }
  })
  return obtener()
}

module.exports = { obtener, actualizar }
