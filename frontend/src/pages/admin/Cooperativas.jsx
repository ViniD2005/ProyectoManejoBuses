import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import FormCuentaBancaria from '../../components/FormCuentaBancaria.jsx'

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
  const [panel, setPanel] = useState(null) // { tipo: 'crear' | 'editar' | 'responsable' | 'destacadas', cooperativa }
  const [planes, setPlanes] = useState({}) // GC-35: plan de rutas destacadas por cooperativa
  const [cuentas, setCuentas] = useState({}) // GC-43: cuenta bancaria de cada cooperativa

  const cargar = () => {
    api.get('/destacadas/planes')
      .then(({ data }) => setPlanes(Object.fromEntries(data.map((p) => [p.id, p]))))
      .catch(() => {})
    api.get('/cuentas-bancarias')
      .then(({ data }) => setCuentas(Object.fromEntries(data.map((c) => [c.cooperativa_id, c.cuenta]))))
      .catch(() => {})
    return api.get('/cooperativas/gestion')
      .then(({ data }) => setCooperativas(data))
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }

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

              {/* GC-35: plan de rutas destacadas (pagado por fuera del sistema) */}
              <div className="fila fila--entre" style={{ marginTop: '.75rem', fontSize: '.88rem' }}>
                <span>
                  <span className="texto-suave">Rutas destacadas: </span>
                  {!planes[c.id]?.rutas_destacadas
                    ? 'sin plan'
                    : <>{planes[c.id].usadas} de {planes[c.id].rutas_destacadas} en uso · hasta {planes[c.id].destacadas_hasta}</>}
                </span>
                {planes[c.id]?.rutas_destacadas > 0 && (
                  <span className={`insignia ${planes[c.id].vigente ? 'insignia--marca' : 'insignia--aviso'}`}>{planes[c.id].vigente ? '★ Vigente' : 'Vencido'}</span>
                )}
              </div>

              {/* GC-43: cuenta donde los clientes pagan a esta cooperativa */}
              <div className="fila fila--entre" style={{ marginTop: '.4rem', fontSize: '.88rem' }}>
                <span>
                  <span className="texto-suave">Cuenta de cobro: </span>
                  {cuentas[c.id] ? `${cuentas[c.id].banco} ···${cuentas[c.id].numero.slice(-4)}` : 'sin registrar'}
                </span>
                {!cuentas[c.id] && <span className="insignia insignia--aviso">No recibe pagos en línea</span>}
              </div>

              <div className="fila" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-sm" onClick={() => { setPanel({ tipo: 'editar', cooperativa: c }); setAviso('') }}>Editar datos</button>
                <button type="button" className="btn btn-sm" onClick={() => { setPanel({ tipo: 'cuenta', cooperativa: c }); setAviso('') }}>Cuenta bancaria</button>
                <button type="button" className="btn btn-sm" onClick={() => { setPanel({ tipo: 'destacadas', cooperativa: c }); setAviso('') }}>★ Rutas destacadas</button>
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
      {panel?.tipo === 'cuenta' && (
        <div className="capa" onMouseDown={(e) => { if (e.target === e.currentTarget) setPanel(null) }}>
          <div className="panel">
            <div className="panel__cabecera">
              <div>
                <h2>Cuenta bancaria</h2>
                <p>{panel.cooperativa.nombre}: aquí pagan sus clientes por transferencia o depósito</p>
              </div>
              <button type="button" className="btn btn--fantasma btn--icono" onClick={() => setPanel(null)} aria-label="Cerrar">✕</button>
            </div>
            <div className="panel__cuerpo">
              <FormCuentaBancaria url={`/cuentas-bancarias/${panel.cooperativa.id}`} cuenta={cuentas[panel.cooperativa.id]}
                cooperativa={panel.cooperativa} alCancelar={() => setPanel(null)}
                alGuardar={(r) => { if (!r.sin_cambios) alGuardar(`Se guardó la cuenta bancaria de ${panel.cooperativa.nombre}. La cooperativa recibió un aviso.`) }} />
            </div>
          </div>
        </div>
      )}
      {panel?.tipo === 'destacadas' && <PanelDestacadas cooperativa={panel.cooperativa} plan={planes[panel.cooperativa.id]} alCerrar={() => setPanel(null)} alGuardar={alGuardar} />}
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

