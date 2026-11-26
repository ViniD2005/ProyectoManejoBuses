import axios from 'axios'

// Cliente HTTP común para todo el frontend.
// Uso: import api from '../services/api.js'  ->  api.get('/ciudades')
const api = axios.create({ baseURL: '/api', timeout: 30000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/*
  CC-19 - Mensajes claros para el usuario final.
  Todas las pantallas muestran err.response.data.mensaje; aquí nos aseguramos
  de que ese mensaje siempre exista y sea entendible, aunque el servidor no responda.
*/
const SIN_CONEXION = 'No pudimos conectarnos con el servidor. Revisa tu conexión a internet e inténtalo de nuevo.'
const ERROR_SERVIDOR = 'Ocurrió un problema inesperado. Inténtalo de nuevo en unos minutos.'

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (!error.response) {
      // Sin respuesta: servidor apagado, sin internet o tiempo agotado
      error.response = { status: 0, data: { mensaje: SIN_CONEXION } }
    } else {
      const { status, config } = error.response
      if (!error.response.data || typeof error.response.data !== 'object') error.response.data = {}
      if (status >= 500) error.response.data.mensaje = ERROR_SERVIDOR
      if (!error.response.data.mensaje) error.response.data.mensaje = ERROR_SERVIDOR

      // Token vencido o inválido: se cierra la sesión y se avisa a la app
      const url = config?.url || ''
      if (status === 401 && localStorage.getItem('token') && !url.includes('/auth/login') && !url.includes('/auth/perfil')) {
        localStorage.removeItem('token')
        error.response.data.mensaje = 'Tu sesión expiró. Inicia sesión nuevamente.'
        window.dispatchEvent(new Event('sesion-expirada'))
      }
    }
    return Promise.reject(error)
  }
)

// Mensaje listo para mostrar a partir de cualquier error de una petición
export const mensajeDeError = (err, porDefecto = ERROR_SERVIDOR) => err?.response?.data?.mensaje || porDefecto

export default api
