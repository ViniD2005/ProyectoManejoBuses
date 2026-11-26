import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api.js'
import IconoBus from './IconoBus.jsx'
import BuscarViajes from './BuscarViajes.jsx'
import {
  dinero, duracion, fechaCorta, fechaLarga, hoyEcuador, horaEnParada, iniciales, sumarDias, NOMBRE_TIPO_VIAJE,
} from './formatos.js'
import './Viajes.css'

const filtrosVacios = {
  cooperativa: '',
  tipoAsiento: '',
  marcaChasis: '',
  marcaCarroceria: '',
  tipoViaje: '',
}

const ORDENES = {
  hora: (a, b) => horaEnParada(a.hora_salida, a.minutos_desde_salida).localeCompare(horaEnParada(b.hora_salida, b.minutos_desde_salida)),
  precio: (a, b) => (a.precio_desde ?? Infinity) - (b.precio_desde ?? Infinity),
  duracion: (a, b) => (a.duracion_minutos ?? 0) - (b.duracion_minutos ?? 0),
  asientos: (a, b) => b.asientos_libres - a.asientos_libres,
}

/*
  Resultados de la búsqueda (GC-14):
  - el buscador queda siempre visible arriba para cambiar la búsqueda sin volver atrás
  - "Más filtros" abre los filtros extra y se aplican con un botón
  - cada viaje muestra en grande la hora y el tramo; la cooperativa va más pequeña
  - "Ver detalle" se expande en la misma tarjeta y "Seleccionar asientos" va directo
  - el servidor ya no devuelve viajes que salieron ni viajes sin asientos para todos
*/
function ResultadosViajes() {
  const [parametros, setParametros] = useSearchParams()
  const base = parametros.toString()

  const [filtros, setFiltros] = useState(filtrosVacios)
  const [aplicados, setAplicados] = useState(filtrosVacios)
  const [viajes, setViajes] = useState([])
  const [opciones, setOpciones] = useState({ cooperativas: [], tipos: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [orden, setOrden] = useState('hora')
  const [verFiltros, setVerFiltros] = useState(false)
  const [abierto, setAbierto] = useState(null)

  const origen = parametros.get('origen')
  const destino = parametros.get('destino')
  const fecha = parametros.get('fecha') || hoyEcuador()
  const pasajeros = parametros.get('pasajeros') || '1'
  const hoy = hoyEcuador()

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
          const cooperativas = new Map(anteriores.cooperativas.map((c) => [c.id, c]))
          const tipos = new Map(anteriores.tipos.map((t) => [t.id, t]))
          lista.forEach((viaje) => {
            cooperativas.set(viaje.cooperativa_id, { id: viaje.cooperativa_id, nombre: viaje.cooperativa })
            for (const tipo of viaje.tipos_asiento || []) tipos.set(tipo.id, tipo)
          })
          return { cooperativas: [...cooperativas.values()], tipos: [...tipos.values()] }
        })
        setError('')
      })
      .catch((fallo) => {
        if (activo) setError(fallo.response?.data?.mensaje || 'No pudimos consultar los viajes. Inténtalo de nuevo.')
      })
      .finally(() => { if (activo) setCargando(false) })

    return () => { activo = false }
  }, [base, aplicados])

  // GC-35: las rutas destacadas siempre van primero; dentro de cada grupo se respeta el orden elegido
  const ordenados = useMemo(() => [...viajes].sort((a, b) => (Number(Boolean(b.destacado)) - Number(Boolean(a.destacado))) || ORDENES[orden](a, b)), [viajes, orden])

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

  function cambiarFecha(nueva) {
    if (nueva === fecha) return
    setCargando(true)
    setAbierto(null)
    const siguientes = new URLSearchParams(parametros)
    siguientes.set('fecha', nueva)
    setParametros(siguientes)
  }

  const cambiarFiltro = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value })
  const cantidadFiltros = Object.values(aplicados).filter(Boolean).length

  // Siete días alrededor de la fecha buscada (sin días pasados)
  const inicioDias = sumarDias(fecha, -3) < hoy ? hoy : sumarDias(fecha, -3)
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicioDias, i))

  return (
    <section className="viajes">
      {/* El buscador se mantiene visible con los datos de la búsqueda actual */}
      <div style={{ marginBottom: '1rem' }}>
        <BuscarViajes
          key={base}
          inicial={{ origen, destino, fecha, pasajeros }}
          alBuscar={() => { setCargando(true); setAbierto(null) }}
        />
      </div>

      <nav className="dias" aria-label="Elegir otra fecha">
        {dias.map((dia) => {
          const [semana, numero, mes] = fechaCorta(dia).replace(/[.,]/g, '').split(' ')
          return (
            <button key={dia} type="button" aria-current={dia === fecha ? 'date' : undefined} onClick={() => cambiarFecha(dia)}>
              <small>{dia === hoy ? 'Hoy' : semana}</small>
              <strong>{numero}</strong>
              <small>{mes}</small>
            </button>
          )
        })}
      </nav>

      <div className="barra-resultados">
        <div>
          <strong>{cargando ? 'Buscando viajes…' : `${viajes.length} ${viajes.length === 1 ? 'viaje disponible' : 'viajes disponibles'}`}</strong>
          <span> · {fechaLarga(fecha)} · {pasajeros} {pasajeros === '1' ? 'pasajero' : 'pasajeros'}</span>
        </div>
        <div className="barra-resultados__acciones">
          <label className="barra-resultados__orden">
            Ordenar por
            <select value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="hora">Hora de salida</option>
              <option value="precio">Precio más bajo</option>
              <option value="duracion">Viaje más corto</option>
              <option value="asientos">Más asientos libres</option>
            </select>
          </label>
          <button type="button" className={`viajes__boton viajes__boton--claro ${verFiltros ? 'viajes__boton--activo' : ''}`}
            aria-expanded={verFiltros} onClick={() => setVerFiltros(!verFiltros)}>
            Más filtros{cantidadFiltros > 0 ? ` (${cantidadFiltros})` : ''} {verFiltros ? '▴' : '▾'}
          </button>
        </div>
      </div>

      {verFiltros && (
        <form onSubmit={aplicarFiltros} className="filtros filtros--horizontal">
          <label className="viajes__campo">
            <span>Cooperativa</span>
            <select value={filtros.cooperativa} onChange={cambiarFiltro('cooperativa')}>
              <option value="">Todas</option>
              {opciones.cooperativas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label className="viajes__campo">
            <span>Tipo de asiento</span>
            <select value={filtros.tipoAsiento} onChange={cambiarFiltro('tipoAsiento')}>
              <option value="">Todos</option>
              {opciones.tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </label>
          <label className="viajes__campo">
            <span>Tipo de viaje</span>
            <select value={filtros.tipoViaje} onChange={cambiarFiltro('tipoViaje')}>
              <option value="">Todos</option>
              <option value="directo">Directo</option>
              <option value="con_paradas">Con paradas</option>
            </select>
          </label>
          <label className="viajes__campo">
            <span>Marca del chasis</span>
            <input value={filtros.marcaChasis} onChange={cambiarFiltro('marcaChasis')} placeholder="Ej. Scania" />
          </label>
          <label className="viajes__campo">
            <span>Marca de carrocería</span>
            <input value={filtros.marcaCarroceria} onChange={cambiarFiltro('marcaCarroceria')} placeholder="Ej. Miral" />
          </label>
          <div className="filtros__acciones">
            <button type="submit" className="viajes__boton">Aplicar filtros</button>
            {cantidadFiltros > 0 && <button type="button" className="viajes__boton viajes__boton--claro" onClick={limpiarFiltros}>Quitar filtros</button>}
          </div>
        </form>
      )}

      {error && <p role="alert" className="viajes__error">{error}</p>}

      {cargando && [1, 2, 3].map((n) => <div key={n} className="viajes__esqueleto" />)}

      {!cargando && !error && viajes.length === 0 && (
        <div className="viajes__vacio">
          <span className="viajes__vacio-icono"><IconoBus /></span>
          <strong>No encontramos viajes con asientos para {pasajeros} {pasajeros === '1' ? 'pasajero' : 'pasajeros'}</strong>
          <span>
            {cantidadFiltros > 0
              ? 'Prueba quitando algunos filtros.'
              : fecha === hoy
                ? 'Los viajes de hoy que ya salieron no se muestran. Elige otro día en la barra de fechas.'
                : 'Elige otro día en la barra de fechas, cambia el origen y el destino o busca menos pasajeros.'}
          </span>
        </div>
      )}

      {!cargando && !error && ordenados.map((viaje) => {
        const clave = `${viaje.id}-${viaje.orden_subida}-${viaje.orden_bajada}`
        return (
          <TarjetaViaje
            key={clave}
            viaje={viaje}
            subida={origen}
            bajada={destino}
            pasajeros={pasajeros}
            abierto={abierto === clave}
            alAlternar={() => setAbierto(abierto === clave ? null : clave)}
          />
        )
      })}
    </section>
  )
}

function TarjetaViaje({ viaje, subida, bajada, pasajeros, abierto, alAlternar }) {
  const navegar = useNavigate()
  const salida = horaEnParada(viaje.hora_salida, viaje.minutos_desde_salida)
  const llegada = horaEnParada(viaje.hora_salida, viaje.minutos_llegada)
  const pocos = viaje.asientos_libres <= 5
  const consulta = `subida=${subida}&bajada=${bajada}&pasajeros=${pasajeros}`

  return (
    <article className={`viaje viaje--resultado ${abierto ? 'viaje--abierto' : ''} ${viaje.destacado ? 'viaje--destacado' : ''}`} style={viaje.cooperativa_color ? { '--coop': viaje.cooperativa_color } : undefined}>
      <div className="viaje__principal">
        {/* GC-35: ruta destacada por la cooperativa */}
        {viaje.destacado && <span className="viaje__destacado">★ Destacado</span>}
        {/* GC-43 */}
        {viaje.pago_en_linea === false && <span className="viaje__solo-ventanilla">Solo venta en ventanilla</span>}
        {/* Lo que más le importa al pasajero: horas y tramo, en grande */}
        <div className="viaje__horas">
          <div>
            <strong>{salida}</strong>
            <span>{viaje.origen}</span>
          </div>
          <div className="viaje__trayecto">
            <small>{duracion(viaje.duracion_minutos)}</small>
            <span className="trayecto__linea" />
            <small>{NOMBRE_TIPO_VIAJE[viaje.tipo_viaje] || viaje.tipo_viaje}</small>
          </div>
          <div className="viaje__llegada">
            <strong>{llegada}</strong>
            <span>{viaje.destino}</span>
          </div>
        </div>

        {/* Información secundaria, más pequeña */}
        <div className="viaje__secundario">
          <span className="viaje__logo viaje__logo--pequeno">
            {viaje.cooperativa_logo ? <img src={viaje.cooperativa_logo} alt="" /> : iniciales(viaje.cooperativa)}
          </span>
          <span>{viaje.cooperativa}</span>
          <span className="etiqueta">Bus {viaje.numero_disco}</span>
          {(viaje.tipos_asiento || []).map((t) => <span key={t.id} className="etiqueta">{t.nombre}</span>)}
          <span className={`etiqueta ${pocos ? 'etiqueta--aviso' : 'etiqueta--exito'}`}>
            {pocos ? `¡Quedan ${viaje.asientos_libres}!` : `${viaje.asientos_libres} libres`}
          </span>
        </div>
      </div>

      <div className="viaje__acciones">
        <small>Desde</small>
        <span className="viaje__monto">{viaje.precio_desde === null ? '—' : dinero(viaje.precio_desde)}</span>
        <button type="button" className="viajes__boton" onClick={() => navegar(`/viajes/${viaje.id}/asientos?${consulta}`)}>
          Seleccionar asientos
        </button>
        <button type="button" className="viajes__boton viajes__boton--claro" aria-expanded={abierto} onClick={alAlternar}>
          {abierto ? 'Ocultar detalle ▴' : 'Ver detalle ▾'}
        </button>
      </div>

      {abierto && <DetalleExpandido viaje={viaje} subida={subida} bajada={bajada} />}
    </article>
  )
}

// Detalle que se abre dentro de la tarjeta: foto del bus, datos y recorrido
function DetalleExpandido({ viaje, subida, bajada }) {
  const [detalle, setDetalle] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true
    api.get(`/viajes/${viaje.id}`, { params: { subida, bajada } })
      .then(({ data }) => { if (activo) setDetalle(data) })
      .catch((fallo) => { if (activo) setError(fallo.response?.data?.mensaje || 'No pudimos cargar el detalle del viaje.') })
    return () => { activo = false }
  }, [viaje.id, subida, bajada])

  return (
    <div className="viaje__detalle">
      <div className="viaje__foto">
        {viaje.foto_url
          ? <img src={viaje.foto_url} alt={`Bus ${viaje.numero_disco} de ${viaje.cooperativa}`} />
          : <div className="viaje__foto-vacia"><IconoBus tam={42} /><span>Sin foto del bus</span></div>}
      </div>

      <div>
        <h3>El bus</h3>
        <dl className="datos">
          <div><dt>Disco</dt><dd>{viaje.numero_disco}</dd></div>
          <div><dt>Placa</dt><dd>{viaje.placa}</dd></div>
          <div><dt>Pisos</dt><dd>{viaje.pisos}</dd></div>
          <div><dt>Chasis</dt><dd>{viaje.marca_chasis}</dd></div>
          <div><dt>Carrocería</dt><dd>{viaje.marca_carroceria}</dd></div>
          <div><dt>Cooperativa</dt><dd>{viaje.cooperativa}</dd></div>
        </dl>
        {detalle?.numero_resolucion && (
          <p className="viaje__resolucion">Frecuencia autorizada por la ANT, resolución {detalle.numero_resolucion}.</p>
        )}
      </div>

      <div>
        <h3>Recorrido</h3>
        {error && <p className="viajes__error">{error}</p>}
        {!detalle && !error && <div className="viajes__cargando"><span className="viajes__giro" /> Cargando recorrido…</div>}
        {detalle && (
          <ol className="recorrido">
            {detalle.paradas.map((parada) => {
              const enTramo = parada.orden >= detalle.orden_subida && parada.orden <= detalle.orden_bajada
              const clases = [
                enTramo && 'en-tramo',
                parada.orden === detalle.orden_subida && 'inicio-tramo',
                parada.orden === detalle.orden_bajada && 'fin-tramo',
              ].filter(Boolean).join(' ')
              return (
                <li key={parada.orden} className={clases}>
                  <span>
                    {parada.ciudad}{' '}
                    {parada.orden === detalle.orden_subida && <small>· Subes aquí</small>}
                    {parada.orden === detalle.orden_bajada && <small>· Bajas aquí</small>}
                  </span>
                  <span>{horaEnParada(detalle.hora_salida, parada.minutos_desde_salida)}</span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}

export default ResultadosViajes
