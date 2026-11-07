
import { useEffect, useState } from 'react'
import {
  Link, useNavigate, useParams, useSearchParams,
} from 'react-router-dom'
import api from '../../services/api.js'
import './Viajes.css'

function SeleccionAsientos() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const navigate = useNavigate()

  const subida = parametros.get('subida')
  const bajada = parametros.get('bajada')
  const pasajeros = Math.max(
    1, Number(parametros.get('pasajeros')) || 1
  )

  const [asientos, setAsientos] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    api.get(`/viajes/${id}/asientos`, {
      params: { subida, bajada },
    })
      .then(({ data }) => {
        if (activo) {
          setAsientos(
            Array.isArray(data) ? data : []
          )
        }
      })
      .catch((fallo) => {
        if (activo) {
          setError(
            fallo.response?.data?.mensaje ||
            'No se pudieron cargar los asientos'
          )
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => { activo = false }
  }, [id, subida, bajada])

  function alternar(asiento) {
    setSeleccionados((actuales) => {
      if (actuales.includes(asiento.id)) {
        return actuales.filter(
          (asientoId) => asientoId !== asiento.id
        )
      }

      if (actuales.length >= pasajeros) {
        return actuales
      }

      return [...actuales, asiento.id]
    })
  }

  const pisos = [
    ...new Set(asientos.map((a) => a.piso)),
  ].sort((a, b) => a - b)

  const elegidos = asientos.filter(
    (a) => seleccionados.includes(a.id)
  )

  // Guarda la selección (sobrevive al inicio de sesión) y va a la compra
  function continuarCompra() {
    sessionStorage.setItem('compraPendiente', JSON.stringify({
      viaje_id: Number(id),
      subida: Number(subida),
      bajada: Number(bajada),
      asientos: elegidos.map((a) => ({
        id: a.id,
        numero: a.numero,
        tipo_asiento: a.tipo_asiento,
        precio: a.precio,
      })),
    }))
    navigate('/comprar')
  }

  const total = elegidos.reduce(
    (suma, asiento) => suma + asiento.precio,
    0
  )

  return (
    <section className="viajes">
      <h1>Seleccionar asientos</h1>

      <p>
        Elige {pasajeros} asiento(s).
        La disponibilidad depende del tramo.
      </p>

      <Link
        to={`/viajes/${id}?subida=${subida}&bajada=${bajada}&pasajeros=${pasajeros}`}
      >
        Volver al detalle
      </Link>

      {cargando && <p>Consultando disponibilidad...</p>}

      {error && (
        <p role="alert" className="viajes__error">
          {error}
        </p>
      )}

      {!cargando && !error && pisos.map((piso) => (
        <div key={piso}>
          <h2>Piso {piso}</h2>

          <div className="viajes__asientos">
            {asientos
              .filter((a) => a.piso === piso)
              .map((asiento) => (
                <button
                  key={asiento.id}
                  type="button"
                  className={
                    seleccionados.includes(asiento.id)
                      ? 'viajes__asiento viajes__asiento--elegido'
                      : 'viajes__asiento'
                  }
                  disabled={!asiento.disponible}
                  aria-pressed={
                    seleccionados.includes(asiento.id)
                  }
                  onClick={() => alternar(asiento)}
                >
                  {asiento.numero}

                  <small>{asiento.tipo_asiento}</small>

                  <small>
                    {asiento.disponible
                      ? `$${asiento.precio.toFixed(2)}`
                      : 'Ocupado'}
                  </small>
                </button>
              ))}
          </div>
        </div>
      ))}

      {!cargando && !error && (
        <div className="viajes__tarjeta">
          <p>
            Seleccionados: {seleccionados.length}
            {' '}de {pasajeros}
          </p>

          <p>
            Total estimado sin descuentos:
            {' '}${total.toFixed(2)}
          </p>

          {seleccionados.length === pasajeros
            ? (
              <button type="button" onClick={continuarCompra}>
                Continuar con la compra
              </button>
            )
            : (
              <p>
                Selecciona los asientos restantes.
              </p>
            )}
        </div>
      )}
    </section>
  )
}

export default SeleccionAsientos
