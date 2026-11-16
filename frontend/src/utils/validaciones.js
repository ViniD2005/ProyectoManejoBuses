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

export function errorFechaNacimiento(valor) {
  if (!valor) return 'La fecha de nacimiento es obligatoria'
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
  if (valor > hoy) return 'La fecha de nacimiento no puede ser futura'
  if (Number(hoy.slice(0, 4)) - Number(valor.slice(0, 4)) > 120) return 'Revisa el año de nacimiento'
  return ''
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
