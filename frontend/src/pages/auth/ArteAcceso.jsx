import Icono from '../../components/Icono.jsx'

// Panel decorativo de las pantallas de acceso (CC-19)
function ArteAcceso({ titulo, texto }) {
  return (
    <aside className="acceso__arte" aria-hidden="true">
      <div>
        <span className="portada__etiqueta"><Icono nombre="bus" tam={16} /> Pasajes interprovinciales</span>
        <h2>{titulo}</h2>
        <p>{texto}</p>
        <ul className="acceso__lista">
          <li><span><Icono nombre="asiento" tam={18} /></span> Elige tu asiento en el mapa del bus</li>
          <li><span><Icono nombre="qr" tam={18} /></span> Boleto con código QR en tu celular</li>
          <li><span><Icono nombre="escudo" tam={18} /></span> Cooperativas registradas y verificadas</li>
        </ul>
      </div>
      <svg className="acceso__ruta" viewBox="0 0 200 200" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <path d="M20 180C40 120 90 150 110 100S170 60 180 20" strokeDasharray="6 10" />
        <circle cx="20" cy="180" r="8" fill="#fff" />
        <circle cx="180" cy="20" r="8" fill="#fff" />
      </svg>
    </aside>
  )
}

export default ArteAcceso
