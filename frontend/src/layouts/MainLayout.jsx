
import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useConfiguracion } from '../hooks/useConfiguracion.js'
import PieDePagina from '../components/PieDePagina.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Notificaciones from '../components/Notificaciones.jsx'
import { EVENTO_APARIENCIA } from '../utils/temaCooperativa.js'

function MainLayout() {
  const { usuario, cerrarSesion } = useAuth()
  const configuracion = useConfiguracion()

  const [cooperativa, setCooperativa] = useState(
    () => window.__aparienciaCooperativa || null
  )

  useEffect(() => {
    const actualizarApariencia = () => {
      setCooperativa(window.__aparienciaCooperativa || null)
    }

    window.addEventListener(EVENTO_APARIENCIA, actualizarApariencia)

    actualizarApariencia()

    return () => {
      window.removeEventListener(EVENTO_APARIENCIA, actualizarApariencia)
    }
  }, [])

  const tieneCooperativa =
    ['cooperativa', 'oficinista', 'personal_bus'].includes(usuario?.rol) &&
    usuario?.cooperativa_id &&
    cooperativa

  const nombre = tieneCooperativa
    ? cooperativa.nombre || configuracion.nombre_app
    : configuracion.nombre_app

  const logo = tieneCooperativa
    ? cooperativa.logo_url
    : configuracion.logo_url

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
          {logo && <img src={logo} alt={nombre} className="layout__logo" />}
          <span>{nombre}</span>
        </Link>
        <nav className="layout__nav">
          {usuario?.rol === 'admin' && (
            <>
              <Link to="/cooperativas">Cooperativas</Link>
              <Link to="/admin/configuracion">Configuración</Link>
              <Link to="/admin/usuarios">Usuarios</Link>
            </>
          )}
          {usuario?.rol === 'personal_bus' && <Link to="/personal/abordaje">Abordaje</Link>}
          {usuario?.rol === 'cliente' && <Link to="/mis-boletos">Mis boletos</Link>}
          {usuario?.rol === 'cooperativa' && (
            <>
              <Link to="/buses">Buses</Link>
              <Link to="/cooperativa/personal">Personal</Link>
              <Link to="/cooperativa/tipos-asiento">Tipos de asiento</Link>
              <Link to="/frecuencias">Frecuencias</Link>
              <Link to="/cooperativa/hojas-ruta">Hojas de ruta</Link>
              <Link to="/cooperativa/turnos">Turnos</Link>
              <Link to="/cooperativa/hoja-semanal">Hoja semanal</Link>
              <Link to="/cooperativa/apariencia">Apariencia</Link>
            </>
          )}
          {usuario?.rol === 'oficinista' && (
            <>
              <Link to="/oficinista/vender">Vender boletos</Link>
              <Link to="/oficinista/pagos">Validar pagos</Link>
            </>
          )}
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
