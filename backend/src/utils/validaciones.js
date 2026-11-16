/*
  Reglas de validación comunes del sistema (CC-21).
  Cada función devuelve un MENSAJE DE ERROR pensado para el usuario final,
  o null si el valor es correcto. Así cada servicio arma su objeto de errores:

    const errores = {}
    agregar(errores, 'nombres', validarNombrePersona(datos.nombres, 'los nombres', true))
*/
const { validarCedula } = require('./cedula')

const LETRAS = 'A-Za-zÁÉÍÓÚáéíóúÑñÜü'
const NOMBRE_PERSONA = new RegExp(`^[${LETRAS}]+(?:[ '\\-][${LETRAS}]+)*$`)
const CORREO = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/
const CELULAR = /^09\d{8}$/
const CONVENCIONAL = /^0[2-7]\d{7}$/
const PLACA = /^[A-Z]{3}-\d{3,4}$/

// Quita espacios repetidos y en los extremos
const limpiar = (valor) => String(valor ?? '').trim().replace(/\s+/g, ' ')

function agregar(errores, campo, mensaje) {
  if (mensaje && !errores[campo]) errores[campo] = mensaje
}

// Primera letra en mayúscula ("los nombres" -> "Los nombres")
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

/*
  Nombres y apellidos: solo letras (con tildes y ñ), espacios, guion o apóstrofo.
  campo: cómo se nombra en el mensaje, con artículo ("los nombres", "el nombre")
  plural: true si el campo va en plural ("los apellidos deben…")
*/
function validarNombrePersona(valor, campo = 'el nombre', plural = false) {
  const texto = limpiar(valor)
  const verbo = (singular, enPlural) => (plural ? enPlural : singular)
  if (!texto) return `Escribe ${campo}`
  if (texto.length < 2) return `${mayuscula(campo)} ${verbo('debe', 'deben')} tener al menos 2 letras`
  if (texto.length > 60) return `${mayuscula(campo)} no ${verbo('puede', 'pueden')} superar los 60 caracteres`
  if (!NOMBRE_PERSONA.test(texto)) return `${mayuscula(campo)} solo ${verbo('puede', 'pueden')} contener letras y espacios`
  return null
}

// Nombre completo de un pasajero (nombres y apellidos en un solo campo)
function validarNombreCompleto(valor) {
  const texto = limpiar(valor)
  if (!texto) return 'Escribe el nombre completo del pasajero'
  if (texto.length < 5 || !texto.includes(' ')) return 'Escribe nombre y apellido del pasajero'
  if (texto.length > 120) return 'El nombre no puede superar los 120 caracteres'
  if (!NOMBRE_PERSONA.test(texto)) return 'El nombre solo puede contener letras y espacios'
  return null
}

function validarCedulaEcuador(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return 'La cédula es obligatoria'
  if (!/^\d+$/.test(texto)) return 'La cédula solo puede contener números'
  if (texto.length !== 10) return 'La cédula debe tener exactamente 10 dígitos'
  if (!validarCedula(texto)) return 'La cédula no es válida. Revisa que esté bien escrita'
  return null
}

function validarCorreo(valor, obligatorio = true) {
  const texto = String(valor ?? '').trim()
  if (!texto) return obligatorio ? 'El correo electrónico es obligatorio' : null
  if (texto.length > 120) return 'El correo no puede superar los 120 caracteres'
  if (!CORREO.test(texto)) return 'Escribe un correo válido, por ejemplo nombre@correo.com'
  return null
}

// Teléfono de Ecuador: celular 09XXXXXXXX o convencional 0[2-7]XXXXXXX
function validarTelefono(valor, obligatorio = false) {
  const texto = String(valor ?? '').replace(/[\s-]/g, '')
  if (!texto) return obligatorio ? 'El teléfono es obligatorio' : null
  if (!/^\d+$/.test(texto)) return 'El teléfono solo puede contener números'
  if (!CELULAR.test(texto) && !CONVENCIONAL.test(texto)) {
    return 'Escribe un celular (09XXXXXXXX) o un teléfono fijo con código de provincia (02XXXXXXX)'
  }
  return null
}

// Contraseña segura: 8 a 64 caracteres, con mayúscula, minúscula y número
function validarContrasena(valor) {
  const texto = String(valor ?? '')
  if (!texto) return 'La contraseña es obligatoria'
  if (texto.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (texto.length > 64) return 'La contraseña no puede superar los 64 caracteres'
  if (!/[A-ZÁÉÍÓÚÑ]/.test(texto) || !/[a-záéíóúñ]/.test(texto) || !/\d/.test(texto)) {
    return 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número'
  }
  return null
}

// Fecha de nacimiento: fecha real, no futura y de una persona de hasta 120 años
function validarFechaNacimiento(valor, obligatorio = true) {
  if (!valor) return obligatorio ? 'La fecha de nacimiento es obligatoria' : null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(`${valor}T12:00:00Z`))) {
    return 'La fecha de nacimiento no es válida'
  }
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
  if (valor > hoy) return 'La fecha de nacimiento no puede ser futura'
  const anio = Number(valor.slice(0, 4))
  if (Number(hoy.slice(0, 4)) - anio > 120) return 'Revisa el año de nacimiento'
  return null
}

// Placa de Ecuador: tres letras, guion y 3 o 4 números (ABC-1234)
function validarPlaca(valor) {
  const texto = String(valor ?? '').trim().toUpperCase()
  if (!texto) return 'La placa es obligatoria'
  if (!PLACA.test(texto)) return 'La placa debe tener el formato ABC-1234 (tres letras, guion y 3 o 4 números)'
  return null
}

// Texto libre (marcas, nombres de tipos, etc.). campo con artículo: "la marca del chasis"
function validarTexto(valor, campo, { min = 2, max = 60 } = {}) {
  const texto = limpiar(valor)
  if (!texto) return `Escribe ${campo}`
  if (texto.length < min) return `${mayuscula(campo)} debe tener al menos ${min} caracteres`
  if (texto.length > max) return `${mayuscula(campo)} no puede superar los ${max} caracteres`
  if (/[<>{}]/.test(texto)) return `${mayuscula(campo)} contiene caracteres no permitidos`
  return null
}

module.exports = {
  limpiar,
  agregar,
  validarNombrePersona,
  validarNombreCompleto,
  validarCedulaEcuador,
  validarCorreo,
  validarTelefono,
  validarContrasena,
  validarFechaNacimiento,
  validarPlaca,
  validarTexto,
}
