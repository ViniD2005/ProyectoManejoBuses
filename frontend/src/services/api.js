import axios from 'axios'

// Cliente HTTP común para todo el frontend.
// Uso: import api from '../services/api.js'  ->  api.get('/ciudades')
const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api