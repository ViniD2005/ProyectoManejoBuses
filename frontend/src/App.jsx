
import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import Inicio from './pages/Inicio.jsx'
import Cooperativas from './pages/Cooperativas.jsx'
import NoEncontrado from './pages/NoEncontrado.jsx'

// Frente D - Busqueda de viajes y asientos
import BuscarViajes from './pages/cliente/BuscarViajes.jsx'
import ResultadosViajes from './pages/cliente/ResultadosViajes.jsx'
import DetalleViaje from './pages/cliente/DetalleViaje.jsx'
import SeleccionAsientos from './pages/cliente/SeleccionAsientos.jsx'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>

        {/* Pagina principal */}
        <Route path="/" element={<Inicio />} />
<Route path="/" element={<Inicio />} />

{/* Frente D - Busqueda de viajes */}
<Route path="/viajes" element={<BuscarViajes />} />

{/* Frente D - Resultados de busqueda */}
<Route
  path="/viajes/resultados"
  element={<ResultadosViajes />}
/>

{/* Frente D - Detalle del viaje */}
<Route
  path="/viajes/:id"
  element={<DetalleViaje />}
/>

{/* Frente D - Seleccion de asientos */}
<Route
  path="/viajes/:id/asientos"
  element={<SeleccionAsientos />}
/>

{/* Módulo de Cooperativas */}
<Route path="/cooperativas" element={<Cooperativas />} />

{/* Pagina no encontrada */}
<Route path="*" element={<NoEncontrado />} />
      </Route>
      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

export default App
