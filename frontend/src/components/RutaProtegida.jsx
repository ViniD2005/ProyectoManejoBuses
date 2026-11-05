import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Protege un grupo de rutas:
//   <Route element={<RutaProtegida roles={['admin']} />}> ... </Route>
// Sin "roles", basta con haber iniciado sesión.
function RutaProtegida({ roles }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) return <p>Cargando…</p>
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  if (roles && !roles.includes(usuario.rol)) {
    return <p>No tienes permiso para ver esta página.</p>
  }
  return <Outlet />
}

export default RutaProtegida
