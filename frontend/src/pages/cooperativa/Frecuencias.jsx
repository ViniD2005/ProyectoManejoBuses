import { useEffect, useMemo, useState } from 'react'
import api, { mensajeDeError } from '../../services/api.js'
import ComboBuscador from '../../components/ComboBuscador.jsx'
import Icono from '../../components/Icono.jsx'
import { useDialogo } from '../../hooks/useDialogo.jsx'
import './Frecuencias.css'

/*
  GC-21 - Frecuencias de la cooperativa.
  Tabla con todas las rutas autorizadas por la ANT (búsqueda y filtros) y un
  panel lateral para registrar o EDITAR una frecuencia con su recorrido
  (origen, paradas intermedias y destino, cada una con minutos y precio
  acumulado). Si ya hay boletos vendidos, solo se corrige la resolución.
*/
const FORM_VACIO = {
  ciudad_origen_id: '',
  ciudad_destino_id: '',
  hora_salida: '',
  numero_resolucion: '',
  fecha_resolucion: '',
  duracion_minutos: '',
  precio_total: '',
}
const PARADA_VACIA = { ciudad_id: '', minutos_desde_salida: '', precio_acumulado: '' }

const dinero = (n) => (n === null || n === undefined || n === '' ? '—' : `$${Number(n).toFixed(2)}`)
const duracion = (min) => {
  const m = Number(min)
  if (!m) return '—'
  const h = Math.floor(m / 60)
  return h ? `${h} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`
}
const hoy = () => new Date().toLocaleDateString('en-CA')

