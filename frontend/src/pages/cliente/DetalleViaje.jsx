
import { useEffect, useState } from 'react'
import {
  Link, useParams, useSearchParams,
} from 'react-router-dom'
import api from '../../services/api.js'
import './Viajes.css'

function DetalleViaje() {
  const { id } = useParams()
  const [parametros] = useSearchParams()

  const subida = parametros.get('subida')
  const bajada = parametros.get('bajada')
  const pasajeros = parametros.get('pasajeros') || '1'

  const [viaje, setViaje] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    api.get(`/viajes/${id}`, {
      params: { subida, bajada },
    })
      .then(({ data }) => {
        if (activo) setViaje(data)
      })
      .catch((fallo) => {
        if (activo) {
          setError(
            fallo.response?.data?.mensaje ||
            'No se pudo cargar el viaje'
          )
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => { activo = false }
  }, [id, subida, bajada])

  if (cargando) {
    return <p>Cargando detalle del viaje...</p>
  }

  if (error) {
    return <p role="alert">{error}</p>
  }

  if (!viaje) {
    return <p>No se encontró el viaje.</p>
  }

  return (
    <section className="viajes">
      <h1>
        {viaje.origen} → {viaje.destino}
      </h1>

      <article className="viajes__tarjeta">
        <h2>{viaje.cooperativa}</h2>

        {viaje.foto_url && (
          <img
            className="viajes__foto"
            src={viaje.foto_url}
            alt={`Bus ${viaje.numero_disco}`}
          />
        )}

        <p>Fecha: {viaje.fecha}</p>
        <p>Salida: {viaje.hora_salida.slice(0, 5)}</p>
        <p>Disco: {viaje.numero_disco}</p>
        <p>Placa: {viaje.placa}</p>
        <p>Chasis: {viaje.marca_chasis}</p>
        <p>Carrocería: {viaje.marca_carroceria}</p>
        <p>Resolución ANT: {viaje.numero_resolucion}</p>
        <p>Tipo: {viaje.tipo_viaje}</p>
        <p>Asientos libres: {viaje.asientos_libres}</p>

        <p>
          Precio desde:{' '}
          {viaje.precio_desde === null
            ? 'Sin disponibilidad'
            : `$${viaje.precio_desde.toFixed(2)}`}
        </p>
      </article>

      <h2>Recorrido del viaje</h2>

      <ol>
        {viaje.paradas.map((parada) => (
          <li key={parada.orden}>
            {parada.ciudad}
            {' · '}{parada.minutos_desde_salida} minutos

            {parada.orden === viaje.orden_subida &&
              ' (Tu subida)'}

            {parada.orden === viaje.orden_bajada &&
              ' (Tu bajada)'}
          </li>
        ))}
      </ol>

      <Link
        to={`/viajes/${id}/asientos?subida=${subida}&bajada=${bajada}&pasajeros=${pasajeros}`}
      >
        Seleccionar asientos
      </Link>
    </section>
  )
}

export default DetalleViaje
