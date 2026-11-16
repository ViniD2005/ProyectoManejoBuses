/*
  Formatos comunes de las pantallas del cliente (CC-20).
*/

// Fecha de hoy en Ecuador, AAAA-MM-DD
export const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })

// Suma días a una fecha AAAA-MM-DD
export function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T12:00:00`)
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('en-CA')
}

// "sábado, 14 de noviembre"
export const fechaLarga = (fecha) =>
  fecha ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' }) : ''

// "sáb 14 nov"
export const fechaCorta = (fecha) =>
  fecha ? new Date(`${fecha}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric', month: 'short' }) : ''

// "$12.50"
export const dinero = (valor) => `$${Number(valor || 0).toFixed(2)}`

// Hora de salida de la frecuencia + minutos hasta la parada -> "HH:MM"
export function horaEnParada(horaSalida, minutos = 0) {
  if (!horaSalida) return ''
  const [h, m] = horaSalida.split(':').map(Number)
  const total = h * 60 + m + Number(minutos || 0)
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// 210 -> "3 h 30 min"
export function duracion(minutos) {
  if (!minutos && minutos !== 0) return ''
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ') || '0 min'
}

// Iniciales de una cooperativa para su insignia cuando no tiene logo
export const iniciales = (nombre = '') =>
  nombre.replace(/^Cooperativa\s+/i, '').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

export const NOMBRE_TIPO_VIAJE = { directo: 'Directo', con_paradas: 'Con paradas' }