export default function Frecuencias() {
  const [frecuencias, setFrecuencias] = useState(null)
  const [ciudades, setCiudades] = useState([])
  const [form, setForm] = useState(null) // null = panel cerrado
  const [idEdicion, setIdEdicion] = useState(null)
  const [bloqueada, setBloqueada] = useState(0) // boletos futuros de la frecuencia que se edita
  const [paradas, setParadas] = useState([])
  const [nuevaParada, setNuevaParada] = useState(PARADA_VACIA)
  const [recorrido, setRecorrido] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('todas')
  const [dialogo, preguntar] = useDialogo()

  const cargarFrecuencias = () =>
    api.get('/frecuencias')
      .then(({ data }) => setFrecuencias(data))
      .catch((err) => { setFrecuencias([]); setError(mensajeDeError(err)) })

  useEffect(() => {
    cargarFrecuencias()
    api.get('/ciudades').then(({ data }) => setCiudades(data)).catch((err) => setError(mensajeDeError(err)))
  }, [])

  // GC-13: los cantones se muestran como "Provincia - Cantón"
  const opcionesCiudad = useMemo(
    () => ciudades.map((c) => ({ valor: String(c.id), etiqueta: c.etiqueta || `${c.provincia} - ${c.nombre}` })),
    [ciudades]
  )
  const nombreCiudad = (id) => opcionesCiudad.find((c) => c.valor === String(id))?.etiqueta || '—'

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return (frecuencias || []).filter((f) =>
      (estado === 'todas' || (estado === 'activas' ? f.activa : !f.activa)) &&
      (!q || [f.origen_etiqueta, f.destino_etiqueta, f.numero_resolucion, f.hora_salida].some((x) => String(x || '').toLowerCase().includes(q))))
  }, [frecuencias, texto, estado])

  // ── Abrir el panel ────────────────────────────────────────────────
  const abrirNueva = () => {
    setForm({ ...FORM_VACIO })
    setParadas([])
    setNuevaParada(PARADA_VACIA)
    setIdEdicion(null)
    setBloqueada(0)
    setErrores({})
    setError('')
  }

  const abrirEdicion = async (frecuencia) => {
    setError('')
    try {
      const { data } = await api.get(`/frecuencias/${frecuencia.id}`)
      const intermedias = data.paradas.slice(1, -1)
      setForm({
        ciudad_origen_id: String(data.ciudad_origen_id),
        ciudad_destino_id: String(data.ciudad_destino_id),
        hora_salida: data.hora_salida.slice(0, 5),
        numero_resolucion: data.numero_resolucion,
        fecha_resolucion: data.fecha_resolucion || '',
        duracion_minutos: String(data.duracion_minutos ?? ''),
        precio_total: String(data.precio_total ?? ''),
      })
      setParadas(intermedias.map((p) => ({ ciudad_id: p.ciudad_id, minutos_desde_salida: p.minutos_desde_salida, precio_acumulado: p.precio_acumulado })))
      setNuevaParada(PARADA_VACIA)
      setIdEdicion(data.id)
      setBloqueada(data.boletos_futuros)
      setErrores({})
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const cerrar = () => { setForm(null); setIdEdicion(null); setErrores({}) }

  const cambiar = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrores({ ...errores, [e.target.name]: '' })
  }
  const cambiarParada = (e) => setNuevaParada({ ...nuevaParada, [e.target.name]: e.target.value })

  // Las paradas se ordenan solas por los minutos desde la salida
  const agregarParada = () => {
    const minutos = Number(nuevaParada.minutos_desde_salida)
    const precio = Number(nuevaParada.precio_acumulado)
    if (!nuevaParada.ciudad_id || !(minutos > 0) || !(precio > 0)) {
      setErrores({ ...errores, paradas: 'Elige el cantón y escribe minutos y precio acumulado mayores a 0' })
      return
    }
    if (form.duracion_minutos && minutos >= Number(form.duracion_minutos)) {
      setErrores({ ...errores, paradas: 'La parada debe estar antes de llegar al destino (menos minutos que la duración total)' })
      return
    }
    const lista = [...paradas, { ciudad_id: Number(nuevaParada.ciudad_id), minutos_desde_salida: minutos, precio_acumulado: precio }]
      .sort((a, b) => a.minutos_desde_salida - b.minutos_desde_salida)
    setParadas(lista)
    setNuevaParada(PARADA_VACIA)
    setErrores({ ...errores, paradas: '' })
  }

  const quitarParada = (indice) => setParadas(paradas.filter((_, i) => i !== indice))

  // ── Guardar ───────────────────────────────────────────────────────
  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setErrores({})
    const cuerpo = {
      ...form,
      ciudad_origen_id: Number(form.ciudad_origen_id) || '',
      ciudad_destino_id: Number(form.ciudad_destino_id) || '',
      duracion_minutos: Number(form.duracion_minutos),
      precio_total: Number(form.precio_total),
      fecha_resolucion: form.fecha_resolucion || null,
      paradas_intermedias: paradas,
    }
    try {
      const { data } = idEdicion
        ? await api.put(`/frecuencias/${idEdicion}`, cuerpo)
        : await api.post('/frecuencias', cuerpo)
      setAviso(idEdicion
        ? `Frecuencia ${data.origen} → ${data.destino} actualizada.`
        : `Frecuencia ${data.origen} → ${data.destino} ${data.hora_salida.slice(0, 5)} registrada. Asígnala a un grupo para que entre en la hoja de ruta.`)
      cerrar()
      cargarFrecuencias()
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const alternarEstado = async (frecuencia) => {
    if (frecuencia.activa) {
      const ok = await preguntar({
        titulo: `¿Desactivar ${frecuencia.origen} → ${frecuencia.destino} ${frecuencia.hora_salida.slice(0, 5)}?`,
        mensaje: frecuencia.viajes_programados > 0
          ? `Tiene ${frecuencia.viajes_programados} viaje(s) programado(s). Una frecuencia inactiva no entra en las próximas hojas de ruta.`
          : 'Una frecuencia inactiva no entra en las próximas hojas de ruta.',
        textoConfirmar: 'Desactivar',
        tono: 'peligro',
      })
      if (!ok) return
    }
    setError('')
    try {
      await api.patch(`/frecuencias/${frecuencia.id}/estado`, { activa: !frecuencia.activa })
      setAviso(frecuencia.activa ? 'Frecuencia desactivada.' : 'Frecuencia activada.')
      cargarFrecuencias()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const verRecorrido = async (frecuencia) => {
    try {
      const { data } = await api.get(`/frecuencias/${frecuencia.id}`)
      setRecorrido(data)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const campo = (name, etiqueta, props = {}, ayuda = '') => (
    <div className={`campo ${errores[name] ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={`frec-${name}`}>{etiqueta}</label>
      <input id={`frec-${name}`} name={name} value={form[name]} onChange={cambiar} aria-invalid={!!errores[name]} {...props} />
      {errores[name] ? <span className="campo__error">{errores[name]}</span> : ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </div>
  )

  const selectorCiudad = (name, etiqueta, deshabilitado) => (
    <div className={`campo ${errores[name] ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={`frec-${name}`}>{etiqueta}</label>
      <ComboBuscador id={`frec-${name}`} opciones={opcionesCiudad} valor={form[name]} deshabilitado={deshabilitado}
        invalido={!!errores[name]} placeholder="Escribe provincia o cantón"
        alCambiar={(valor) => { setForm({ ...form, [name]: valor }); setErrores({ ...errores, [name]: '' }) }} />
      {errores[name] && <span className="campo__error">{errores[name]}</span>}
    </div>
  )

  if (frecuencias === null) return <div className="cargando"><span className="giro" /> Cargando frecuencias…</div>

  const soloResolucion = bloqueada > 0

  return (
    <div className="container">
      {dialogo}
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Operación</span>
          <h1>Frecuencias</h1>
          <p>Las rutas y horarios autorizados por la ANT, con sus paradas y precios por tramo.</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn btn-primary" onClick={abrirNueva}><Icono nombre="mas" tam={18} /> Nueva frecuencia</button>
        </div>
      </div>

      {error && !form && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}

      <div className="card">
        <div className="card-body frec__filtros">
          <div className="campo frec__buscar">
            <label className="campo__etiqueta" htmlFor="frec-buscar">Buscar</label>
            <input id="frec-buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Cantón, provincia, hora o resolución" />
          </div>
          <div className="pestanas" role="tablist" aria-label="Estado">
            {[['todas', 'Todas'], ['activas', 'Activas'], ['inactivas', 'Inactivas']].map(([valor, etiqueta]) => (
              <button key={valor} type="button" role="tab" aria-selected={estado === valor} onClick={() => setEstado(valor)}>{etiqueta}</button>
            ))}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr><th>Salida</th><th>Ruta</th><th>Tipo</th><th>Duración</th><th>Precio</th><th>Resolución ANT</th><th>Estado</th><th aria-label="Acciones" /></tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.id} className={f.activa ? '' : 'frec__inactiva'}>
                  <td><strong className="frec__hora">{f.hora_salida.slice(0, 5)}</strong></td>
                  <td>
                    <span className="frec__ruta">{f.origen_etiqueta}</span>
                    <span className="frec__ruta"><Icono nombre="flecha" tam={14} /> {f.destino_etiqueta}</span>
                  </td>
                  <td>{f.tipo_viaje === 'directo' ? <span className="insignia insignia--info">Directo</span> : <span className="insignia">{f.total_paradas - 2} parada{f.total_paradas - 2 === 1 ? '' : 's'}</span>}</td>
                  <td>{duracion(f.duracion_minutos)}</td>
                  <td><strong>{dinero(f.precio_total)}</strong></td>
                  <td><span className="frec__resolucion">{f.numero_resolucion}</span>{f.fecha_resolucion && <small className="texto-suave">{f.fecha_resolucion}</small>}</td>
                  <td>
                    <span className={`insignia ${f.activa ? 'insignia--exito' : 'insignia--error'}`}>{f.activa ? 'Activa' : 'Inactiva'}</span>
                    {f.boletos_futuros > 0 && <small className="texto-suave frec__vendidos">{f.boletos_futuros} boleto(s) vendido(s)</small>}
                  </td>
                  <td className="frec__acciones">
                    <button type="button" className="btn btn-sm btn--fantasma" onClick={() => verRecorrido(f)}><Icono nombre="ruta" tam={16} /> Recorrido</button>
                    <button type="button" className="btn btn-sm" onClick={() => abrirEdicion(f)}><Icono nombre="editar" tam={16} /> Editar</button>
                    <button type="button" className="btn btn-sm btn--fantasma" onClick={() => alternarEstado(f)}><Icono nombre="apagar" tam={16} /> {f.activa ? 'Desactivar' : 'Activar'}</button>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr><td colSpan={8} className="text-center texto-suave">{frecuencias.length ? 'Ninguna frecuencia coincide con la búsqueda.' : 'Aún no registras frecuencias. Presiona «Nueva frecuencia».'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recorrido de una frecuencia */}
      {recorrido && (
        <div className="capa capa--centro" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setRecorrido(null)}>
          <div className="modal frec__modal" role="dialog" aria-labelledby="titulo-recorrido">
            <div className="panel__cabecera">
              <div>
                <h2 id="titulo-recorrido">{recorrido.origen} → {recorrido.destino}</h2>
                <p>Sale a las {recorrido.hora_salida.slice(0, 5)} · {duracion(recorrido.duracion_minutos)} · {dinero(recorrido.precio_total)}</p>
              </div>
              <button type="button" className="btn btn--fantasma btn--icono" onClick={() => setRecorrido(null)} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
            </div>
            <div className="panel__cuerpo">
              <ol className="frec__linea">
                {recorrido.paradas.map((p) => (
                  <li key={p.orden}>
                    <strong>{p.ciudad_etiqueta}</strong>
                    <span>{p.orden === 1 ? 'Salida' : `+${duracion(p.minutos_desde_salida)}`} · {p.orden === 1 ? '—' : dinero(p.precio_acumulado)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Panel lateral: nueva / editar */}
      {form && (
        <div className="capa" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
          <form className="panel" onSubmit={guardar} noValidate role="dialog" aria-labelledby="titulo-frec">
            <div className="panel__cabecera">
              <div>
                <h2 id="titulo-frec">{idEdicion ? 'Editar frecuencia' : 'Nueva frecuencia'}</h2>
                <p>Origen, destino y paradas como «Provincia - Cantón». Las paradas se ordenan solas.</p>
              </div>
              <button type="button" className="btn btn--fantasma btn--icono" onClick={cerrar} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
            </div>
            <div className="panel__cuerpo">
              {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
              {soloResolucion && (
                <div className="alerta alerta--aviso">
                  <Icono nombre="llave" />
                  <span>Tiene <b>{bloqueada} boleto(s) vendido(s)</b> para viajes próximos: solo puedes corregir los datos de la resolución.</span>
                </div>
              )}

              <h3 className="frec__seccion">Ruta</h3>
              {selectorCiudad('ciudad_origen_id', 'Origen (provincia - cantón)', soloResolucion)}
              {selectorCiudad('ciudad_destino_id', 'Destino (provincia - cantón)', soloResolucion)}
              <div className="rejilla-3">
                {campo('hora_salida', 'Hora de salida', { type: 'time', disabled: soloResolucion })}
                {campo('duracion_minutos', 'Duración (min)', { type: 'number', min: 10, max: 1440, disabled: soloResolucion }, duracion(form.duracion_minutos))}
                {campo('precio_total', 'Precio total ($)', { type: 'number', min: 0.25, max: 100, step: 0.05, disabled: soloResolucion })}
              </div>

              <h3 className="frec__seccion">Paradas intermedias <small>(opcional)</small></h3>
              {paradas.length > 0 && (
                <ol className="frec__linea frec__linea--editable">
                  <li><strong>{nombreCiudad(form.ciudad_origen_id)}</strong><span>Salida</span></li>
                  {paradas.map((p, i) => (
                    <li key={`${p.ciudad_id}-${i}`}>
                      <strong>{nombreCiudad(p.ciudad_id)}</strong>
                      <span>+{duracion(p.minutos_desde_salida)} · {dinero(p.precio_acumulado)}</span>
                      {!soloResolucion && <button type="button" className="btn btn-sm btn--fantasma" onClick={() => quitarParada(i)} aria-label="Quitar parada">✕</button>}
                    </li>
                  ))}
                  <li><strong>{nombreCiudad(form.ciudad_destino_id)}</strong><span>+{duracion(form.duracion_minutos)} · {dinero(form.precio_total)}</span></li>
                </ol>
              )}
              {!soloResolucion && (
                <div className="frec__nueva-parada">
                  <div className="campo">
                    <label className="campo__etiqueta" htmlFor="parada-ciudad">Parada (provincia - cantón)</label>
                    <ComboBuscador id="parada-ciudad" opciones={opcionesCiudad} valor={String(nuevaParada.ciudad_id)} placeholder="Escribe el cantón"
                      alCambiar={(valor) => setNuevaParada({ ...nuevaParada, ciudad_id: valor })} />
                  </div>
                  <div className="rejilla-3">
                    <div className="campo">
                      <label className="campo__etiqueta" htmlFor="parada-min">Minutos desde la salida</label>
                      <input id="parada-min" name="minutos_desde_salida" type="number" min={1} value={nuevaParada.minutos_desde_salida} onChange={cambiarParada} />
                    </div>
                    <div className="campo">
                      <label className="campo__etiqueta" htmlFor="parada-precio">Precio acumulado ($)</label>
                      <input id="parada-precio" name="precio_acumulado" type="number" min={0.05} step={0.05} value={nuevaParada.precio_acumulado} onChange={cambiarParada} />
                    </div>
                    <button type="button" className="btn frec__agregar" onClick={agregarParada}><Icono nombre="mas" tam={16} /> Agregar parada</button>
                  </div>
                </div>
              )}
              {errores.paradas && <span className="campo__error">{errores.paradas}</span>}

              <h3 className="frec__seccion">Resolución de la ANT</h3>
              <div className="rejilla-2">
                {campo('numero_resolucion', 'Número de resolución', { placeholder: 'ANT-RES-2025-0145', maxLength: 60 })}
                {campo('fecha_resolucion', 'Fecha de la resolución', { type: 'date', max: hoy() })}
              </div>
            </div>
            <div className="panel__pie">
              <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : idEdicion ? 'Guardar cambios' : 'Registrar frecuencia'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
