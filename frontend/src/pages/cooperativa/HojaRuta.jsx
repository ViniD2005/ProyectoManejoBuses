import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { useDialogo } from '../../hooks/useDialogo.jsx'
import './HojaRuta.css'

/*
  GC-19 - Hoja de ruta por grupo.
    1. Eliges el grupo y la fecha de inicio (y cuántos días).
    2. "Generar automáticamente": el sistema propone la rotación
       (cada día cada bus baja una fila; después de la última parada vuelve arriba).
    3. Cambias lo que necesites con los combos: si eliges un bus que ese día
       ya estaba en otra fila, los dos se intercambian (el dañado se va a parada).
    4. "Aprobar y guardar": recién ahí se crean los viajes que verán los clientes.
*/
const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
const DIAS_OPCIONES = [7, 14, 21, 28, 31]
const NOMBRE_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function encabezado(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return { dia: NOMBRE_DIA[d.getDay()], fecha: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
}

// Un color por bus para seguir su rotación de un vistazo
const colorBus = (indice, total) => `hsl(${Math.round((360 / Math.max(total, 1)) * indice)} 70% 92%)`

const copiar = (filas) => JSON.parse(JSON.stringify(filas || {}))

export default function HojaRuta() {
  const [parametros, setParametros] = useSearchParams()
  const [grupos, setGrupos] = useState(null)
  const [grupoId, setGrupoId] = useState(parametros.get('grupo') || '')
  const [desde, setDesde] = useState(hoy())
  const [dias, setDias] = useState(7)
  const [hoja, setHoja] = useState(null)
  const [filas, setFilas] = useState({})
  const [original, setOriginal] = useState({})
  const [esPropuesta, setEsPropuesta] = useState(false)
  const [error, setError] = useState('')
  const [detalleError, setDetalleError] = useState(null)
  const [aviso, setAviso] = useState('')
  const [avisos, setAvisos] = useState([])
  const [cargada, setCargada] = useState('') // grupo|desde|dias que ya se cargó
  const [guardando, setGuardando] = useState(false)
  const [dialogo, preguntar] = useDialogo()

  // Grupos activos de la cooperativa
  useEffect(() => {
    api.get('/grupos')
      .then(({ data }) => {
        const activos = data.filter((g) => g.activo)
        setGrupos(activos)
        setGrupoId((actual) => (actual && activos.some((g) => String(g.id) === String(actual)) ? actual : String(activos[0]?.id || '')))
      })
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  // Hoja guardada del periodo elegido
  const clave = `${grupoId}|${desde}|${dias}`
  const cargando = Boolean(grupoId) && cargada !== clave
  useEffect(() => {
    if (!grupoId) return
    let activo = true
    api.get('/hojas-ruta', { params: { grupo_id: grupoId, desde, dias } })
      .then(({ data }) => {
        if (!activo) return
        setHoja(data)
        setFilas(copiar(data.filas))
        setOriginal(copiar(data.filas))
        setEsPropuesta(false)
      })
      .catch((err) => activo && (setHoja(null), setError(mensajeDeError(err))))
      .finally(() => activo && setCargada(`${grupoId}|${desde}|${dias}`))
    return () => { activo = false }
  }, [grupoId, desde, dias])

  // Al cambiar el grupo o el periodo se limpian los mensajes anteriores
  const limpiarMensajes = () => {
    setError('')
    setDetalleError(null)
    setAviso('')
    setAvisos([])
  }

  const elegirGrupo = (id) => {
    limpiarMensajes()
    setGrupoId(id)
    setParametros(id ? { grupo: id } : {})
  }

  const busPorId = useMemo(() => new Map((hoja?.buses || []).map((b, i) => [b.id, { ...b, indice: i }])), [hoja])
  const F = hoja?.frecuencias.length || 0
  const totalFilas = hoja ? Math.max(hoja.buses.length, F + hoja.minimo_paradas) : 0
  const diasGuardados = hoja ? hoja.dias.filter((f) => hoja.guardado[f]).length : 0
  const cambios = useMemo(() => {
    if (!hoja) return 0
    return hoja.dias.reduce((suma, f) => suma + (filas[f] || []).slice(0, F).filter((b, i) => b !== (original[f] || [])[i]).length, 0)
  }, [hoja, filas, original, F])
  const necesarios = F + (hoja?.minimo_paradas || 2)
  const faltanBuses = hoja && hoja.buses.length < necesarios

  // ── Generar automáticamente (no guarda) ───────────────────────────
  const generar = async () => {
    if (diasGuardados > 0 || cambios > 0) {
      const ok = await preguntar({
        titulo: 'Generar la rotación automática',
        mensaje: 'La propuesta reemplazará en pantalla lo que ves ahora. No se guarda nada hasta que presiones «Aprobar y guardar».',
        textoConfirmar: 'Generar propuesta',
      })
      if (!ok) return
    }
    setError('')
    setDetalleError(null)
    setAviso('')
    try {
      const { data } = await api.post('/hojas-ruta/generar', { grupo_id: grupoId, desde, dias })
      setHoja(data)
      setFilas(copiar(data.filas))
      setEsPropuesta(true)
      setAvisos(data.avisos || [])
      setAviso('Propuesta generada. Revísala, cambia los buses que necesites y presiona «Aprobar y guardar».')
    } catch (err) {
      setError(mensajeDeError(err))
      setDetalleError(err.response?.data?.detalles || null)
    }
  }

  // ── Cambiar el bus de una celda (intercambio dentro del mismo día) ─
  const bloqueado = (fecha, fila) => fila < F && Boolean(hoja.bloqueados[fecha]?.[hoja.frecuencias[fila].id])

  const cambiarCelda = (fecha, fila, valor) => {
    const busId = Number(valor)
    const dia = [...(filas[fecha] || [])]
    while (dia.length < totalFilas) dia.push(null)
    const donde = dia.indexOf(busId)
    if (donde >= 0 && bloqueado(fecha, donde)) {
      setError(`El disco ${busPorId.get(busId)?.numero_disco} no se puede mover ese día: su viaje ya tiene boletos vendidos.`)
      return
    }
    if (donde >= 0) dia[donde] = dia[fila]
    dia[fila] = busId
    setFilas({ ...filas, [fecha]: dia })
    setError('')
    setAviso('')
  }

  const descartar = () => {
    setFilas(copiar(original))
    setEsPropuesta(false)
    setAvisos([])
    setAviso('')
    setError('')
  }

  // ── Aprobar y guardar ─────────────────────────────────────────────
  const guardar = async () => {
    const sinCompletar = hoja.dias.filter((f) => !filas[f] || filas[f].slice(0, F).some((b) => !b))
    if (sinCompletar.length) {
      setError(`Faltan buses en ${sinCompletar.length} día(s). Genera la propuesta o completa las celdas vacías.`)
      return
    }
    const ok = await preguntar({
      titulo: `¿Aprobar la hoja de ruta de ${hoja.grupo.nombre}?`,
      mensaje: 'Se crearán (o actualizarán) los viajes y los clientes podrán comprar pasajes para esas salidas.',
      detalle: (
        <>
          <span>Del <strong>{hoja.desde}</strong> al <strong>{hoja.hasta}</strong> ({hoja.dias.length} días)</span>
          <span><strong>{F}</strong> viajes por día · <strong>{hoja.buses.length - F}</strong> buses en parada</span>
        </>
      ),
      textoConfirmar: 'Aprobar y guardar',
      tono: 'exito',
    })
    if (!ok) return
    setGuardando(true)
    setError('')
    try {
      const { data } = await api.put('/hojas-ruta', {
        grupo_id: grupoId, desde, dias, generacion: esPropuesta ? 'automatica' : 'manual', filas,
      })
      setHoja(data)
      setFilas(copiar(data.filas))
      setOriginal(copiar(data.filas))
      setEsPropuesta(false)
      setAvisos([])
      setAviso(`Hoja de ruta guardada: ${data.dias.length} días con ${F} viajes cada uno.`)
    } catch (err) {
      setError(mensajeDeError(err))
      setDetalleError(err.response?.data?.detalles || null)
    } finally {
      setGuardando(false)
    }
  }

  if (grupos === null) return <div className="cargando"><span className="giro" /> Cargando…</div>

  return (
    <div className="container hoja-ruta" style={{ maxWidth: 'none' }}>
      {dialogo}
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Operación</span>
          <h1>Hoja de ruta</h1>
          <p>Elige el grupo y desde qué fecha. Genera la rotación automática, ajústala si un bus está dañado y apruébala.</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn" onClick={() => window.print()} disabled={!hoja}><Icono nombre="documento" tam={18} /> Imprimir</button>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="vacio">
          <span className="vacio__icono"><Icono nombre="capas" tam={30} /></span>
          <h3>Primero crea un grupo</h3>
          <p>La hoja de ruta se arma por grupo de buses y frecuencias.</p>
          <Link to="/cooperativa/grupos" className="btn btn-primary">Ir a Grupos</Link>
        </div>
      ) : (
        <>
          <div className="card hoja-ruta__barra">
            <div className="card-body">
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="hr-grupo">Grupo</label>
                <select id="hr-grupo" value={grupoId} onChange={(e) => elegirGrupo(e.target.value)}>
                  {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                </select>
              </div>
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="hr-desde">Desde</label>
                <input id="hr-desde" type="date" min={hoy()} value={desde} onChange={(e) => { if (e.target.value) { limpiarMensajes(); setDesde(e.target.value) } }} />
              </div>
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="hr-dias">Días</label>
                <select id="hr-dias" value={dias} onChange={(e) => { limpiarMensajes(); setDias(Number(e.target.value)) }}>
                  {DIAS_OPCIONES.map((d) => <option key={d} value={d}>{d} días</option>)}
                </select>
              </div>
              <button type="button" className="btn btn-primary" onClick={generar} disabled={!hoja || cargando}>
                <Icono nombre="rayo" tam={18} /> Generar automáticamente
              </button>
            </div>
          </div>

          {hoja && (
            <div className="hoja-ruta__resumen">
              <div className="indicador"><span className="indicador__icono"><Icono nombre="reloj" /></span><div><div className="indicador__valor">{F}</div><div className="indicador__texto">frecuencias activas</div></div></div>
              <div className="indicador"><span className="indicador__icono"><Icono nombre="bus" /></span><div><div className="indicador__valor">{hoja.buses.length}</div><div className="indicador__texto">buses activos</div></div></div>
              <div className="indicador"><span className="indicador__icono"><Icono nombre="capas" /></span><div><div className="indicador__valor">{Math.max(hoja.buses.length - F, 0)}</div><div className="indicador__texto">en parada cada día (mínimo {hoja.minimo_paradas})</div></div></div>
              <div className="indicador"><span className="indicador__icono"><Icono nombre="calendario" /></span><div><div className="indicador__valor">{diasGuardados}/{hoja.dias.length}</div><div className="indicador__texto">días guardados</div></div></div>
            </div>
          )}

          {error && (
            <div className="alerta alerta--error" role="alert">
              <Icono nombre="alerta" />
              <div>
                {error}
                {detalleError?.necesarios && <> <Link to="/cooperativa/grupos">Asignar buses en Grupos</Link></>}
                {detalleError?.faltan_frecuencias && <> <Link to="/cooperativa/grupos">Asignar frecuencias en Grupos</Link></>}
              </div>
            </div>
          )}
          {faltanBuses && !error && (
            <div className="alerta alerta--aviso">
              <Icono nombre="alerta" />
              <span>Para {F} frecuencias necesitas {necesarios} buses activos (2 en parada cada día). Tienes {hoja.buses.length}. <Link to="/cooperativa/grupos">Agregar buses al grupo</Link></span>
            </div>
          )}
          {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}
          {avisos.map((a) => <div key={a} className="alerta alerta--aviso"><Icono nombre="info" /> {a}</div>)}

          {cargando && <div className="cargando"><span className="giro" /> Cargando hoja de ruta…</div>}

          {hoja && !cargando && F > 0 && (
            <>
              {esPropuesta && <div className="hoja-ruta__sello"><Icono nombre="rayo" tam={16} /> Propuesta sin guardar</div>}
              <div className="table-responsive hoja-ruta__tabla-contenedor">
                <table className="hoja-ruta__tabla">
                  <thead>
                    <tr>
                      <th className="hoja-ruta__fija">Frecuencia</th>
                      {hoja.dias.map((fecha) => {
                        const e = encabezado(fecha)
                        return (
                          <th key={fecha} className={fecha === hoy() ? 'es-hoy' : ''}>
                            <span>{e.dia}</span><strong>{e.fecha}</strong>
                            {!hoja.guardado[fecha] && !esPropuesta && <small>sin guardar</small>}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: totalFilas }, (_, fila) => {
                      const frecuencia = hoja.frecuencias[fila]
                      return (
                        <tr key={fila} className={frecuencia ? '' : 'hoja-ruta__parada'}>
                          <th className="hoja-ruta__fija" scope="row">
                            {frecuencia ? (
                              <>
                                <strong>{frecuencia.hora_salida.slice(0, 5)}</strong> {frecuencia.origen} → {frecuencia.destino}
                                <small>{frecuencia.tipo_viaje === 'directo' ? 'Directo' : 'Con paradas'}</small>
                              </>
                            ) : (
                              <><strong>P{fila - F + 1}</strong> Parada {fila - F + 1}</>
                            )}
                          </th>
                          {hoja.dias.map((fecha) => {
                            const dia = filas[fecha]
                            if (!dia) return <td key={fecha} className="hoja-ruta__vacia">—</td>
                            const busId = dia[fila] || ''
                            const bus = busPorId.get(busId)
                            const cambiado = fila < F && busId !== (original[fecha] || [])[fila]
                            const candado = bloqueado(fecha, fila)
                            return (
                              <td key={fecha} className={`${cambiado ? 'es-cambio' : ''} ${candado ? 'es-bloqueado' : ''}`}
                                style={{ background: bus ? colorBus(bus.indice, hoja.buses.length) : undefined }}
                                title={candado ? `Tiene ${hoja.bloqueados[fecha][frecuencia.id].vendidos} boleto(s) vendido(s)` : bus ? `${bus.placa}` : ''}>
                                <select value={busId} disabled={candado} onChange={(e) => cambiarCelda(fecha, fila, e.target.value)}
                                  aria-label={`${frecuencia ? `${frecuencia.origen} → ${frecuencia.destino}` : `Parada ${fila - F + 1}`} el ${fecha}`}>
                                  {!busId && <option value="">—</option>}
                                  {hoja.buses.map((b) => <option key={b.id} value={b.id}>{b.numero_disco}</option>)}
                                </select>
                                {candado && <Icono nombre="llave" tam={12} />}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="texto-suave hoja-ruta__ayuda">
                Cada celda es el número de disco. Si eliges un disco que ese día está en otra fila, se intercambian.
                Celdas con <Icono nombre="llave" tam={12} /> tienen boletos vendidos y no se pueden mover. El borde punteado marca lo que cambiaste.
              </p>

              <div className="hoja-ruta__acciones">
                {(cambios > 0 || esPropuesta) && <button type="button" className="btn" onClick={descartar}>Descartar cambios</button>}
                <button type="button" className="btn btn-success btn--lg" onClick={guardar} disabled={guardando || faltanBuses || (!esPropuesta && cambios === 0)}>
                  <Icono nombre="checkCirculo" tam={18} /> {guardando ? 'Guardando…' : 'Aprobar y guardar'}
                </button>
              </div>
            </>
          )}
          {hoja && !cargando && F === 0 && (
            <div className="vacio">
              <span className="vacio__icono"><Icono nombre="reloj" tam={30} /></span>
              <h3>{hoja.grupo.nombre} no tiene frecuencias activas</h3>
              <Link to="/cooperativa/grupos" className="btn btn-primary">Asignar frecuencias</Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
