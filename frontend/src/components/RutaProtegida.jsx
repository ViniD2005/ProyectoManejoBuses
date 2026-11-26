import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, INICIO_POR_ROL } from '../context/AuthContext.jsx'
import Icono from './Icono.jsx'

// Protege un grupo de rutas:
//   <Route element={<RutaProtegida roles={['admin']} />}> ... </Route>
// Sin "roles", basta con haber iniciado sesión.
function RutaProtegida({ roles }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) {
    return <div className="cargando"><span className="giro" /> Cargando tu sesión…</div>
  }
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  if (roles && !roles.includes(usuario.rol)) {
    return (
      <div className="aviso-pagina">
        <span className="vacio__icono"><Icono nombre="escudo" tam={28} /></span>
        <h1>Esta sección no está disponible para tu cuenta</h1>
        <p>Tu usuario no tiene permiso para ver esta página. Si crees que es un error, pide al administrador que revise tu rol.</p>
        <Link to={INICIO_POR_ROL[usuario.rol] || '/'} className="btn btn-primary">Ir a mi inicio</Link>
      </div>
    )
  }
  return <Outlet />
}

export default RutaProtegida
