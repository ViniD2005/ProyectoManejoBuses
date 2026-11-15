import { useEffect, useState } from 'react'
import api from '../../services/api.js'

const VACIO = { nombre: '', ruc: '', telefono: '', email: '', direccion: '' }
const NUEVO_VACIO = { cedula: '', nombres: '', apellidos: '', email: '', telefono: '', password: '' }

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No pudimos conectarnos con el servidor. Inténtalo de nuevo.'
}

const iniciales = (texto = '') =>
  texto.replace(/^Cooperativa\s+/i, '').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

/*
  CC-23: gestión de cooperativas por el administrador.
  Toda cooperativa nueva queda con un usuario responsable (rol cooperativa),
  que puede ser un cliente ya registrado o una cuenta nueva.
*/
export default function Cooperativas() {
  const [cooperativas, setCooperativas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtro, setFiltro] = useState('')
  const [panel, setPanel] = useState(null) // { tipo: 'crear' | 'editar' | 'responsable', cooperativa }

  const cargar = () =>
    api.get('/cooperativas/gestion')
      .then(({ data }) => setCooperativas(data))
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const cambiarEstado = async (c) => {
    setError('')
    setAviso('')
    try {
      await api.patch(`/cooperativas/${c.id}/estado`, { activa: !c.activa })
      setAviso(c.activa
        ? `${c.nombre} quedó desactivada: sus viajes ya no aparecerán en la búsqueda.`
        : `${c.nombre} está activa nuevamente.`)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const alGuardar = (texto) => {
    setPanel(null)
    setAviso(texto)
    cargar()
  }

  const texto = filtro.trim().toLowerCase()
  const visibles = cooperativas.filter((c) => !texto || `${c.nombre} ${c.ruc} ${c.email}`.toLowerCase().includes(texto))
  const activas = cooperativas.filter((c) => c.activa).length
  const sinResponsable = cooperativas.filter((c) => c.responsables.length === 0).length

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Administración</span>
          <h1>Cooperativas</h1>
          <p>Registra las cooperativas de transporte y asigna el usuario que administrará cada una.</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn btn-primary" onClick={() => { setPanel({ tipo: 'crear' }); setAviso('') }}>
            + Nueva cooperativa
          </button>
        </div>
      </div>

      <div className="rejilla-3 mb-4">
        <div className="indicador"><div><div className="indicador__valor">{cooperativas.length}</div><div className="indicador__texto">Cooperativas registradas</div></div></div>
        <div className="indicador"><div><div className="indicador__valor">{activas}</div><div className="indicador__texto">Activas en la búsqueda</div></div></div>
        <div className="indicador"><div><div className="indicador__valor">{sinResponsable}</div><div className="indicador__texto">Sin usuario responsable</div></div></div>
      </div>

      {error && <div className="alerta alerta--error" role="alert">{error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status">{aviso}</div>}

      <div className="fila fila--entre mb-3">
        <input className="form-control" style={{ maxWidth: 360 }} placeholder="Buscar por nombre, RUC o correo"
          value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar cooperativas" />
      </div>

      {cargando && <div className="cargando"><span className="giro" /> Cargando cooperativas…</div>}
      {!cargando && visibles.length === 0 && (
        <div className="vacio">
          <h3>{texto ? 'Ninguna cooperativa coincide' : 'Aún no hay cooperativas'}</h3>
          <span>{texto ? 'Prueba con otro nombre o RUC.' : 'Registra la primera con "Nueva cooperativa".'}</span>
        </div>
      )}

      <div className="rejilla-2">
        {visibles.map((c) => (
          <article key={c.id} className="card" style={{ marginBottom: 0, opacity: c.activa ? 1 : 0.75 }}>
            <div className="card-body">
              <div className="fila fila--entre" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <div className="fila" style={{ flexWrap: 'nowrap' }}>
                  {c.logo_url
                    ? <img src={c.logo_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 12, border: '1px solid var(--borde)' }} />
                    : <span className="indicador__icono" style={{ fontWeight: 800 }}>{iniciales(c.nombre)}</span>}
                  <div>
                    <h3 style={{ margin: 0 }}>{c.nombre}</h3>
                    <span className="texto-suave" style={{ fontSize: '.85rem' }}>RUC {c.ruc}</span>
                  </div>
                </div>
                <span className={`insignia ${c.activa ? 'insignia--exito' : 'insignia--error'}`}>{c.activa ? 'Activa' : 'Inactiva'}</span>
              </div>

              <dl style={{ display: 'grid', gap: '.35rem', margin: '1rem 0', fontSize: '.9rem' }}>
                <div className="fila"><dt className="texto-suave" style={{ width: 80 }}>Teléfono</dt><dd style={{ margin: 0 }}>{c.telefono || '—'}</dd></div>
                <div className="fila"><dt className="texto-suave" style={{ width: 80 }}>Correo</dt><dd style={{ margin: 0 }}>{c.email || '—'}</dd></div>
                <div className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><dt className="texto-suave" style={{ width: 80, flex: 'none' }}>Dirección</dt><dd style={{ margin: 0 }}>{c.direccion || '—'}</dd></div>
              </dl>

              <div style={{ padding: '.85rem', borderRadius: 12, background: 'var(--superficie-2, #f8fafc)', border: '1px solid var(--borde, #e2e8f0)' }}>
                <div className="campo__etiqueta" style={{ marginBottom: '.5rem' }}>Usuarios responsables</div>
                {c.responsables.length === 0 && (
                  <span className="insignia insignia--aviso">Sin responsable: nadie puede administrarla</span>
                )}
                <div style={{ display: 'grid', gap: '.4rem' }}>
                  {c.responsables.map((r) => (
                    <div key={r.id} className="fila" style={{ flexWrap: 'nowrap', fontSize: '.88rem' }}>
                      <span className="avatar" style={{ width: 30, height: 30, fontSize: '.72rem' }}>{iniciales(`${r.nombres} ${r.apellidos}`)}</span>
                      <span style={{ flex: 1 }}><strong>{r.nombres} {r.apellidos}</strong> <span className="texto-suave">· {r.email}</span></span>
                      {!r.activo && <span className="insignia insignia--error">Inactivo</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="fila" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-sm" onClick={() => { setPanel({ tipo: 'editar', cooperativa: c }); setAviso('') }}>Editar datos</button>
                {c.activa && (
                  <button type="button" className="btn btn-sm" onClick={() => { setPanel({ tipo: 'responsable', cooperativa: c }); setAviso('') }}>+ Responsable</button>
                )}
                <button type="button" className={`btn btn-sm ${c.activa ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => cambiarEstado(c)}>
                  {c.activa ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {panel?.tipo === 'crear' && <PanelCooperativa alCerrar={() => setPanel(null)} alGuardar={alGuardar} />}
      {panel?.tipo === 'editar' && <PanelCooperativa cooperativa={panel.cooperativa} alCerrar={() => setPanel(null)} alGuardar={alGuardar} />}
      {panel?.tipo === 'responsable' && <PanelResponsable cooperativa={panel.cooperativa} alCerrar={() => setPanel(null)} alGuardar={alGuardar} />}
    </div>
  )
}

// Campo de formulario con su mensaje de error
function Campo({ nombre, etiqueta, valor, alCambiar, error, ayuda, ...props }) {
  return (
    <div className={`campo ${error ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={nombre}>{etiqueta}</label>
      <input id={nombre} name={nombre} value={valor} onChange={alCambiar} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className="campo__error">{error}</span> : ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </div>
  )
}

// Busca clientes registrados que pueden ser responsables de una cooperativa
function BuscadorCandidatos({ elegido, alElegir, error }) {
  const [texto, setTexto] = useState('')
  const [candidatos, setCandidatos] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)

  const buscar = async () => {
    setBuscando(true)
    try {
      const { data } = await api.get('/cooperativas/candidatos', { params: { texto: texto.trim() } })
      setCandidatos(data)
      setBuscado(true)
    } catch {
      setCandidatos([])
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className={`campo ${error ? 'campo--error' : ''}`}>
      <span className="campo__etiqueta">Usuario registrado</span>
      <div className="fila" style={{ flexWrap: 'nowrap' }}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, cédula o correo"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar() } }} style={{ flex: 1 }} aria-label="Buscar usuario registrado" />
        <button type="button" className="btn" onClick={buscar} disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button>
      </div>
      <span className="campo__ayuda">Solo aparecen clientes activos: al elegirlo pasará a tener el rol de cooperativa.</span>
      {error && <span className="campo__error">{error}</span>}
      {buscado && candidatos.length === 0 && <p className="texto-suave" style={{ marginTop: '.75rem' }}>No encontramos clientes con esos datos.</p>}
      <div style={{ display: 'grid', gap: '.4rem', marginTop: '.75rem' }}>
        {candidatos.map((u) => (
          <label key={u.id} className="form-check" style={{ padding: '.6rem .75rem', borderRadius: 10, marginBottom: 0, cursor: 'pointer',
            border: `1.5px solid ${elegido === u.id ? 'var(--marca)' : 'var(--borde)'}`, background: elegido === u.id ? 'var(--marca-suave)' : undefined }}>
            <input type="radio" name="candidato" checked={elegido === u.id} onChange={() => alElegir(u.id)} />
            <span>
              {u.nombres} {u.apellidos}
              <span className="texto-suave" style={{ display: 'block', fontSize: '.8rem', fontWeight: 500 }}>{u.cedula} · {u.email}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Panel para crear o editar una cooperativa
function PanelCooperativa({ cooperativa, alCerrar, alGuardar }) {
  const editando = Boolean(cooperativa)
  const [form, setForm] = useState(editando
    ? { nombre: cooperativa.nombre, ruc: cooperativa.ruc, telefono: cooperativa.telefono || '', email: cooperativa.email || '', direccion: cooperativa.direccion || '' }
    : VACIO)
  const [modo, setModo] = useState('registrado')
  const [usuarioId, setUsuarioId] = useState(null)
  const [nuevo, setNuevo] = useState(NUEVO_VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const soloNumeros = (nombre, valor) => (['ruc', 'telefono', 'cedula'].includes(nombre)
    ? valor.replace(/\D/g, '').slice(0, nombre === 'ruc' ? 13 : 10) : valor)

  const cambiar = (e) => {
    setForm({ ...form, [e.target.name]: soloNumeros(e.target.name, e.target.value) })
    setErrores({ ...errores, [e.target.name]: '' })
  }
  const cambiarNuevo = (e) => {
    const campo = e.target.name.replace('responsable_', '')
    setNuevo({ ...nuevo, [campo]: soloNumeros(campo, e.target.value) })
    setErrores({ ...errores, [e.target.name]: '' })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      if (editando) {
        const { data } = await api.put(`/cooperativas/${cooperativa.id}`, form)
        alGuardar(`Los datos de ${data.nombre} se actualizaron.`)
      } else {
        const responsable = modo === 'registrado' ? { usuario_id: usuarioId } : { nuevo }
        const { data } = await api.post('/cooperativas', { ...form, responsable })
        const r = data.responsables[0]
        alGuardar(`${data.nombre} quedó registrada. ${r ? `${r.nombres} ${r.apellidos} ya puede administrarla iniciando sesión con ${r.email}.` : ''}`)
      }
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="capa" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar() }}>
      <form className="panel" onSubmit={guardar} noValidate>
        <div className="panel__cabecera">
          <div>
            <h2>{editando ? `Editar ${cooperativa.nombre}` : 'Nueva cooperativa'}</h2>
            <p>{editando ? 'Actualiza los datos de contacto de la cooperativa.' : 'Datos de la cooperativa y de quién la administrará.'}</p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div className="panel__cuerpo">
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}

          <span className="etiqueta-seccion">Datos de la cooperativa</span>
          <Campo nombre="nombre" etiqueta="Nombre" valor={form.nombre} alCambiar={cambiar} error={errores.nombre} placeholder="Ej. Cooperativa de Transportes Ambato" />
          <Campo nombre="ruc" etiqueta="RUC" valor={form.ruc} alCambiar={cambiar} error={errores.ruc} inputMode="numeric" placeholder="13 dígitos, termina en 001"
            ayuda="Lo validamos con el algoritmo del SRI." />
          <div className="rejilla-2">
            <Campo nombre="telefono" etiqueta="Teléfono" valor={form.telefono} alCambiar={cambiar} error={errores.telefono} inputMode="tel" placeholder="032XXXXXX o 09XXXXXXXX" />
            <Campo nombre="email" etiqueta="Correo de contacto" valor={form.email} alCambiar={cambiar} error={errores.email} type="email" placeholder="contacto@cooperativa.com" />
          </div>
          <Campo nombre="direccion" etiqueta="Dirección" valor={form.direccion} alCambiar={cambiar} error={errores.direccion} placeholder="Ej. Terminal Terrestre de Ambato, oficina 12" />

          {!editando && (
            <>
              <hr />
              <span className="etiqueta-seccion">Usuario responsable</span>
              <p className="texto-suave" style={{ fontSize: '.88rem' }}>
                Es quien entrará al panel de la cooperativa para registrar buses, frecuencias, personal y su apariencia.
              </p>
              <div className="pestanas" role="tablist">
                <button type="button" role="tab" aria-selected={modo === 'registrado'} onClick={() => setModo('registrado')}>Usuario registrado</button>
                <button type="button" role="tab" aria-selected={modo === 'nuevo'} onClick={() => setModo('nuevo')}>Crear cuenta nueva</button>
              </div>
              {errores.responsable && modo === 'nuevo' && <div className="alerta alerta--error">{errores.responsable}</div>}

              {modo === 'registrado' ? (
                <BuscadorCandidatos elegido={usuarioId} alElegir={(id) => { setUsuarioId(id); setErrores({ ...errores, responsable: '' }) }} error={errores.responsable} />
              ) : (
                <>
                  <Campo nombre="responsable_cedula" etiqueta="Cédula" valor={nuevo.cedula} alCambiar={cambiarNuevo} error={errores.responsable_cedula} inputMode="numeric" placeholder="10 dígitos" />
                  <div className="rejilla-2">
                    <Campo nombre="responsable_nombres" etiqueta="Nombres" valor={nuevo.nombres} alCambiar={cambiarNuevo} error={errores.responsable_nombres} />
                    <Campo nombre="responsable_apellidos" etiqueta="Apellidos" valor={nuevo.apellidos} alCambiar={cambiarNuevo} error={errores.responsable_apellidos} />
                  </div>
                  <div className="rejilla-2">
                    <Campo nombre="responsable_email" etiqueta="Correo (para iniciar sesión)" valor={nuevo.email} alCambiar={cambiarNuevo} error={errores.responsable_email} type="email" />
                    <Campo nombre="responsable_telefono" etiqueta="Celular (opcional)" valor={nuevo.telefono} alCambiar={cambiarNuevo} error={errores.responsable_telefono} inputMode="tel" />
                  </div>
                  <Campo nombre="responsable_password" etiqueta="Contraseña inicial" valor={nuevo.password} alCambiar={cambiarNuevo} error={errores.responsable_password}
                    type="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres, con mayúscula, minúscula y número." />
                </>
              )}
            </>
          )}
        </div>

        <div className="panel__pie">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>
            {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar cooperativa'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Panel para agregar otro responsable a una cooperativa existente
function PanelResponsable({ cooperativa, alCerrar, alGuardar }) {
  const [usuarioId, setUsuarioId] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    if (!usuarioId) return setError('Busca y elige al usuario que será responsable')
    setError('')
    setEnviando(true)
    try {
      await api.post(`/cooperativas/${cooperativa.id}/responsables`, { usuario_id: usuarioId })
      alGuardar(`Se agregó un nuevo responsable a ${cooperativa.nombre}. Verá el panel la próxima vez que inicie sesión.`)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="capa" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar() }}>
      <form className="panel" onSubmit={guardar} noValidate>
        <div className="panel__cabecera">
          <div>
            <h2>Agregar responsable</h2>
            <p>{cooperativa.nombre}</p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="panel__cuerpo">
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}
          <BuscadorCandidatos elegido={usuarioId} alElegir={(id) => { setUsuarioId(id); setError('') }} />
        </div>
        <div className="panel__pie">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Agregar responsable'}</button>
        </div>
      </form>
    </div>
  )
}
