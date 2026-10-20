
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api.js'
import './Viajes.css'

function BuscarViajes() {
  const navegar = useNavigate()
  const [ciudades, setCiudades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState({
    origen: '',
    destino: '',
    fecha: '',
    pasajeros: 1,
  })

  useEffect(() => {
    let activo = true

    api.get('/ciudades')
      .then(({ data }) => {
        if (activo) {
          setCiudades(
            Array.isArray(data) ? data : data.ciudades || []
          )
        }
      })
      .catch((fallo) => {
        if (activo) {
          setError(
            fallo.response?.data?.mensaje ||
            'No se pudieron cargar las ciudades'
          )
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => { activo = false }
  }, [])

  function buscar(evento) {
    evento.preventDefault()

    if (busqueda.origen === busqueda.destino) {
      setError('El origen y destino deben ser diferentes')
      return
    }

    if (Number(busqueda.pasajeros) < 1) {
      setError('Indica al menos un pasajero')
      return
    }

    setError('')

    const parametros = new URLSearchParams(busqueda)
    navegar(`/viajes/resultados?${parametros.toString()}`)
  }

  return (
    <section className="viajes">
      <h1>Buscar pasajes interprovinciales</h1>
      <p>Elige el tramo y la fecha de tu viaje.</p>

      {cargando && <p>Cargando ciudades...</p>}

      {error && (
        <p role="alert" className="viajes__error">
          {error}
        </p>
      )}

      <form
        className="viajes__formulario"
        onSubmit={buscar}
      >
        <label>
          Origen
          <select
            required
            disabled={cargando}
            value={busqueda.origen}
            onChange={(e) => setBusqueda({
              ...busqueda,
              origen: e.target.value,
            })}
          >
            <option value="">Selecciona una ciudad</option>
            {ciudades.map((ciudad) => (
              <option key={ciudad.id} value={ciudad.id}>
                {ciudad.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Destino
          <select
            required
            disabled={cargando}
            value={busqueda.destino}
            onChange={(e) => setBusqueda({
              ...busqueda,
              destino: e.target.value,
            })}
          >
            <option value="">Selecciona una ciudad</option>
            {ciudades.map((ciudad) => (
              <option key={ciudad.id} value={ciudad.id}>
                {ciudad.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fecha
          <input
            type="date"
            required
            value={busqueda.fecha}
            onChange={(e) => setBusqueda({
              ...busqueda,
              fecha: e.target.value,
            })}
          />
        </label>

        <label>
          Pasajeros
          <input
            type="number"
            min="1"
            max="50"
            required
            value={busqueda.pasajeros}
            onChange={(e) => setBusqueda({
              ...busqueda,
              pasajeros: e.target.value,
            })}
          />
        </label>

        <button disabled={cargando} type="submit">
          Buscar viajes
        </button>
      </form>
    </section>
  )
}

export default BuscarViajes
