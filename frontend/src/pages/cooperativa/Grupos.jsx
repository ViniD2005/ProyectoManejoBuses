import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { useDialogo } from '../../hooks/useDialogo.jsx'
import './HojaRuta.css'

/*
  GC-19 - Grupos de buses y frecuencias.
  Una cooperativa separa su operación: Urbano (Centro - Ficoa), Interprovincial
  (Ambato - Quito), Rural... Cada bus y cada frecuencia pertenece a UN grupo,
  y la hoja de ruta se genera por grupo. Así un bus urbano nunca cae en una
  ruta interprovincial.
*/
const MIN_PARADAS = 2
const VACIO = { nombre: '', descripcion: '' }
const hora = (h) => h?.slice(0, 5)

function Cobertura({ grupo }) {
  const necesarios = grupo.frecuencias_activas + MIN_PARADAS
  if (grupo.frecuencias_activas === 0) return <span className="insignia insignia--aviso">Sin frecuencias</span>
  const ok = grupo.buses_activos >= necesarios
  return (
    <span className={`insignia ${ok ? 'insignia--exito' : 'insignia--error'}`}
      title={`${grupo.frecuencias_activas} frecuencias + ${MIN_PARADAS} buses en parada`}>
      {ok ? `Listo para la hoja de ruta (${grupo.buses_activos - grupo.frecuencias_activas} en parada)` : `Faltan ${necesarios - grupo.buses_activos} bus(es)`}
    </span>
  )
}

