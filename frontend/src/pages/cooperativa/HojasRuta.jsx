
import { useEffect, useState } from 'react'
import api from '../../services/api.js'

function manana() {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toLocaleDateString('en-CA')
}

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/*
  Asignación automática: recorre las frecuencias por hora y
  asigna los buses rotando el orden según el día, para que
  los días de parada se repartan entre todos los buses.
  Respeta los viajes con boletos vendidos y evita
  cruces de horario.
*/
function sugerirAsignacion(datos) {
  const dia = Math.floor(
    new Date(`${datos.fecha}T12:00:00`).getTime() / 86400000
  )

  const buses = datos.buses.map((b) => b.id)

  const rotados = buses.length
    ? buses.map((_, i) => buses[(i + dia) % buses.length])
    : []

  const ocupacion = new Map()
  const asignacion = {}

  const ocupar = (busId, f) => {
    const inicio = aMinutos(f.hora_salida)
    const lista = ocupacion.get(busId) || []

    lista.push({
      inicio,
      fin: inicio + Number(f.duracion_minutos || 0)
    })

    ocupacion.set(busId, lista)
  }

  const libre = (busId, f) => {
    const inicio = aMinutos(f.hora_salida)
    const fin = inicio + Number(f.duracion_minutos || 0)

    return (ocupacion.get(busId) || []).every(
      (o) => fin <= o.inicio || inicio >= o.fin
    )
  }

  // Primero los viajes con boletos vendidos
  for (const f of datos.frecuencias) {
    if (f.boletos_vendidos > 0 && f.bus_id) {
      asignacion[f.frecuencia_id] = f.bus_id
      ocupar(f.bus_id, f)
    }
  }

  let siguiente = 0

  for (const f of datos.frecuencias) {
    if (asignacion[f.frecuencia_id]) continue

    for (let intento = 0; intento < rotados.length; intento++) {
      const busId =
        rotados[(siguiente + intento) % rotados.length]

      if (libre(busId, f)) {
        asignacion[f.frecuencia_id] = busId
        ocupar(busId, f)

        siguiente =
          (siguiente + intento + 1) % rotados.length

        break
      }
    }
  }

  return asignacion
}

export default function HojasRuta() {
  const [fecha, setFecha] = useState(manana)
  const [datos, setDatos] = useState(null)
  const [asignacion, setAsignacion] = useState({})
  const [generacion, setGeneracion] = useState('manual')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const aplicarDatos = (data) => {
    setDatos(data)

    setAsignacion(
      Object.fromEntries(
        data.frecuencias.map((f) => [
          f.frecuencia_id,
          f.bus_id || ''
        ])
      )
    )

    setGeneracion(data.hoja?.generacion || 'manual')
  }

  useEffect(() => {
    api.get('/hojas-ruta', {
      params: { fecha }
    })
      .then(({ data }) => aplicarDatos(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [fecha])

  const cambiarFecha = (e) => {
    setError('')
    setAviso('')
    setErrores({})
    setFecha(e.target.value)
  }

  const asignar = (frecuenciaId, busId) => {
    setGeneracion('manual')

    setAsignacion({
      ...asignacion,
      [frecuenciaId]: busId ? Number(busId) : ''
    })
  }

  const automatica = () => {
    setAsignacion(sugerirAsignacion(datos))
    setGeneracion('automatica')

    setAviso(
      'Asignación automática sugerida. Revísala y presiona "Guardar hoja de ruta".'
    )
  }

  const guardar = async () => {
    setError('')
    setAviso('')
    setErrores({})

    try {
      const { data } = await api.post('/hojas-ruta', {
        fecha,
        generacion,
        asignaciones: Object.entries(asignacion).map(
          ([frecuencia_id, bus_id]) => ({
            frecuencia_id,
            bus_id
          })
        )
      })

      aplicarDatos(data)

      setAviso(
        `Hoja de ruta del ${fecha} guardada (${generacion}).`
      )
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    }
  }

  // Buses que quedan sin viajes
  const usados = new Set(
    Object.values(asignacion)
      .filter(Boolean)
      .map(Number)
  )

  const enParada = datos
    ? datos.buses.filter((b) => !usados.has(b.id))
    : []

  return (
    <div className="container">
      <h1 className="mb-2">
        Hoja de ruta
      </h1>

      <p className="text-muted mb-4">
        Asigna un bus a cada frecuencia activa del día.
        Los buses sin viaje quedan en día de parada.
      </p>

      <div className="mb-3">
        <label className="form-label" htmlFor="fecha">
          Fecha
        </label>

        <input
          id="fecha"
          type="date"
          className="form-control"
          value={fecha}
          onChange={cambiarFecha}
        />
      </div>

      {error && (
        <p style={{ color: '#b3261e' }}>
          {error}
        </p>
      )}

      {aviso && (
        <p style={{ color: '#1e7a4c' }}>
          {aviso}
        </p>
      )}

      {!datos && !error && (
        <p>Cargando…</p>
      )}

      {datos && (
        <>
          <p className="mb-3">
            Estado:{' '}
            <strong>
              {datos.hoja
                ? `hoja registrada (${datos.hoja.generacion})`
                : 'sin hoja de ruta para este día'}
            </strong>
          </p>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Frecuencia</th>
                  <th>Tipo</th>
                  <th>Boletos vendidos</th>
                  <th>Bus asignado</th>
                </tr>
              </thead>

              <tbody>
                {datos.frecuencias.map((f) => (
                  <tr key={f.frecuencia_id}>
                    <td>
                      {f.hora_salida.slice(0, 5)}
                    </td>

                    <td>
                      {f.origen} → {f.destino}
                    </td>

                    <td>
                      {f.tipo_viaje === 'con_paradas'
                        ? 'Con paradas'
                        : 'Directo'}
                    </td>

                    <td>
                      {f.boletos_vendidos}
                    </td>

                    <td>
                      <select
                        className="form-control"
                        value={
                          asignacion[f.frecuencia_id] || ''
                        }
                        disabled={f.boletos_vendidos > 0}
                        onChange={(e) =>
                          asignar(
                            f.frecuencia_id,
                            e.target.value
                          )
                        }
                      >
                        <option value="">
                          Sin asignar (no sale)
                        </option>

                        {datos.buses.map((b) => (
                          <option
                            key={b.id}
                            value={b.id}
                          >
                            Disco {b.numero_disco} ({b.placa})
                          </option>
                        ))}
                      </select>

                      {errores[`frecuencia_${f.frecuencia_id}`] && (
                        <small
                          style={{ color: '#b3261e' }}
                        >
                          {errores[`frecuencia_${f.frecuencia_id}`]}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}

                {datos.frecuencias.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-muted"
                    >
                      No hay frecuencias activas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-body">
              <h2 className="h4 mb-2">
                Buses en día de parada
              </h2>

              {enParada.length === 0 ? (
                <p className="text-muted">
                  Todos los buses tienen viaje este día.
                </p>
              ) : (
                <p>
                  {enParada.map(
                    (b) =>
                      `Disco ${b.numero_disco} (${b.placa})`
                  ).join(', ')}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn"
            onClick={automatica}
          >
            Generar asignación automática
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: 8 }}
            onClick={guardar}
          >
            Guardar hoja de ruta
          </button>
        </>
      )}
    </div>
  )
}
