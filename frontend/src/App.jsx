import { Routes, Route } from 'react-router-dom'
import MainLayout from './layouts/MainLayout.jsx'
import Inicio from './pages/Inicio.jsx'
import Cooperativas from './pages/Cooperativas.jsx'
import NoEncontrado from './pages/NoEncontrado.jsx'

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/cooperativas" element={<Cooperativas />} />
      </Route>
      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}

export default App