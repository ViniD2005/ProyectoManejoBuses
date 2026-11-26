import { Link } from 'react-router-dom'
import Icono from './Icono.jsx'

// GC-32: 0991234567 -> 099 123 4567 · 022345678 -> (02) 234 5678
const formatoTelefono = (t) => {
  const n = String(t).replace(/\D/g, '')
  if (/^09\d{8}$/.test(n)) return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
  if (/^0[2-7]\d{7}$/.test(n)) return `(${n.slice(0, 2)}) ${n.slice(2, 5)} ${n.slice(5)}`
  return t
}

// Pie de página con los datos de soporte y redes sociales de la configuración (CC-12, rediseño CC-19)
function PieDePagina({ configuracion }) {
  const { nombre_app, soporte_email, soporte_telefono, facebook_url, instagram_url } = configuracion

  return (
    <footer className="pie">
      <div className="pie__interior">
        <span>© {new Date().getFullYear()} {nombre_app}. Pasajes de bus interprovinciales en Ecuador.</span>
        <div className="pie__enlaces">
          <Link to="/viajes">Buscar pasajes</Link>
          {soporte_email && (
            <a href={`mailto:${soporte_email}`} className="fila" style={{ gap: '0.35rem' }}>
              <Icono nombre="correo" tam={16} /> {soporte_email}
            </a>
          )}
          {soporte_telefono && (
            <a href={`tel:${soporte_telefono}`} className="fila" style={{ gap: '0.35rem' }} aria-label={`Llamar a soporte al ${soporte_telefono}`}>
              <Icono nombre="telefono" tam={16} /> {formatoTelefono(soporte_telefono)}
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
