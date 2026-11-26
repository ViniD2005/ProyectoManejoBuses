import { useEffect, useMemo, useState } from 'react'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'

/*
  GC-13: provincias y cantones del Ecuador, administrados por el admin.
  Si se crea una provincia o un cantón nuevo, se agrega aquí sin llamar a un desarrollador.
  Los cantones se usan en las frecuencias y en el buscador de viajes como "Provincia - Cantón".
*/

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function Ubicaciones() {
  const [provincias, setProvincias] = useState([])
  const [cantones, setCantones] = useState([])
  const [elegida, setElegida] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [panel, setPanel] = useState(null) // { tipo: 'provincia' | 'canton', registro? }
  const [porEliminar, setPorEliminar] = useState(null) // id del cantón que espera confirmación

  const cargar = () =>
    Promise.all([api.get('/provincias/gestion'), api.get('/ciudades/gestion')])
      .then(([p, c]) => {
        setProvincias(p.data)
        setCantones(c.data)
        setElegida((actual) => actual ?? p.data[0]?.id ?? null)
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const texto = normalizar(filtro).trim()
  const provincia = provincias.find((p) => p.id === elegida)
  // Con texto se busca en todo el país; sin texto, solo los cantones de la provincia elegida
  const visibles = useMemo(() => cantones.filter((c) =>
    texto ? normalizar(`${c.nombre} ${c.provincia}`).includes(texto) : c.provincia_id === elegida
  ), [cantones, texto, elegida])

  const alGuardar = (mensaje) => {
    setPanel(null)
    setError('')
    setAviso(mensaje)
    cargar()
  }

  const cambiarEstado = async (ruta, registro, nombre) => {
    setError('')
    setAviso('')
    try {
      await api.patch(`/${ruta}/${registro.id}/estado`, { activa: !registro.activa })
      setAviso(registro.activa
        ? `${nombre} quedó desactivado: ya no aparece en las listas de frecuencias ni en el buscador.`
        : `${nombre} está activo nuevamente.`)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  // Se elimina en dos pasos (✕ y luego "Sí, eliminar") para evitar borrados por error
  const eliminarCanton = async (canton) => {
    setPorEliminar(null)
    setError('')
    setAviso('')
    try {
      await api.delete(`/ciudades/${canton.id}`)
      setAviso(`Se eliminó el cantón ${canton.nombre}.`)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Administración</span>
          <h1>Provincias y cantones</h1>
          <p>El catálogo de ubicaciones del Ecuador que usan las frecuencias y el buscador de viajes.</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn" onClick={() => setPanel({ tipo: 'provincia' })}>+ Provincia</button>
          <button type="button" className="btn btn-primary" onClick={() => setPanel({ tipo: 'canton' })}>+ Cantón</button>
        </div>
      </div>

      <div className="rejilla-3 mb-4">
        <div className="indicador"><span className="indicador__icono"><Icono nombre="ubicacion" /></span>
          <div><div className="indicador__valor">{provincias.length}</div><div className="indicador__texto">Provincias</div></div></div>
        <div className="indicador"><span className="indicador__icono"><Icono nombre="ruta" /></span>
          <div><div className="indicador__valor">{cantones.length}</div><div className="indicador__texto">Cantones registrados</div></div></div>
        <div className="indicador"><span className="indicador__icono"><Icono nombre="checkCirculo" /></span>
          <div><div className="indicador__valor">{cantones.filter((c) => c.activa).length}</div><div className="indicador__texto">Cantones activos</div></div></div>
      </div>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}
      {cargando && <div className="cargando"><span className="giro" /> Cargando ubicaciones…</div>}

      {!cargando && (
        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', alignItems: 'start' }}>
          {/* Provincias */}
          <section className="card" style={{ marginBottom: 0, gridColumn: 'span 1' }}>
            <div className="card-header">Provincias</div>
            <div style={{ maxHeight: 560, overflowY: 'auto', padding: '.4rem' }}>
              {provincias.map((p) => (
                <div key={p.id} className="fila fila--entre" style={{ flexWrap: 'nowrap', padding: '.55rem .7rem', borderRadius: 10, cursor: 'pointer',
                  background: p.id === elegida && !texto ? 'var(--marca-suave)' : undefined }}
                  onClick={() => { setElegida(p.id); setFiltro('') }}>
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: p.activa ? undefined : 'var(--texto-tenue)' }}>{p.nombre}</strong>
                    <small className="texto-suave">{p.cantones} {p.cantones === 1 ? 'cantón' : 'cantones'}{p.activa ? '' : ' · inactiva'}</small>
                  </span>
                  <span className="fila" style={{ gap: '.3rem', flexWrap: 'nowrap' }}>
                    <button type="button" className="btn btn-sm btn--fantasma" title="Editar provincia"
                      onClick={(e) => { e.stopPropagation(); setPanel({ tipo: 'provincia', registro: p }) }}><Icono nombre="editar" tam={16} /></button>
                    <button type="button" className={`btn btn-sm ${p.activa ? 'btn--fantasma' : 'btn-outline-success'}`} title={p.activa ? 'Desactivar' : 'Activar'}
                      onClick={(e) => { e.stopPropagation(); cambiarEstado('provincias', p, p.nombre) }}><Icono nombre="apagar" tam={16} /></button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Cantones */}
          <section className="card" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <div className="card-header fila fila--entre">
              <span>{texto ? `Resultados para "${filtro}"` : `Cantones de ${provincia?.nombre || '…'}`} · {visibles.length}</span>
              <input className="form-control" style={{ maxWidth: 300, minHeight: 38 }} placeholder="Buscar un cantón en todo el país"
                value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar cantón" />
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Cantón</th><th>Provincia</th><th>Uso</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {visibles.map((c) => (
                    <tr key={c.id}>
                      <td><strong>{c.nombre}</strong></td>
                      <td>{c.provincia}</td>
                      <td>{c.en_uso > 0 ? <span className="insignia insignia--info">En {c.en_uso} {c.en_uso === 1 ? 'recorrido' : 'recorridos'}</span> : <span className="texto-suave">—</span>}</td>
                      <td><span className={`insignia ${c.activa ? 'insignia--exito' : 'insignia--error'}`}>{c.activa ? 'Activo' : 'Inactivo'}</span></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-sm" onClick={() => setPanel({ tipo: 'canton', registro: c })}>Editar</button>
                        <button type="button" className={`btn btn-sm ${c.activa ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => cambiarEstado('ciudades', c, c.nombre)}>
                          {c.activa ? 'Desactivar' : 'Activar'}
                        </button>
                        {porEliminar === c.id ? (
                          <span className="fila" style={{ display: 'inline-flex', gap: '.35rem', marginLeft: '.35rem' }}>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => eliminarCanton(c)}>Sí, eliminar</button>
                            <button type="button" className="btn btn-sm" onClick={() => setPorEliminar(null)}>No</button>
                          </span>
                        ) : c.en_uso === 0 ? (
                          <button type="button" className="btn btn-sm btn--fantasma" title="Eliminar cantón" aria-label={`Eliminar ${c.nombre}`} onClick={() => setPorEliminar(c.id)}>✕</button>
                        ) : (
                          <span className="btn btn-sm btn--fantasma" style={{ visibility: 'hidden' }} aria-hidden="true">✕</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {visibles.length === 0 && (
                    <tr><td colSpan={5} className="text-center texto-suave" style={{ padding: '2rem' }}>
                      {texto ? 'Ningún cantón coincide con la búsqueda.' : 'Esta provincia todavía no tiene cantones.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {panel?.tipo === 'provincia' && <PanelProvincia registro={panel.registro} alCerrar={() => setPanel(null)} alGuardar={alGuardar} />}
      {panel?.tipo === 'canton' && (
        <PanelCanton registro={panel.registro} provincias={provincias} provinciaInicial={elegida}
          alCerrar={() => setPanel(null)} alGuardar={alGuardar} />
      )}
    </div>
  )
}

// Ventana para crear o renombrar una provincia
function PanelProvincia({ registro, alCerrar, alGuardar }) {
  const [nombre, setNombre] = useState(registro?.nombre || '')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      if (registro) {
        await api.put(`/provincias/${registro.id}`, { nombre })
        alGuardar(`La provincia se renombró a ${nombre.trim()}.`)
      } else {
        await api.post('/provincias', { nombre })
        alGuardar(`Se registró la provincia ${nombre.trim()}. Ahora agrégale sus cantones.`)
      }
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="capa capa--centro" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar() }}>
      <form className="modal" onSubmit={guardar} noValidate>
        <div className="panel__cabecera" style={{ position: 'static' }}>
          <div>
            <h2>{registro ? 'Editar provincia' : 'Nueva provincia'}</h2>
            <p>{registro ? 'Al renombrarla, sus cantones toman el nombre nuevo.' : 'Por ejemplo, si se crea una provincia nueva en el país.'}</p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="panel__cuerpo">
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}
          <div className={`campo ${errores.nombre ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor="provincia-nombre">Nombre de la provincia</label>
            <input id="provincia-nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setErrores({}) }} autoFocus placeholder="Ej. Santa Elena" />
            {errores.nombre && <span className="campo__error">{errores.nombre}</span>}
          </div>
        </div>
        <div className="panel__pie" style={{ position: 'static' }}>
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}

// Ventana para crear o editar un cantón
function PanelCanton({ registro, provincias, provinciaInicial, alCerrar, alGuardar }) {
  const [form, setForm] = useState({
    nombre: registro?.nombre || '',
    provincia_id: String(registro?.provincia_id || provinciaInicial || ''),
  })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrores({ ...errores, [e.target.name]: '' })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const datos = { nombre: form.nombre, provincia_id: Number(form.provincia_id) }
      const { data } = registro ? await api.put(`/ciudades/${registro.id}`, datos) : await api.post('/ciudades', datos)
      alGuardar(registro ? `Se actualizó el cantón ${data.etiqueta}.` : `Se registró el cantón ${data.etiqueta}.`)
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="capa capa--centro" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar() }}>
      <form className="modal" onSubmit={guardar} noValidate>
        <div className="panel__cabecera" style={{ position: 'static' }}>
          <div>
            <h2>{registro ? 'Editar cantón' : 'Nuevo cantón'}</h2>
            <p>Aparecerá como "Provincia - Cantón" en frecuencias y en el buscador.</p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="panel__cuerpo">
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}
          <div className={`campo ${errores.provincia_id ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor="canton-provincia">Provincia</label>
            <select id="canton-provincia" name="provincia_id" value={form.provincia_id} onChange={cambiar}>
              <option value="">Elige una provincia</option>
              {provincias.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            {errores.provincia_id && <span className="campo__error">{errores.provincia_id}</span>}
          </div>
          <div className={`campo ${errores.nombre ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor="canton-nombre">Nombre del cantón</label>
            <input id="canton-nombre" name="nombre" value={form.nombre} onChange={cambiar} placeholder="Ej. Baños de Agua Santa" />
            {errores.nombre && <span className="campo__error">{errores.nombre}</span>}
          </div>
        </div>
        <div className="panel__pie" style={{ position: 'static' }}>
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}
