import { Link } from 'react-router-dom'
import Icono from './Icono.jsx'

// Pie de página con los datos de soporte y redes sociales de la configuración (CC-12, rediseño CC-19)
function PieDePagina({ configuracion }) {
  const { nombre_app, soporte_email, soporte_telefono, facebook_url, instagram_url } = configuracion

  return (
    <footer className="pie">
      <div className="pie__interior">
        <span>© {new Date().getFullYear()} {nombre_app}. Pasajes interprovinciales en Ecuador.</span>
        <div className="pie__enlaces">
          <Link to="/viajes">Buscar pasajes</Link>
          {soporte_email && (
            <a href={`mailto:${soporte_email}`} className="fila" style={{ gap: '0.35rem' }}>
              <Icono nombre="correo" tam={16} /> {soporte_email}
            </a>
          )}
          {soporte_telefono && (
            <a href={`tel:${soporte_telefono}`} className="fila" style={{ gap: '0.35rem' }}>
              <Icono nombre="telefono" tam={16} /> {soporte_telefono}
            </a>
          )}
          {facebook_url && <a href={facebook_url} target="_blank" rel="noreferrer">Facebook</a>}
          {instagram_url && <a href={instagram_url} target="_blank" rel="noreferrer">Instagram</a>}
        </div>
      </div>
    </footer>
  )
}

export default PieDePagina
