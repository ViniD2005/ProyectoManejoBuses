
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
import Configuracion from './pages/admin/Configuracion.jsx'

// Frente E - Panel del oficinista
import ValidarPagos from './pages/oficinista/ValidarPagos.jsx'

// Frente B - Flota
import Buses from './pages/Buses.jsx'
import TiposAsiento from './pages/cooperativa/TiposAsiento.jsx'

// Frente C - Operacion
import Frecuencias from './pages/cooperativa/Frecuencias.jsx'
import HojasRuta from './pages/cooperativa/HojasRuta.jsx'

// CC-13 - Turnos y hoja de ruta semanal
import Turnos from './pages/cooperativa/Turnos.jsx'
import HojaSemanal from './pages/cooperativa/HojaSemanal.jsx'

// Frente E - Mis boletos
import MisBoletos from './pages/cliente/MisBoletos.jsx'

// Frente D - Busqueda de viajes y asientos
import BuscarViajes from './pages/cliente/BuscarViajes.jsx'
import ResultadosViajes from './pages/cliente/ResultadosViajes.jsx'
import DetalleViaje from './pages/cliente/DetalleViaje.jsx'
import SeleccionAsientos from './pages/cliente/SeleccionAsientos.jsx'

// Frente E - Compra de boletos
import Comprar from './pages/cliente/Comprar.jsx'

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
          <Route path="/admin/configuracion" element={<Configuracion />} />
        </Route>

        {/* Frente E - Oficinista (solo oficinista) */}
        <Route element={<RutaProtegida roles={['oficinista']} />}>
          <Route path="/oficinista/pagos" element={<ValidarPagos />} />
        </Route>

        {/* Frentes B y C - Panel de la cooperativa (solo cooperativa) */}
        <Route element={<RutaProtegida roles={['cooperativa']} />}>
          <Route path="/buses" element={<Buses />} />
          <Route path="/cooperativa/tipos-asiento" element={<TiposAsiento />} />
          <Route path="/frecuencias" element={<Frecuencias />} />
          <Route path="/cooperativa/hojas-ruta" element={<HojasRuta />} />
          <Route path="/cooperativa/turnos" element={<Turnos />} />
          <Route path="/cooperativa/hoja-semanal" element={<HojaSemanal />} />
        </Route>

        {/* Frente E - Mis boletos (solo cliente) */}
        <Route element={<RutaProtegida roles={['cliente']} />}>
          <Route path="/mis-boletos" element={<MisBoletos />} />
        </Route>

        {/* Frente D - Busqueda de viajes (publico) */}
        <Route path="/viajes" element={<BuscarViajes />} />
        <Route path="/viajes/resultados" element={<ResultadosViajes />} />
        <Route path="/viajes/:id" element={<DetalleViaje />} />
        <Route path="/viajes/:id/asientos" element={<SeleccionAsientos />} />

        {/* Frente E - Compra (solo cliente) */}
        <Route element={<RutaProtegida roles={['cliente']} />}>
          <Route path="/comprar" element={<Comprar />} />
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

export default App
