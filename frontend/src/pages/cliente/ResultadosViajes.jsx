import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../services/api.js'
import IconoBus from './IconoBus.jsx'
import BuscarViajes from './BuscarViajes.jsx'
import {
  dinero, fechaCorta, fechaLarga, hoyEcuador, horaEnParada, iniciales, sumarDias, NOMBRE_TIPO_VIAJE,
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
  asientos: (a, b) => b.asientos_libres - a.asientos_libres,
}

// Resultados de la búsqueda con filtros (rediseño CC-20)
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
  const [modificando, setModificando] = useState(false)

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

  const ordenados = useMemo(() => [...viajes].sort(ORDENES[orden]), [viajes, orden])
  const nombreOrigen = viajes[0]?.origen
  const nombreDestino = viajes[0]?.destino

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
    const siguientes = new URLSearchParams(parametros)
    siguientes.set('fecha', nueva)
    setParametros(siguientes)
  }

  const cambiarFiltro = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value })
  const hayFiltros = Object.values(aplicados).some(Boolean)

  // Siete días alrededor de la fecha buscada (sin días pasados)
  const inicioDias = sumarDias(fecha, -3) < hoy ? hoy : sumarDias(fecha, -3)
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicioDias, i))

  return (
    <section className="viajes">
      <div className="resumen-busqueda">
        <div>
          <h1>{nombreOrigen && nombreDestino ? `${nombreOrigen} → ${nombreDestino}` : 'Viajes disponibles'}</h1>
          <p>{fechaLarga(fecha)} · {pasajeros} {pasajeros === '1' ? 'pasajero' : 'pasajeros'}</p>
        </div>
        <button type="button" className="viajes__boton viajes__boton--claro" onClick={() => setModificando(!modificando)}>
          {modificando ? 'Cerrar' : 'Modificar búsqueda'}
        </button>
      </div>

      {modificando && (
        <div style={{ marginBottom: '1.25rem' }}>
          <BuscarViajes
            inicial={{ origen, destino, fecha, pasajeros }}
            alBuscar={() => { setModificando(false); setCargando(true) }}
          />
        </div>
      )}

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

      <div className="resultados">
        <form onSubmit={aplicarFiltros} className="filtros">
          <h2>Filtrar viajes</h2>
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
            {hayFiltros && <button type="button" className="viajes__boton viajes__boton--claro" onClick={limpiarFiltros}>Quitar filtros</button>}
          </div>
        </form>

        <div>
          {error && <p role="alert" className="viajes__error">{error}</p>}

          {cargando && [1, 2, 3].map((n) => <div key={n} className="viajes__esqueleto" />)}

          {!cargando && !error && viajes.length === 0 && (
            <div className="viajes__vacio">
              <span className="viajes__vacio-icono"><IconoBus /></span>
              <strong>No hay viajes para esta fecha</strong>
              <span>
                {hayFiltros
                  ? 'Prueba quitando algunos filtros.'
                  : 'Elige otro día en la barra de fechas o cambia el origen y el destino.'}
              </span>
            </div>
          )}

          {!cargando && !error && viajes.length > 0 && (
            <>
              <div className="orden">
                <span>{viajes.length} {viajes.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}</span>
                <label className="fila" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  Ordenar por
                  <select className="form-control" style={{ width: 'auto', minHeight: 38 }} value={orden} onChange={(e) => setOrden(e.target.value)}>
                    <option value="hora">Hora de salida</option>
                    <option value="precio">Precio más bajo</option>
                    <option value="asientos">Más asientos libres</option>
                  </select>
                </label>
              </div>

              {ordenados.map((viaje) => (
                <TarjetaViaje key={`${viaje.id}-${viaje.orden_subida}-${viaje.orden_bajada}`} viaje={viaje}
                  enlace={`/viajes/${viaje.id}?subida=${origen}&bajada=${destino}&pasajeros=${pasajeros}`}
                  pasajeros={Number(pasajeros)} />
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function TarjetaViaje({ viaje, enlace, pasajeros }) {
  const pocos = viaje.asientos_libres > 0 && viaje.asientos_libres <= 5
  const sinCupo = viaje.asientos_libres < pasajeros || viaje.precio_desde === null
  return (
    <article className="viaje" style={viaje.cooperativa_color ? { '--coop': viaje.cooperativa_color } : undefined}>
      <div>
        <div className="viaje__cooperativa">
          <span className="viaje__logo">
            {viaje.cooperativa_logo ? <img src={viaje.cooperativa_logo} alt="" /> : iniciales(viaje.cooperativa)}
          </span>
          <div>
            <strong>{viaje.cooperativa}</strong>
            <span>{viaje.cooperativa_eslogan || `Bus N.º ${viaje.numero_disco} · ${viaje.placa}`}</span>
          </div>
        </div>

        <div className="trayecto">
          <div className="trayecto__punto">
            <strong>{horaEnParada(viaje.hora_salida, viaje.minutos_desde_salida)}</strong>
            <span>{viaje.origen}</span>
          </div>
          <div className="trayecto__linea">
            <span className="trayecto__etiqueta">{NOMBRE_TIPO_VIAJE[viaje.tipo_viaje] || viaje.tipo_viaje}</span>
          </div>
          <div className="trayecto__punto trayecto__punto--fin">
            <strong style={{ fontSize: '1.1rem' }}>{viaje.destino}</strong>
            <span>Llegada según recorrido</span>
          </div>
        </div>

        <div className="etiquetas">
          <span className="etiqueta">Bus {viaje.numero_disco}</span>
          <span className="etiqueta">{viaje.marca_chasis} · {viaje.marca_carroceria}</span>
          {viaje.pisos === 2 && <span className="etiqueta">2 pisos</span>}
          {(viaje.tipos_asiento || []).map((t) => <span key={t.id} className="etiqueta">{t.nombre}</span>)}
          {pocos
            ? <span className="etiqueta etiqueta--aviso">¡Quedan {viaje.asientos_libres}!</span>
            : <span className="etiqueta etiqueta--exito">{viaje.asientos_libres} asientos libres</span>}
        </div>
      </div>

      <div className="viaje__precio">
        <small>Desde</small>
        <span className="viaje__monto">{viaje.precio_desde === null ? '—' : dinero(viaje.precio_desde)}</span>
        {sinCupo
          ? <span className="etiqueta etiqueta--aviso" style={{ justifyContent: 'center' }}>Sin cupo suficiente</span>
          : <Link to={enlace} className="viajes__boton">Ver asientos</Link>}
      </div>
    </article>
  )
}

export default ResultadosViajes
