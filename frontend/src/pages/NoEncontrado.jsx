import { useNavigate } from 'react-router-dom'
import { useAuth, INICIO_POR_ROL } from '../context/AuthContext.jsx'

/*
  Página para direcciones que no existen (CC-19).
  GC-31: botones para volver atrás o ir al inicio que corresponde a cada usuario.
*/
function NoEncontrado() {
  const navegar = useNavigate()
  const { usuario } = useAuth()
  const inicio = (usuario && INICIO_POR_ROL[usuario.rol]) || '/'

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
      <div className="aviso-pagina">
        <span className="aviso-pagina__numero">404</span>
        <h1>No encontramos esta página</h1>
        <p>Es posible que la dirección esté mal escrita o que la página ya no exista.</p>
        <div className="fila" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={() => navegar(-1)}>Volver atrás</button>
          <button type="button" className="btn btn-primary" onClick={() => navegar(inicio)}>{usuario ? 'Ir a mi inicio' : 'Ir al inicio'}</button>
          {(!usuario || usuario.rol === 'cliente') && (
            <button type="button" className="btn" onClick={() => navegar('/viajes')}>Buscar pasajes</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default NoEncontrado
