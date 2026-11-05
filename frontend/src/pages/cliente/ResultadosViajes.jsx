
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../services/api.js'
import './Viajes.css'

const filtrosVacios = {
  cooperativa: '',
  tipoAsiento: '',
  marcaChasis: '',
  marcaCarroceria: '',
  tipoViaje: '',
}

function ResultadosViajes() {
  const [parametros] = useSearchParams()
  const base = parametros.toString()

  const [filtros, setFiltros] = useState(filtrosVacios)
  const [aplicados, setAplicados] = useState(filtrosVacios)
  const [viajes, setViajes] = useState([])
  const [opciones, setOpciones] = useState({
    cooperativas: [],
    tipos: [],
  })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const origen = parametros.get('origen')
  const destino = parametros.get('destino')
  const pasajeros = parametros.get('pasajeros') || '1'

  useEffect(() => {
    let activo = true

    const consulta = new URLSearchParams(base)

    Object.entries(aplicados).forEach(([clave, valor]) => {
      if (valor) consulta.set(clave, valor)
    })

    api.get(`/viajes/buscar?${consulta.toString()}`)
      .then(({ data }) => {
        if (!activo) return

        const lista = Array.isArray(data) ? data : []
        setViajes(lista)

        setOpciones((anteriores) => {
          const cooperativas = new Map(
            anteriores.cooperativas.map((c) => [c.id, c])
          )
          const tipos = new Map(
            anteriores.tipos.map((t) => [t.id, t])
          )

          lista.forEach((viaje) => {
            cooperativas.set(viaje.cooperativa_id, {
              id: viaje.cooperativa_id,
              nombre: viaje.cooperativa,
            })

            for (const tipo of viaje.tipos_asiento || []) {
              tipos.set(tipo.id, tipo)
            }
          })

          return {
            cooperativas: [...cooperativas.values()],
            tipos: [...tipos.values()],
          }
        })

        setError('')
      })
      .catch((fallo) => {
        if (activo) {
          setError(
            fallo.response?.data?.mensaje ||
            'No se pudieron consultar los viajes'
          )
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })

    return () => { activo = false }
  }, [base, aplicados])

  function aplicarFiltros(evento) {
    evento.preventDefault()
    setCargando(true)
    setAplicados({ ...filtros })
  }

  function limpiarFiltros() {
    setFiltros({ ...filtrosVacios })
    setCargando(true)
    setAplicados({ ...filtrosVacios })
  }

  return (
    <section className="viajes">
      <h1>Viajes disponibles</h1>
      <Link to="/viajes">Cambiar búsqueda</Link>

      <form
        onSubmit={aplicarFiltros}
        className="viajes__formulario"
      >
        <label>
          Cooperativa
          <select
            value={filtros.cooperativa}
            onChange={(e) => setFiltros({
              ...filtros,
              cooperativa: e.target.value,
            })}
          >
            <option value="">Todas</option>
            {opciones.cooperativas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tipo de asiento
          <select
            value={filtros.tipoAsiento}
            onChange={(e) => setFiltros({
              ...filtros,
              tipoAsiento: e.target.value,
            })}
          >
            <option value="">Todos</option>
            {opciones.tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>

        <label>
          Marca del chasis
          <input
            value={filtros.marcaChasis}
            onChange={(e) => setFiltros({
              ...filtros,
              marcaChasis: e.target.value,
            })}
          />
        </label>

        <label>
          Marca de carrocería
          <input
            value={filtros.marcaCarroceria}
            onChange={(e) => setFiltros({
              ...filtros,
              marcaCarroceria: e.target.value,
            })}
          />
        </label>

        <label>
          Tipo de viaje
          <select
            value={filtros.tipoViaje}
            onChange={(e) => setFiltros({
              ...filtros,
              tipoViaje: e.target.value,
            })}
          >
            <option value="">Todos</option>
            <option value="directo">Directo</option>
            <option value="con_paradas">
              Con paradas
            </option>
          </select>
        </label>

        <button type="submit">Aplicar filtros</button>
        <button type="button" onClick={limpiarFiltros}>
          Limpiar filtros
        </button>
      </form>

      {cargando && <p>Buscando viajes...</p>}

      {error && (
        <p role="alert" className="viajes__error">
          {error}
        </p>
      )}

      {!cargando && !error && viajes.length === 0 && (
        <p>No hay viajes para esta búsqueda.</p>
      )}

      {!cargando && !error && (
        <div className="viajes__lista">
          {viajes.map((viaje) => (
            <article
              key={`${viaje.id}-${viaje.orden_subida}-${viaje.orden_bajada}`}
              className="viajes__tarjeta"
            >
              <h2>{viaje.cooperativa}</h2>

              <p>
                {viaje.origen} → {viaje.destino}
                {' · '}{viaje.fecha}
              </p>

              <p>
                Salida de frecuencia:
                {' '}{viaje.hora_salida.slice(0, 5)}
              </p>

              <p>
                Bus {viaje.numero_disco}
                {' · '}{viaje.placa}
              </p>

              <p>Asientos libres: {viaje.asientos_libres}</p>

              <strong>
                Desde:{' '}
                {viaje.precio_desde === null
                  ? 'Sin disponibilidad'
                  : `$${viaje.precio_desde.toFixed(2)}`}
              </strong>

              {' '}
              <Link
                to={`/viajes/${viaje.id}?subida=${origen}&bajada=${destino}&pasajeros=${pasajeros}`}
              >
                Ver detalle
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default ResultadosViajes
