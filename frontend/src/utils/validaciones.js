/*
  Validaciones en el navegador (CC-19).
  Repiten las reglas del backend (CC-21) para avisar al usuario ANTES de enviar.
  El backend vuelve a validar todo: esto solo mejora la experiencia.
  Cada función devuelve un mensaje de error o '' si el valor es correcto.
*/
const NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+(?:[ '-][A-Za-zÁÉÍÓÚáéíóúÑñÜü]+)*$/

export function cedulaValida(cedula) {
  if (!/^\d{10}$/.test(cedula)) return false
  const provincia = Number(cedula.slice(0, 2))
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false
  const d = cedula.split('').map(Number)
  if (d[2] >= 6) return false
  let suma = 0
  for (let i = 0; i < 9; i++) {
    let v = d[i] * (i % 2 === 0 ? 2 : 1)
    if (v > 9) v -= 9
    suma += v
  }
  return (10 - (suma % 10)) % 10 === d[9]
}

export function errorCedula(valor) {
  const t = String(valor || '').trim()
  if (!t) return 'La cédula es obligatoria'
  if (!/^\d+$/.test(t)) return 'La cédula solo puede contener números'
  if (t.length !== 10) return 'La cédula debe tener exactamente 10 dígitos'
  if (!cedulaValida(t)) return 'La cédula no es válida. Revisa que esté bien escrita'
  return ''
}

// campo con artículo y en plural: "tus nombres"
export function errorNombres(valor, campo) {
  const t = String(valor || '').trim().replace(/\s+/g, ' ')
  const Campo = campo.charAt(0).toUpperCase() + campo.slice(1)
  if (!t) return `Escribe ${campo}`
  if (t.length < 2) return `${Campo} deben tener al menos 2 letras`
  if (t.length > 60) return `${Campo} no pueden superar los 60 caracteres`
  if (!NOMBRE.test(t)) return `${Campo} solo pueden contener letras y espacios`
  return ''
}

export function errorCorreo(valor) {
  const t = String(valor || '').trim()
  if (!t) return 'El correo electrónico es obligatorio'
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(t)) return 'Escribe un correo válido, por ejemplo nombre@correo.com'
  return ''
}

export function errorTelefono(valor) {
  const t = String(valor || '').replace(/[\s-]/g, '')
  if (!t) return ''
  if (!/^\d+$/.test(t)) return 'El teléfono solo puede contener números'
  if (!/^09\d{8}$/.test(t) && !/^0[2-7]\d{7}$/.test(t)) {
    return 'Escribe un celular (09XXXXXXXX) o un teléfono fijo con código de provincia (02XXXXXXX)'
  }
  return ''
}

const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

// Edad cumplida hoy para una fecha 'AAAA-MM-DD'
export function edad(fecha, referencia = hoyEcuador()) {
  const [a, m, d] = fecha.split('-').map(Number)
  const [ra, rm, rd] = referencia.split('-').map(Number)
  return ra - a - (rm < m || (rm === m && rd < d) ? 1 : 0)
}

// Fecha de hoy menos n años (para el atributo max de los campos de fecha)
export function haceAnios(n) {
  const [a, m, d] = hoyEcuador().split('-')
  return `${Number(a) - n}-${m}-${d}`
}

const fechaReal = (valor) => {
  const fecha = new Date(`${valor}T12:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor
}

// GC-33: edadMinima = 18 para crear una cuenta o registrar personal
export function errorFechaNacimiento(valor, edadMinima = 0) {
  if (!valor) return 'La fecha de nacimiento es obligatoria'
  if (!fechaReal(valor)) return 'La fecha de nacimiento no es válida'
  const hoy = hoyEcuador()
  if (valor > hoy) return 'La fecha de nacimiento no puede ser futura'
  if (edad(valor, hoy) > 120) return 'Revisa el año de nacimiento'
  if (edadMinima && edad(valor, hoy) < edadMinima) return `Debe tener al menos ${edadMinima} años cumplidos`
  return ''
}

// GC-33: licencia profesional del chofer (tipo D o E, vigente y de máximo 5 años)
export function erroresLicencia(tipo, vence) {
  const errores = {}
  if (!tipo) errores.licencia_tipo = 'Elige el tipo de licencia del chofer'
  else if (!['D', 'E'].includes(String(tipo).toUpperCase())) errores.licencia_tipo = 'Para conducir buses la licencia debe ser tipo D o E'
  if (!vence) errores.licencia_vence = 'Indica la fecha en que vence la licencia'
  else if (!fechaReal(vence)) errores.licencia_vence = 'La fecha de vencimiento no es válida'
  else if (vence <= hoyEcuador()) errores.licencia_vence = 'La licencia está vencida: el chofer no puede registrarse hasta renovarla'
  else if (vence > haceAnios(-5)) errores.licencia_vence = 'Una licencia dura máximo 5 años: revisa la fecha de vencimiento'
  return errores
}

// GC-33: estado de la licencia para mostrarlo en la lista del personal
export function estadoLicencia(vence) {
  if (!vence) return { texto: 'Sin licencia registrada', clase: 'insignia--error' }
  const dias = Math.round((new Date(`${vence}T12:00:00Z`) - new Date(`${hoyEcuador()}T12:00:00Z`)) / 86400000)
  if (dias <= 0) return { texto: `Licencia vencida (${vence})`, clase: 'insignia--error' }
  if (dias <= 30) return { texto: `Licencia vence en ${dias} día(s)`, clase: 'insignia--aviso' }
  return { texto: `Licencia vigente hasta ${vence}`, clase: 'insignia--exito' }
}

// Requisitos de la contraseña, para mostrarlos con check mientras se escribe
export const requisitosContrasena = (clave) => [
  { texto: 'Al menos 8 caracteres', cumple: clave.length >= 8 },
  { texto: 'Una letra mayúscula', cumple: /[A-ZÁÉÍÓÚÑ]/.test(clave) },
  { texto: 'Una letra minúscula', cumple: /[a-záéíóúñ]/.test(clave) },
  { texto: 'Un número', cumple: /\d/.test(clave) },
]

export function errorContrasena(valor) {
  if (!valor) return 'La contraseña es obligatoria'
  if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (valor.length > 64) return 'La contraseña no puede superar los 64 caracteres'
  if (requisitosContrasena(valor).some((r) => !r.cumple)) {
    return 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número'
  }
  return ''
}
