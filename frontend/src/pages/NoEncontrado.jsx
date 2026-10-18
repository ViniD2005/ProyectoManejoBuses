import { Link } from 'react-router-dom'

function NoEncontrado() {
  return (
    <section>
      <h1>Página no encontrada</h1>
      <Link to="/">Volver al inicio</Link>
    </section>
  )
}

export default NoEncontrado