import { Link } from 'react-router-dom'

// Página para direcciones que no existen (CC-19)
function NoEncontrado() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <div className="aviso-pagina">
        <span className="aviso-pagina__numero">404</span>
        <h1>No encontramos esta página</h1>
        <p>Es posible que la dirección esté mal escrita o que la página ya no exista.</p>
        <div className="fila" style={{ justifyContent: 'center' }}>
          <Link to="/" className="btn btn-primary">Volver al inicio</Link>
          <Link to="/viajes" className="btn">Buscar pasajes</Link>
        </div>
      </div>
    </div>
  )
}

export default NoEncontrado
