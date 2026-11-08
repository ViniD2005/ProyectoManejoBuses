
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

function MainLayout() {
  const { usuario, cerrarSesion } = useAuth()

  // Recarga la app en /login para evitar
  // volver a una pagina de otro rol.
  const salir = () => {
    cerrarSesion()
    window.location.href = '/login'
  }

  return (
    <div className="layout">

      <header className="layout__header">

        <Link
          to="/"
          className="layout__marca"
        >
          Pasajes Ecuador
        </Link>

        <nav className="layout__nav">

          {/* Menu administrador */}
          {usuario?.rol === 'admin' && (
            <Link to="/cooperativas">
              Cooperativas
            </Link>
          )}

          {/* Menu cooperativa */}
          {usuario?.rol === 'cooperativa' && (
            <>
              <Link to="/buses">
                Buses
              </Link>

              <Link to="/cooperativa/tipos-asiento">
                Tipos de asiento
              </Link>

              <Link to="/frecuencias">
                Frecuencias
              </Link>

              {/* FRENTE C - FERNANDO */}
              <Link to="/cooperativa/hojas-ruta">
                Hojas de ruta
              </Link>
            </>
          )}

          {/* Usuario autenticado */}
          {usuario ? (
            <>
              <span>
                {usuario.nombres} ({usuario.rol})
              </span>

              <button
                type="button"
                onClick={salir}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link to="/login">
              Iniciar sesión
            </Link>
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
