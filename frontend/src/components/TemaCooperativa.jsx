import { useEffect } from 'react'
import api from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { aplicarTema, limpiarTema } from '../utils/temaCooperativa.js'

// Roles que trabajan dentro de una cooperativa y ven sus colores
const ROLES_COOPERATIVA = ['cooperativa', 'oficinista', 'personal_bus']

/*
  CC-24: al iniciar sesión el personal de una cooperativa, la aplicación
  toma los colores y el logo de SU cooperativa. Al cerrar sesión vuelve
  a los colores generales. No dibuja nada.
*/
function TemaCooperativa() {
  const { usuario } = useAuth()
  const cooperativaId = ROLES_COOPERATIVA.includes(usuario?.rol) ? usuario.cooperativa_id : null

  useEffect(() => {
    if (!cooperativaId) {
      limpiarTema()
      return
    }
    let activo = true
    api.get('/apariencia/mia')
      .then(({ data }) => { if (activo) aplicarTema(data) })
      .catch(() => {})
    return () => { activo = false }
  }, [cooperativaId])

  return null
}

export default TemaCooperativa
