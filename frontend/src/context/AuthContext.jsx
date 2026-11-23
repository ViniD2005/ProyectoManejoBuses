/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api.js'

const AuthContext = createContext(null)

// Página a la que va cada rol después de iniciar sesión
export const INICIO_POR_ROL = {
  admin: '/cooperativas',
  // GC-9: el personal de una cooperativa entra a su panel de inicio
  cooperativa: '/panel',
  oficinista: '/panel',
  personal_bus: '/panel',
  cliente: '/',
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(() => Boolean(localStorage.getItem('token')))

  // Si hay un token guardado, se valida contra el backend al abrir la app
  useEffect(() => {
    if (!localStorage.getItem('token')) return
    api.get('/auth/perfil')
      .then(({ data }) => setUsuario(data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setCargando(false))
  }, [])

  const guardarSesion = (data) => {
    localStorage.setItem('token', data.token)
    setUsuario(data.usuario)
    return data.usuario
  }

  const iniciarSesion = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    return guardarSesion(data)
  }

  // GC-12: registrarse ya NO inicia sesión; primero se confirma el correo
  const registrarse = async (datos) => {
    const { data } = await api.post('/auth/registro', datos)
    return data
  }

  const cerrarSesion = () => {
    localStorage.removeItem('token')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, registrarse, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
