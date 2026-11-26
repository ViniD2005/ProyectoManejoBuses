import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api.js'
import ComboBuscador from '../../components/ComboBuscador.jsx'
import { hoyEcuador, sumarDias } from './formatos.js'
import './Viajes.css'

/*
  Buscador de pasajes (rediseño CC-20).
  - enInicio: se muestra solo la tarjeta del buscador (la portada pone el título)
  - inicial: valores con los que arranca (por ejemplo, al modificar una búsqueda)
*/
function BuscarViajes({ enInicio = false, inicial = null, alBuscar = null }) {
  const navegar = useNavigate()
  const hoy = hoyEcuador()
  const [ciudades, setCiudades] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [errores, setErrores] = useState({})

  const [busqueda, setBusqueda] = useState({
    origen: inicial?.origen || '',
    destino: inicial?.destino || '',
    fecha: inicial?.fecha || hoy,
    pasajeros: Number(inicial?.pasajeros) || 1,
  })

  useEffect(() => {
    let activo = true
    api.get('/ciudades')
      .then(({ data }) => { if (activo) setCiudades(Array.isArray(data) ? data : data.ciudades || []) })
      .catch((fallo) => { if (activo) setError(fallo.response?.data?.mensaje || 'No pudimos cargar las ciudades. Recarga la página.') })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  const cambiar = (campo, valor) => {
    setBusqueda((b) => ({ ...b, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: '' }))
  }

  const intercambiar = () => setBusqueda((b) => ({ ...b, origen: b.destino, destino: b.origen }))

  function buscar(evento) {
    evento.preventDefault()
    const nuevos = {}
    if (!busqueda.origen) nuevos.origen = 'Elige desde dónde viajas'
    if (!busqueda.destino) nuevos.destino = 'Elige a dónde viajas'
    if (busqueda.origen && busqueda.origen === busqueda.destino) nuevos.destino = 'El destino debe ser distinto del origen'
    if (!busqueda.fecha) nuevos.fecha = 'Elige la fecha del viaje'
    else if (busqueda.fecha < hoy) nuevos.fecha = 'La fecha no puede ser anterior a hoy'
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return

    const parametros = new URLSearchParams({ ...busqueda, pasajeros: String(busqueda.pasajeros) })
    if (alBuscar) alBuscar()
    navegar(`/viajes/resultados?${parametros.toString()}`)
  }

  // GC-13: cantones como "Provincia - Cantón", con buscador
  const opciones = ciudades.map((ciudad) => ({
    valor: String(ciudad.id),
    etiqueta: ciudad.etiqueta || `${ciudad.provincia} - ${ciudad.nombre}`,
  }))

  const formulario = (
    <form className="buscador" onSubmit={buscar} noValidate>
      {error && <p role="alert" className="viajes__error">{error}</p>}
      <div className="buscador__fila">
        <div className={`viajes__campo ${errores.origen ? 'viajes__campo--error' : ''}`}>
          <label htmlFor="buscar-origen" className="viajes__etiqueta">Origen</label>
          <ComboBuscador id="buscar-origen" opciones={opciones} valor={busqueda.origen} deshabilitado={cargando}
            invalido={Boolean(errores.origen)} placeholder={cargando ? 'Cargando cantones…' : '¿Desde dónde?'}
            alCambiar={(valor) => cambiar('origen', valor)} />
          {errores.origen && <small className="viajes__error-campo">{errores.origen}</small>}
        </div>

        <button type="button" className="buscador__cambiar" onClick={intercambiar}
          aria-label="Intercambiar origen y destino" title="Intercambiar origen y destino">⇄</button>

        <div className={`viajes__campo ${errores.destino ? 'viajes__campo--error' : ''}`}>
          <label htmlFor="buscar-destino" className="viajes__etiqueta">Destino</label>
          <ComboBuscador id="buscar-destino" opciones={opciones} valor={busqueda.destino} deshabilitado={cargando}
            invalido={Boolean(errores.destino)} placeholder={cargando ? 'Cargando cantones…' : '¿A dónde vas?'}
            alCambiar={(valor) => cambiar('destino', valor)} />
          {errores.destino && <small className="viajes__error-campo">{errores.destino}</small>}
        </div>

        <label className={`viajes__campo ${errores.fecha ? 'viajes__campo--error' : ''}`}>
          <span>Fecha de viaje</span>
          <input type="date" min={hoy} value={busqueda.fecha} onChange={(e) => cambiar('fecha', e.target.value)} />
          {errores.fecha && <small className="viajes__error-campo">{errores.fecha}</small>}
        </label>

        <div className="viajes__campo">
          <span>Pasajeros</span>
          <div className="buscador__contador">
            <button type="button" aria-label="Quitar un pasajero" disabled={busqueda.pasajeros <= 1}
              onClick={() => cambiar('pasajeros', busqueda.pasajeros - 1)}>−</button>
            <strong aria-live="polite">{busqueda.pasajeros}</strong>
            <button type="button" aria-label="Agregar un pasajero" disabled={busqueda.pasajeros >= 10}
              onClick={() => cambiar('pasajeros', busqueda.pasajeros + 1)}>+</button>
          </div>
        </div>

        <button className="viajes__boton viajes__boton--acento" disabled={cargando} type="submit" style={{ minHeight: 48 }}>
          Buscar pasajes
        </button>
      </div>

      <div className="buscador__atajos">
        Fecha rápida:
        {[['Hoy', hoy], ['Mañana', sumarDias(hoy, 1)], ['Pasado mañana', sumarDias(hoy, 2)]].map(([texto, valor]) => (
          <button key={texto} type="button" className={`chip ${busqueda.fecha === valor ? 'chip--activo' : ''}`}
            onClick={() => cambiar('fecha', valor)}>{texto}</button>
        ))}
        <span style={{ marginLeft: 'auto' }}>Máximo 10 pasajeros por compra</span>
      </div>
    </form>
  )

  if (enInicio || inicial) return <div className="viajes">{formulario}</div>

  return (
    <section className="viajes">
      <h1>Buscar pasajes</h1>
      <p className="viajes__sub">Elige el tramo y la fecha de tu viaje. También puedes buscar entre paradas intermedias.</p>
      {formulario}
    </section>
  )
}

export default BuscarViajes
