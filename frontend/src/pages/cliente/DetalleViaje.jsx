import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '../../services/api.js'
import IconoBus from './IconoBus.jsx'
import { dinero, duracion, fechaLarga, horaEnParada, iniciales, NOMBRE_TIPO_VIAJE } from './formatos.js'
import './Viajes.css'

// Detalle del viaje: bus, recorrido y precio del tramo (rediseño CC-20)
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
    api.get(`/viajes/${id}`, { params: { subida, bajada } })
      .then(({ data }) => { if (activo) setViaje(data) })
      .catch((fallo) => { if (activo) setError(fallo.response?.data?.mensaje || 'No pudimos cargar el viaje.') })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [id, subida, bajada])

  if (cargando) {
    return <div className="viajes"><div className="viajes__cargando"><span className="viajes__giro" /> Cargando el viaje…</div></div>
  }

  if (error || !viaje) {
    return (
      <section className="viajes">
        <div className="viajes__vacio">
          <span className="viajes__vacio-icono"><IconoBus /></span>
          <strong>No pudimos mostrar este viaje</strong>
          <span>{error || 'El viaje ya no está disponible.'}</span>
          <Link to="/viajes" className="viajes__boton" style={{ marginTop: '.5rem' }}>Buscar otro viaje</Link>
        </div>
      </section>
    )
  }

  const paradaSubida = viaje.paradas.find((p) => p.orden === viaje.orden_subida)
  const paradaBajada = viaje.paradas.find((p) => p.orden === viaje.orden_bajada)
  const minutosTramo = paradaBajada && paradaSubida ? paradaBajada.minutos_desde_salida - paradaSubida.minutos_desde_salida : null
  const estiloCoop = viaje.cooperativa_color ? { '--coop': viaje.cooperativa_color } : undefined

  return (
    <section className="viajes" style={estiloCoop}>
      <button type="button" className="viajes__volver" style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
        onClick={() => window.history.back()}>← Volver a los resultados</button>

      <div className="detalle">
        <div>
          <div className="detalle__portada">
            {viaje.foto_url && <img src={viaje.foto_url} alt={`Bus ${viaje.numero_disco} de ${viaje.cooperativa}`} />}
            <div>
              <p>{viaje.cooperativa}</p>
              <h1>{viaje.origen} → {viaje.destino}</h1>
              <p>{fechaLarga(viaje.fecha)} · sale a las {horaEnParada(viaje.hora_salida, paradaSubida?.minutos_desde_salida)}</p>
            </div>
          </div>

          <div className="viajes__tarjeta">
            <h2>El bus</h2>
            <dl className="datos">
              <div><dt>Disco</dt><dd>{viaje.numero_disco}</dd></div>
              <div><dt>Placa</dt><dd>{viaje.placa}</dd></div>
              <div><dt>Pisos</dt><dd>{viaje.pisos}</dd></div>
              <div><dt>Chasis</dt><dd>{viaje.marca_chasis}</dd></div>
              <div><dt>Carrocería</dt><dd>{viaje.marca_carroceria}</dd></div>
              <div><dt>Tipo de viaje</dt><dd>{NOMBRE_TIPO_VIAJE[viaje.tipo_viaje] || viaje.tipo_viaje}</dd></div>
            </dl>
            <p style={{ margin: '1rem 0 0', color: 'var(--v-suave)', fontSize: '.85rem' }}>
              Frecuencia autorizada por la ANT, resolución {viaje.numero_resolucion}.
            </p>
          </div>

          <div className="viajes__tarjeta">
            <h2>Recorrido</h2>
            <ol className="recorrido">
              {viaje.paradas.map((parada) => {
                const enTramo = parada.orden >= viaje.orden_subida && parada.orden <= viaje.orden_bajada
                const clases = [
                  enTramo && 'en-tramo',
                  parada.orden === viaje.orden_subida && 'inicio-tramo',
                  parada.orden === viaje.orden_bajada && 'fin-tramo',
                ].filter(Boolean).join(' ')
                return (
                  <li key={parada.orden} className={clases}>
                    <span>
                      {parada.ciudad}{' '}
                      {parada.orden === viaje.orden_subida && <small>· Tu subida</small>}
                      {parada.orden === viaje.orden_bajada && <small>· Tu bajada</small>}
                    </span>
                    <span>{horaEnParada(viaje.hora_salida, parada.minutos_desde_salida)}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        <aside className="lateral">
          <div className="viajes__tarjeta">
            <div className="viaje__cooperativa">
              <span className="viaje__logo">
                {viaje.cooperativa_logo ? <img src={viaje.cooperativa_logo} alt="" /> : iniciales(viaje.cooperativa)}
              </span>
              <div>
                <strong>{viaje.cooperativa}</strong>
                <span>{viaje.cooperativa_eslogan || 'Transporte interprovincial'}</span>
              </div>
            </div>
            <div className="lateral__precio">
              <span style={{ color: 'var(--v-suave)', fontWeight: 650 }}>Precio desde</span>
              <span className="viaje__monto">{viaje.precio_desde === null ? '—' : dinero(viaje.precio_desde)}</span>
            </div>
            <div className="lateral__fila"><span>Tramo</span><strong>{viaje.origen} → {viaje.destino}</strong></div>
            {minutosTramo !== null && <div className="lateral__fila"><span>Duración aprox.</span><strong>{duracion(minutosTramo)}</strong></div>}
            <div className="lateral__fila"><span>Asientos libres</span><strong>{viaje.asientos_libres}</strong></div>
            <div className="lateral__fila"><span>Pasajeros</span><strong>{pasajeros}</strong></div>
            {viaje.asientos_libres >= Number(pasajeros) ? (
              <Link to={`/viajes/${id}/asientos?subida=${subida}&bajada=${bajada}&pasajeros=${pasajeros}`}
                className="viajes__boton viajes__boton--bloque" style={{ marginTop: '1rem' }}>
                Elegir asientos
              </Link>
            ) : (
              <p className="viajes__error" style={{ marginTop: '1rem' }}>No quedan suficientes asientos para {pasajeros} pasajeros.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

export default DetalleViaje
