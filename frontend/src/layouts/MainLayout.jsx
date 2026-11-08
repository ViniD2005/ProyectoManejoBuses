import { Link, Outlet } from 'react-router-dom'
import { useConfiguracion } from '../hooks/useConfiguracion.js'
import PieDePagina from '../components/PieDePagina.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Notificaciones from '../components/Notificaciones.jsx'

function MainLayout() {
  const { usuario, cerrarSesion } = useAuth()
  const configuracion = useConfiguracion()

  // Recarga la app en /login: así el próximo inicio de sesión
  // no intenta volver a una página de otro rol.
  const salir = () => {
    cerrarSesion()
    window.location.href = '/login'
  }

  return (
    <div className="layout">
      <header className="layout__header">
        <Link to="/" className="layout__marca">
          {configuracion.logo_url && <img src={configuracion.logo_url} alt="" className="layout__logo" />}
          {configuracion.nombre_app}
        </Link>
        <nav className="layout__nav">
          {usuario?.rol === 'admin' && (
            <>
              <Link to="/cooperativas">Cooperativas</Link>
              <Link to="/admin/configuracion">Configuración</Link>
            </>
          )}
          {usuario?.rol === 'cliente' && <Link to="/mis-boletos">Mis boletos</Link>}
          {usuario?.rol === 'cooperativa' && (
            <>
              <Link to="/buses">Buses</Link>
              <Link to="/cooperativa/tipos-asiento">Tipos de asiento</Link>
              <Link to="/frecuencias">Frecuencias</Link>
            </>
          )}
          {usuario?.rol === 'oficinista' && <Link to="/oficinista/pagos">Validar pagos</Link>}
          {usuario ? (
            <>
              <Notificaciones />
              <span>{usuario.nombres} ({usuario.rol})</span>
              <button type="button" onClick={salir}>Cerrar sesión</button>
            </>
          ) : (
            <Link to="/login">Iniciar sesión</Link>
          )}
        </nav>
      </header>
      <main className="layout__contenido">
        <Outlet />
      </main>
      <PieDePagina configuracion={configuracion} />
    </div>
  )
}

export default MainLayout
