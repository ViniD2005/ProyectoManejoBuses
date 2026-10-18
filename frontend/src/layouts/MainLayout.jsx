import { Link, Outlet } from 'react-router-dom'

function MainLayout() {
  return (
    <div className="layout">
      <header className="layout__header">
        <Link to="/" className="layout__marca">Pasajes Ecuador</Link>
      </header>
      <main className="layout__contenido">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout