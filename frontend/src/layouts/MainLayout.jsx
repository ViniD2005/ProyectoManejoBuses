import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function MainLayout() {
  const { usuario, cerrarSesion } = useAuth()

  // Recarga la app en /login: así el próximo inicio de sesión
  // no intenta volver a una página de otro rol.
  const salir = () => {
    cerrarSesion()
    window.location.href = '/login'
  }

  return (
    <div className="layout">
      <header className="layout__header">
        <Link to="/" className="layout__marca">Pasajes Ecuador</Link>
        <nav className="layout__nav">
          {usuario?.rol === 'admin' && <Link to="/cooperativas">Cooperativas</Link>}
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
    </div>
  )
}

export default MainLayout
