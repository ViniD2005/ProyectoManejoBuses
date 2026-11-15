/*
  CC-24 - Tema de la cooperativa.
  Aplica los colores de la cooperativa del usuario a toda la aplicación
  (variables CSS --coop-primario y --coop-acento) y publica su nombre y logo
  para que el menú los muestre (evento "apariencia-cooperativa").
*/
export const EVENTO_APARIENCIA = 'apariencia-cooperativa'

export function aplicarTema(cooperativa) {
  const raiz = document.documentElement.style
  if (cooperativa?.color_primario) raiz.setProperty('--coop-primario', cooperativa.color_primario)
  if (cooperativa?.color_acento) raiz.setProperty('--coop-acento', cooperativa.color_acento)
  window.__aparienciaCooperativa = cooperativa
    ? { nombre: cooperativa.nombre, logo_url: cooperativa.logo_url, eslogan: cooperativa.eslogan }
    : null
  window.dispatchEvent(new Event(EVENTO_APARIENCIA))
}

export function limpiarTema() {
  const raiz = document.documentElement.style
  raiz.removeProperty('--coop-primario')
  raiz.removeProperty('--coop-acento')
  window.__aparienciaCooperativa = null
  window.dispatchEvent(new Event(EVENTO_APARIENCIA))
}
