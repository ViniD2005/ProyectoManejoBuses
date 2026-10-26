/**
 * Valida una cédula ecuatoriana de persona natural (algoritmo módulo 10).
 * - 10 dígitos numéricos
 * - Provincia (2 primeros dígitos) entre 01 y 24, o 30 (ecuatorianos en el exterior)
 * - Tercer dígito menor a 6
 * - Dígito verificador correcto
 */
function validarCedula(cedula) {
  if (typeof cedula !== 'string' || !/^\d{10}$/.test(cedula)) return false

  const provincia = Number(cedula.slice(0, 2))
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false

  const digitos = cedula.split('').map(Number)
  if (digitos[2] >= 6) return false

  let suma = 0
  for (let i = 0; i < 9; i++) {
    let valor = digitos[i] * (i % 2 === 0 ? 2 : 1)
    if (valor > 9) valor -= 9
    suma += valor
  }
  const verificador = (10 - (suma % 10)) % 10
  return verificador === digitos[9]
}

module.exports = { validarCedula }
