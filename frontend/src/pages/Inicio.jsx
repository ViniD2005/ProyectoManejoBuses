import { useEffect, useState } from 'react'
import api from '../services/api.js'

function Inicio() {
  const [estadoApi, setEstadoApi] = useState('Comprobando conexión con el backend…')

  useEffect(() => {
    api.get('/salud')
      .then(() => setEstadoApi('Backend conectado'))
      .catch(() => setEstadoApi('Backend sin conexión: ejecuta npm run dev en /backend'))
  }, [])

  return (
    <section>
      <h1>Sistema de venta de pasajes interprovinciales</h1>
      <p>{estadoApi}</p>
    </section>
  )
}

export default Inicio