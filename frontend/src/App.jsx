import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import RutaProtegida from './components/RutaProtegida.jsx'
import Inicio from './pages/Inicio.jsx'
import NoEncontrado from './pages/NoEncontrado.jsx'

// Tarea 0 - Autenticacion
import Login from './pages/auth/Login.jsx'
import Registro from './pages/auth/Registro.jsx'

// Frente A - Administracion
import Cooperativas from './pages/Cooperativas.jsx'

// Frente B - Flota
import Buses from './pages/Buses.jsx'
import TiposAsiento from './pages/cooperativa/TiposAsiento.jsx'

// Frente C - Operacion
import Frecuencias from './pages/cooperativa/Frecuencias.jsx'

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

        {/* Tarea 0 - Autenticacion */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />

        {/* Frente A - Administracion (solo admin) */}
        <Route element={<RutaProtegida roles={['admin']} />}>
          <Route path="/cooperativas" element={<Cooperativas />} />
        </Route>

        {/* Frentes B y C - Panel de la cooperativa (solo cooperativa) */}
        <Route element={<RutaProtegida roles={['cooperativa']} />}>
          <Route path="/buses" element={<Buses />} />
          <Route path="/cooperativa/tipos-asiento" element={<TiposAsiento />} />
          <Route path="/frecuencias" element={<Frecuencias />} />
        </Route>

        {/* Frente D - Busqueda de viajes (publico) */}
        <Route path="/viajes" element={<BuscarViajes />} />
        <Route path="/viajes/resultados" element={<ResultadosViajes />} />
        <Route path="/viajes/:id" element={<DetalleViaje />} />
        <Route path="/viajes/:id/asientos" element={<SeleccionAsientos />} />
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

export default App
