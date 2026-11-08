
import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import RutaProtegida from './components/RutaProtegida.jsx'
import Inicio from './pages/Inicio.jsx'
import NoEncontrado from './pages/NoEncontrado.jsx'

// Tarea 0 - Autenticacion
import Login from './pages/auth/Login.jsx'
import Registro from './pages/auth/Registro.jsx'

// Frente A - Administracion
import Cooperativas from './pages/admin/Cooperativas.jsx'

// Frente B - Flota
import Buses from './pages/Buses.jsx'
import TiposAsiento from './pages/cooperativa/TiposAsiento.jsx'

// Frente C - Operacion
import Frecuencias from './pages/cooperativa/Frecuencias.jsx'

// ========================================
// FRENTE C - FERNANDO
// HOJAS DE RUTA
// ========================================
import HojasRuta from './pages/cooperativa/HojasRuta.jsx'

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

        {/* Frente A - Administracion */}
        <Route element={<RutaProtegida roles={['admin']} />}>
          <Route
            path="/cooperativas"
            element={<Cooperativas />}
          />
        </Route>

        {/* Frentes B y C - Cooperativa */}
        <Route
          element={
            <RutaProtegida roles={['cooperativa']} />
          }
        >
          <Route
            path="/buses"
            element={<Buses />}
          />

          <Route
            path="/cooperativa/tipos-asiento"
            element={<TiposAsiento />}
          />

          <Route
            path="/frecuencias"
            element={<Frecuencias />}
          />

          {/* ==================================
              FRENTE C - FERNANDO
              HOJAS DE RUTA
          ================================== */}

          <Route
            path="/cooperativa/hojas-ruta"
            element={<HojasRuta />}
          />
        </Route>

        {/* Frente D - Busqueda de viajes */}
        <Route
          path="/viajes"
          element={<BuscarViajes />}
        />

        <Route
          path="/viajes/resultados"
          element={<ResultadosViajes />}
        />

        <Route
          path="/viajes/:id"
          element={<DetalleViaje />}
        />

        <Route
          path="/viajes/:id/asientos"
          element={<SeleccionAsientos />}
        />

      </Route>

      <Route
        path="*"
        element={<NoEncontrado />}
      />
    </Routes>
  )
}

export default App