export default function Grupos() {
  const [grupos, setGrupos] = useState([])
  const [recursos, setRecursos] = useState({ buses: [], frecuencias: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [formulario, setFormulario] = useState(null) // { id?, nombre, descripcion }
  const [errores, setErrores] = useState({})
  const [asignando, setAsignando] = useState(null) // { grupo, pestana, seleccion: Set }
  const [guardando, setGuardando] = useState(false)
  const [dialogo, preguntar] = useDialogo()

  const cargar = () =>
    Promise.all([api.get('/grupos'), api.get('/grupos/recursos')])
      .then(([g, r]) => {
        setGrupos(g.data)
        setRecursos(r.data)
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const sinGrupo = useMemo(() => ({
    buses: recursos.buses.filter((b) => !b.grupo_id).length,
    frecuencias: recursos.frecuencias.filter((f) => !f.grupo_id).length,
  }), [recursos])

  const avisar = (texto) => { setAviso(texto); setError('') }

  // ── Crear / editar ────────────────────────────────────────────────
  const guardarGrupo = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setErrores({})
    try {
      const datos = { nombre: formulario.nombre, descripcion: formulario.descripcion }
      if (formulario.id) await api.put(`/grupos/${formulario.id}`, datos)
      else await api.post('/grupos', datos)
      avisar(formulario.id ? 'Grupo actualizado.' : `Grupo "${formulario.nombre.trim()}" creado. Ahora asígnale buses y frecuencias.`)
      setFormulario(null)
      cargar()
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
      if (!err.response?.data?.detalles) setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const cambiarEstado = async (grupo) => {
    if (grupo.activo) {
      const ok = await preguntar({
        titulo: `¿Desactivar el grupo ${grupo.nombre}?`,
        mensaje: 'No podrás generar su hoja de ruta mientras esté desactivado. Los viajes ya guardados no cambian.',
        textoConfirmar: 'Desactivar',
        tono: 'peligro',
      })
      if (!ok) return
    }
    try {
      await api.patch(`/grupos/${grupo.id}/estado`, { activo: !grupo.activo })
      avisar(grupo.activo ? `Grupo ${grupo.nombre} desactivado.` : `Grupo ${grupo.nombre} activado.`)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const eliminar = async (grupo) => {
    const ok = await preguntar({
      titulo: `¿Eliminar el grupo ${grupo.nombre}?`,
      mensaje: 'Sus buses y frecuencias quedarán sin grupo hasta que los asignes a otro.',
      textoConfirmar: 'Eliminar grupo',
      tono: 'peligro',
    })
    if (!ok) return
    try {
      await api.delete(`/grupos/${grupo.id}`)
      avisar(`Grupo ${grupo.nombre} eliminado.`)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  // ── Asignar buses / frecuencias ───────────────────────────────────
  const abrirAsignacion = (grupo, pestana) => {
    const lista = pestana === 'buses' ? recursos.buses : recursos.frecuencias
    setAsignando({ grupo, pestana, seleccion: new Set(lista.filter((x) => x.grupo_id === grupo.id).map((x) => x.id)) })
    setError('')
  }

  const alternar = (id) => {
    const seleccion = new Set(asignando.seleccion)
    if (seleccion.has(id)) seleccion.delete(id)
    else seleccion.add(id)
    setAsignando({ ...asignando, seleccion })
  }

  const guardarAsignacion = async () => {
    setGuardando(true)
    try {
      const { grupo, pestana, seleccion } = asignando
      const { data } = await api.put(`/grupos/${grupo.id}/${pestana}`, { [pestana]: [...seleccion] })
      setRecursos({ buses: data.buses, frecuencias: data.frecuencias })
      avisar(`${pestana === 'buses' ? 'Buses' : 'Frecuencias'} del grupo ${grupo.nombre} actualizados.`)
      setAsignando(null)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="cargando"><span className="giro" /> Cargando grupos…</div>

  const lista = asignando ? (asignando.pestana === 'buses' ? recursos.buses : recursos.frecuencias) : []

  return (
    <div className="container">
      {dialogo}
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Operación</span>
          <h1>Grupos de buses y frecuencias</h1>
          <p>Separa tu operación (urbano, interprovincial, rural). Cada bus y cada frecuencia pertenece a un solo grupo y la hoja de ruta se arma por grupo.</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn btn-primary" onClick={() => { setFormulario({ ...VACIO }); setErrores({}) }}>
            <Icono nombre="mas" tam={18} /> Nuevo grupo
          </button>
        </div>
      </div>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}

      {(sinGrupo.buses > 0 || sinGrupo.frecuencias > 0) && (
        <div className="alerta alerta--aviso">
          <Icono nombre="info" />
          <span>
            Tienes {sinGrupo.buses > 0 && <b>{sinGrupo.buses} bus(es)</b>}
            {sinGrupo.buses > 0 && sinGrupo.frecuencias > 0 && ' y '}
            {sinGrupo.frecuencias > 0 && <b>{sinGrupo.frecuencias} frecuencia(s)</b>} sin grupo: no entran en ninguna hoja de ruta hasta que los asignes.
          </span>
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="vacio">
          <span className="vacio__icono"><Icono nombre="capas" tam={30} /></span>
          <h3>Aún no tienes grupos</h3>
          <p>Crea tu primer grupo, por ejemplo «Interprovincial», y asígnale sus buses y frecuencias.</p>
        </div>
      ) : (
        <div className="grupos">
          {grupos.map((g) => (
            <article key={g.id} className={`card grupo ${g.activo ? '' : 'grupo--inactivo'}`}>
              <div className="card-body">
                <div className="fila fila--entre" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h2 className="grupo__nombre">{g.nombre}</h2>
                    {g.descripcion && <p className="texto-suave grupo__descripcion">{g.descripcion}</p>}
                  </div>
                  <span className={`insignia ${g.activo ? 'insignia--exito' : 'insignia--error'}`}>{g.activo ? 'Activo' : 'Inactivo'}</span>
                </div>

                <div className="grupo__numeros">
                  <button type="button" onClick={() => abrirAsignacion(g, 'buses')}>
                    <Icono nombre="bus" tam={20} />
                    <strong>{g.buses_activos}</strong><span>buses activos{g.buses > g.buses_activos ? ` (${g.buses} en total)` : ''}</span>
                  </button>
                  <button type="button" onClick={() => abrirAsignacion(g, 'frecuencias')}>
                    <Icono nombre="reloj" tam={20} />
                    <strong>{g.frecuencias_activas}</strong><span>frecuencias activas{g.frecuencias > g.frecuencias_activas ? ` (${g.frecuencias} en total)` : ''}</span>
                  </button>
                </div>
                <Cobertura grupo={g} />

                <div className="grupo__acciones">
                  <button type="button" className="btn btn-sm" onClick={() => abrirAsignacion(g, 'buses')}><Icono nombre="bus" tam={16} /> Buses</button>
                  <button type="button" className="btn btn-sm" onClick={() => abrirAsignacion(g, 'frecuencias')}><Icono nombre="reloj" tam={16} /> Frecuencias</button>
                  <button type="button" className="btn btn-sm" onClick={() => { setFormulario({ id: g.id, nombre: g.nombre, descripcion: g.descripcion || '' }); setErrores({}) }}>
                    <Icono nombre="editar" tam={16} /> Editar
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => cambiarEstado(g)}><Icono nombre="apagar" tam={16} /> {g.activo ? 'Desactivar' : 'Activar'}</button>
                  {!g.tiene_hojas && <button type="button" className="btn btn-sm btn--fantasma" onClick={() => eliminar(g)}>Eliminar</button>}
                </div>
                {g.activo && (
                  <Link to={`/cooperativa/hoja-ruta?grupo=${g.id}`} className="btn btn-primary btn--bloque" style={{ marginTop: '.75rem' }}>
                    <Icono nombre="calendario" tam={18} /> Hoja de ruta de {g.nombre}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Crear / editar grupo */}
      {formulario && (
        <div className="capa capa--centro" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setFormulario(null)}>
          <form className="modal" onSubmit={guardarGrupo} noValidate role="dialog" aria-labelledby="titulo-grupo">
            <div className="panel__cabecera">
              <div>
                <h2 id="titulo-grupo">{formulario.id ? 'Editar grupo' : 'Nuevo grupo'}</h2>
                <p>Ej. Urbano, Interprovincial, Rural, Ejecutivo.</p>
              </div>
              <button type="button" className="btn btn--fantasma btn--icono" onClick={() => setFormulario(null)} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
            </div>
            <div className="panel__cuerpo">
              <div className={`campo ${errores.nombre ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="grupo-nombre">Nombre del grupo</label>
                <input id="grupo-nombre" maxLength={40} autoFocus value={formulario.nombre}
                  onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} placeholder="Interprovincial" />
                {errores.nombre && <span className="campo__error">{errores.nombre}</span>}
              </div>
              <div className={`campo ${errores.descripcion ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="grupo-descripcion">Descripción (opcional)</label>
                <textarea id="grupo-descripcion" rows={3} maxLength={200} value={formulario.descripcion}
                  onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })} placeholder="Rutas entre provincias con buses de 1 y 2 pisos" />
                {errores.descripcion && <span className="campo__error">{errores.descripcion}</span>}
              </div>
            </div>
            <div className="panel__pie">
              <button type="button" className="btn" onClick={() => setFormulario(null)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : formulario.id ? 'Guardar cambios' : 'Crear grupo'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Asignar buses o frecuencias */}
      {asignando && (
        <div className="capa" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setAsignando(null)}>
          <aside className="panel" role="dialog" aria-labelledby="titulo-asignar">
            <div className="panel__cabecera">
              <div>
                <h2 id="titulo-asignar">{asignando.grupo.nombre}</h2>
                <p>Marca {asignando.pestana === 'buses' ? 'los buses' : 'las frecuencias'} que forman este grupo. Lo que está en otro grupo aparece bloqueado.</p>
              </div>
              <button type="button" className="btn btn--fantasma btn--icono" onClick={() => setAsignando(null)} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
            </div>
            <div className="panel__cuerpo">
              <div className="pestanas" role="tablist" style={{ marginBottom: '1rem' }}>
                {['buses', 'frecuencias'].map((p) => (
                  <button key={p} type="button" role="tab" aria-selected={asignando.pestana === p} onClick={() => abrirAsignacion(asignando.grupo, p)}>
                    {p === 'buses' ? 'Buses' : 'Frecuencias'}
                  </button>
                ))}
              </div>
              <p className="texto-suave" style={{ fontSize: '.9rem' }}>{asignando.seleccion.size} seleccionado(s)</p>
              {lista.length === 0 && <p className="texto-suave">Aún no tienes {asignando.pestana} registrados.</p>}
              <ul className="asignar">
                {lista.map((x) => {
                  const enOtro = x.grupo_id && x.grupo_id !== asignando.grupo.id
                  const activo = asignando.pestana === 'buses' ? x.activo : x.activa
                  return (
                    <li key={x.id}>
                      <label className={`asignar__item ${enOtro ? 'asignar__item--bloqueado' : ''}`}>
                        <input type="checkbox" checked={asignando.seleccion.has(x.id)} disabled={enOtro} onChange={() => alternar(x.id)} />
                        {asignando.pestana === 'buses' ? (
                          <span><strong>Disco {x.numero_disco}</strong> · {x.placa} · {x.asientos} asientos</span>
                        ) : (
                          <span><strong>{hora(x.hora_salida)}</strong> {x.origen_etiqueta} → {x.destino_etiqueta}</span>
                        )}
                        <span className="asignar__estado">
                          {!activo && <span className="insignia insignia--error">Inactivo</span>}
                          {enOtro && <span className="insignia">En {x.grupo}</span>}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="panel__pie">
              <button type="button" className="btn" onClick={() => setAsignando(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={guardando} onClick={guardarAsignacion}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