// Indicador de pasos del registro (GC-11)
function Pasos({ actual }) {
  const pasos = ['Datos de la cooperativa', 'Usuario responsable']
  return (
    <ol style={{ display: 'flex', gap: '.5rem', listStyle: 'none', padding: 0, margin: '0 0 1.25rem' }} aria-label="Pasos del registro">
      {pasos.map((texto, i) => {
        const numero = i + 1
        const hecho = numero < actual
        const activo = numero === actual
        return (
          <li key={texto} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '.55rem', padding: '.6rem .75rem', borderRadius: 12,
            border: `1.5px solid ${activo ? 'var(--marca)' : 'var(--borde)'}`, background: activo ? 'var(--marca-suave)' : 'var(--superficie)' }}
            aria-current={activo ? 'step' : undefined}>
            <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, flex: 'none', borderRadius: '50%', fontWeight: 800, fontSize: '.85rem',
              background: hecho ? 'var(--exito)' : activo ? 'var(--marca)' : 'var(--borde)', color: hecho || activo ? '#fff' : 'var(--texto-suave)' }}>
              {hecho ? '✓' : numero}
            </span>
            <span style={{ fontSize: '.85rem', fontWeight: 700, color: activo ? 'var(--texto)' : 'var(--texto-suave)', lineHeight: 1.2 }}>
              <span style={{ display: 'block', fontSize: '.7rem', letterSpacing: '.06em', textTransform: 'uppercase', opacity: .8 }}>Paso {numero}</span>
              {texto}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/*
  Panel para crear o editar una cooperativa.
  GC-11: el registro es en dos pantallas:
    1. Datos de la cooperativa -> "Siguiente" (el servidor los revisa, sin guardar)
    2. Usuario responsable     -> "Registrar cooperativa"
  La edición sigue siendo una sola pantalla.
*/
function PanelCooperativa({ cooperativa, alCerrar, alGuardar }) {
  const editando = Boolean(cooperativa)
  const [form, setForm] = useState(editando
    ? { nombre: cooperativa.nombre, ruc: cooperativa.ruc, telefono: cooperativa.telefono || '', email: cooperativa.email || '', direccion: cooperativa.direccion || '' }
    : VACIO)
  const [paso, setPaso] = useState(1)
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

  // Paso 1 -> 2: el servidor revisa los datos (formato, RUC del SRI, nombre y RUC repetidos)
  const siguiente = async () => {
    setError('')
    setEnviando(true)
    try {
      await api.post('/cooperativas/validar', form)
      setErrores({})
      setPaso(2)
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setEnviando(false)
    }
  }

  const anterior = () => {
    setError('')
    setPaso(1)
  }

  const guardar = async (e) => {
    e.preventDefault()
    if (!editando && paso === 1) return siguiente()
    setError('')
    setEnviando(true)
    try {
      if (editando) {
        const { data } = await api.put(`/cooperativas/${cooperativa.id}`, form)
        alGuardar(`Los datos de ${data.nombre} se actualizaron.`)
      } else {
        // GC-30: el responsable siempre es una cuenta nueva que se crea con la cooperativa
        const { data } = await api.post('/cooperativas', { ...form, responsable: { nuevo } })
        const r = data.responsables[0]
        alGuardar(`${data.nombre} quedó registrada. ${r ? `${r.nombres} ${r.apellidos} ya puede administrarla iniciando sesión con ${r.email}.` : ''}`)
      }
    } catch (err) {
      setError(mensajeDeError(err))
      const detalles = err.response?.data?.detalles || {}
      setErrores(detalles)
      // Si otro administrador registró el mismo nombre o RUC mientras tanto, vuelve al paso 1
      if (!editando && Object.keys(detalles).some((campo) => Object.keys(VACIO).includes(campo))) setPaso(1)
    } finally {
      setEnviando(false)
    }
  }

  const datosCooperativa = (
    <>
      <span className="etiqueta-seccion">Datos de la cooperativa</span>
      <Campo nombre="nombre" etiqueta="Nombre" valor={form.nombre} alCambiar={cambiar} error={errores.nombre} placeholder="Ej. Cooperativa de Transportes Ambato" />
      <Campo nombre="ruc" etiqueta="RUC" valor={form.ruc} alCambiar={cambiar} error={errores.ruc} inputMode="numeric" placeholder="13 dígitos, termina en 001"
        ayuda="Lo validamos con el algoritmo del SRI." />
      <div className="rejilla-2">
        <Campo nombre="telefono" etiqueta="Teléfono" valor={form.telefono} alCambiar={cambiar} error={errores.telefono} inputMode="tel" placeholder="032XXXXXX o 09XXXXXXXX" />
        <Campo nombre="email" etiqueta="Correo de contacto" valor={form.email} alCambiar={cambiar} error={errores.email} type="email" placeholder="contacto@cooperativa.com" />
      </div>
      <Campo nombre="direccion" etiqueta="Dirección" valor={form.direccion} alCambiar={cambiar} error={errores.direccion} placeholder="Ej. Terminal Terrestre de Ambato, oficina 12" />
    </>
  )

  return (
    <div className="capa" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar() }}>
      <form className="panel" onSubmit={guardar} noValidate>
        <div className="panel__cabecera">
          <div>
            <h2>{editando ? `Editar ${cooperativa.nombre}` : 'Nueva cooperativa'}</h2>
            <p>
              {editando
                ? 'Actualiza los datos de contacto de la cooperativa.'
                : paso === 1 ? 'Primero, los datos de la cooperativa.' : 'Ahora, crea la cuenta de quien la administrará.'}
            </p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>

        <div className="panel__cuerpo">
          {!editando && <Pasos actual={paso} />}
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}

          {editando && datosCooperativa}

          {/* Los dos pasos quedan montados para no perder lo escrito al ir y volver */}
          {!editando && <div hidden={paso !== 1}>{datosCooperativa}</div>}

          {!editando && (
            <div hidden={paso !== 2}>
              <div className="fila fila--entre" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', padding: '.85rem 1rem', marginBottom: '1.25rem',
                borderRadius: 12, background: 'var(--superficie-2)', border: '1px solid var(--borde)' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block' }}>{form.nombre}</strong>
                  <span className="texto-suave" style={{ fontSize: '.85rem' }}>RUC {form.ruc} · {form.telefono} · {form.email}</span>
                  <span className="texto-suave" style={{ display: 'block', fontSize: '.85rem' }}>{form.direccion}</span>
                </div>
                <button type="button" className="btn btn-sm" onClick={anterior}>Editar</button>
              </div>

              <span className="etiqueta-seccion">Usuario responsable</span>
              <p className="texto-suave" style={{ fontSize: '.88rem' }}>
                Es quien entrará al panel de la cooperativa para registrar buses, frecuencias, personal y su apariencia.
                Se crea su cuenta en este momento: debe ser una persona que <b>no tenga cuenta</b> en el sistema.
              </p>
              {errores.responsable && <div className="alerta alerta--error">{errores.responsable}</div>}

              {/* GC-30: solo cuenta nueva (ya no se elige un usuario registrado) */}
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
                  type="password" autoComplete="new-password" ayuda="Mínimo 8 caracteres, con mayúscula, minúscula y número. Entrégasela al responsable." />
              </>
            </div>
          )}
        </div>

        <div className="panel__pie">
          {editando && (
            <>
              <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
              <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
            </>
          )}
          {!editando && paso === 1 && (
            <>
              <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
              <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Revisando…' : 'Siguiente →'}</button>
            </>
          )}
          {!editando && paso === 2 && (
            <>
              <button type="button" className="btn" onClick={anterior} style={{ marginRight: 'auto' }}>← Anterior</button>
              <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Registrar cooperativa'}</button>
            </>
          )}
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

/*
  GC-35: el administrador registra cuántas rutas puede destacar la cooperativa
  y hasta qué fecha (el pago se hace por fuera del sistema).
  Con 0 se quita el plan. Si baja el cupo, se quitan las destacadas más recientes.
*/
function PanelDestacadas({ cooperativa, plan, alCerrar, alGuardar }) {
  const hoy = new Date().toLocaleDateString('en-CA')
  const enUnAnio = (() => { const d = new Date(`${hoy}T12:00:00`); d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString('en-CA') })()
  const [form, setForm] = useState({ cantidad: String(plan?.rutas_destacadas ?? 0), hasta: plan?.destacadas_hasta || '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const cantidad = Number(form.cantidad)
  const usadas = plan?.usadas || 0

  const revisar = () => {
    const e = {}
    if (form.cantidad === '' || !/^\d+$/.test(form.cantidad)) e.cantidad = 'Escribe un número entero (0 para quitar el plan)'
    else if (cantidad > 20) e.cantidad = 'Máximo 20 rutas destacadas'
    if (!e.cantidad && cantidad > 0) {
      if (!form.hasta) e.hasta = 'Indica hasta qué fecha está pagado el plan'
      else if (form.hasta < hoy) e.hasta = 'La fecha no puede ser anterior a hoy'
      else if (form.hasta > enUnAnio) e.hasta = 'El plan puede registrarse por máximo un año'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    if (!revisar()) return
    setEnviando(true)
    try {
      const { data } = await api.put(`/destacadas/planes/${cooperativa.id}`, { cantidad, hasta: cantidad > 0 ? form.hasta : null })
      alGuardar(cantidad === 0
        ? `${cooperativa.nombre} ya no tiene rutas destacadas.`
        : `${cooperativa.nombre} puede destacar ${cantidad} ruta(s) hasta el ${data.destacadas_hasta}.` + (data.quitadas ? ` Se quitaron ${data.quitadas} destacada(s) que superaban el cupo.` : ''))
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
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
            <h2>Rutas destacadas</h2>
            <p>{cooperativa.nombre}</p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="panel__cuerpo">
          <div className="alerta alerta--info"><div><b>¿Cómo funciona?</b><div>La cooperativa paga el plan por fuera del sistema. Aquí registras cuántas de sus rutas aparecerán primero en la búsqueda de los clientes y hasta qué fecha.</div></div></div>
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}
          <Campo nombre="cantidad" etiqueta="Rutas que puede destacar" type="number" min={0} max={20} inputMode="numeric"
            valor={form.cantidad} alCambiar={(e) => { setForm({ ...form, cantidad: e.target.value }); setErrores({ ...errores, cantidad: '' }) }}
            error={errores.cantidad} ayuda={`Entre 0 y 20. Hoy tiene ${usadas} ruta(s) destacada(s).`} />
          {cantidad > 0 && (
            <Campo nombre="hasta" etiqueta="Pagado hasta" type="date" min={hoy} max={enUnAnio}
              valor={form.hasta} alCambiar={(e) => { setForm({ ...form, hasta: e.target.value }); setErrores({ ...errores, hasta: '' }) }}
              error={errores.hasta} ayuda="Después de esta fecha sus rutas dejan de aparecer primero." />
          )}
          {!errores.cantidad && form.cantidad !== '' && cantidad < usadas && (
            <div className="alerta alerta--aviso"><div><b>Se quitarán {usadas - cantidad} ruta(s) destacada(s)</b><div>Las marcadas más recientemente. La cooperativa recibirá una notificación.</div></div></div>
          )}
        </div>
        <div className="panel__pie">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar plan'}</button>
        </div>
      </form>
    </div>
  )
}
