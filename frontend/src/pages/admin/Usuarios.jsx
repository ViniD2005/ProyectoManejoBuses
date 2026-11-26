import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  errorCedula, errorNombres, errorCorreo, errorTelefono, errorFechaNacimiento, errorContrasena,
  erroresLicencia, estadoLicencia, haceAnios,
} from '../../utils/validaciones.js'

const NOMBRE_ROL = {
  admin: 'Administrador',
  cooperativa: 'Usuario de cooperativa',
  oficinista: 'Oficinista',
  personal_bus: 'Personal del bus',
  cliente: 'Cliente',
}
const DESCRIPCION_ROL = {
  admin: 'Gestiona cooperativas, usuarios y la configuración de la aplicación.',
  cooperativa: 'Administra los buses, frecuencias, hojas de ruta, personal y apariencia de su cooperativa.',
  oficinista: 'Vende boletos en ventanilla y valida los comprobantes de pago.',
  personal_bus: 'Chofer o ayudante: inicia los viajes, valida los boletos y vende a bordo.',
  cliente: 'Compra pasajes desde la página web.',
}
const COLOR_ROL = { admin: 'insignia--info', cooperativa: 'insignia--marca', oficinista: 'insignia--aviso', personal_bus: 'insignia--exito', cliente: '' }
const ROLES_POR_USUARIO = {
  admin: ['cooperativa', 'oficinista', 'personal_bus', 'admin'],
  cooperativa: ['oficinista', 'personal_bus'],
}
const ROLES_CON_COOPERATIVA = ['cooperativa', 'oficinista', 'personal_bus']
const FORM_VACIO = {
  rol: '', cooperativa_id: '', cedula: '', nombres: '', apellidos: '', email: '', telefono: '', password: '',
  fecha_nacimiento: '', cargo: '', licencia_tipo: '', licencia_vence: '', // GC-33
}
const NOMBRE_CARGO = { chofer: 'Chofer', ayudante: 'Ayudante' }

/*
  GC-33: campos del personal del bus (cargo y licencia del chofer).
  datos: { cargo, licencia_tipo, licencia_vence }; errores por campo; alCambiar(nombre, valor)
*/
function CamposPersonalBus({ datos, errores, alCambiar, prefijo }) {
  const hoy = new Date().toLocaleDateString('en-CA')
  return (
    <>
      <div className={`campo ${errores.cargo ? 'campo--error' : ''}`}>
        <label className="campo__etiqueta" htmlFor={`${prefijo}-cargo`}>Cargo</label>
        <select id={`${prefijo}-cargo`} value={datos.cargo} onChange={(e) => alCambiar('cargo', e.target.value)}>
          <option value="">Elige el cargo</option>
          <option value="chofer">Chofer</option>
          <option value="ayudante">Ayudante</option>
        </select>
        {errores.cargo && <span className="campo__error">{errores.cargo}</span>}
      </div>
      {datos.cargo === 'chofer' && (
        <div className="rejilla-2">
          <div className={`campo ${errores.licencia_tipo ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor={`${prefijo}-licencia_tipo`}>Tipo de licencia</label>
            <select id={`${prefijo}-licencia_tipo`} value={datos.licencia_tipo} onChange={(e) => alCambiar('licencia_tipo', e.target.value)}>
              <option value="">Elige</option>
              <option value="D">D · buses de pasajeros</option>
              <option value="E">E · vehículos pesados</option>
            </select>
            {errores.licencia_tipo && <span className="campo__error">{errores.licencia_tipo}</span>}
          </div>
          <div className={`campo ${errores.licencia_vence ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor={`${prefijo}-licencia_vence`}>Vence el</label>
            <input id={`${prefijo}-licencia_vence`} type="date" min={hoy} max={haceAnios(-5)} value={datos.licencia_vence}
              onChange={(e) => alCambiar('licencia_vence', e.target.value)} />
            {errores.licencia_vence && <span className="campo__error">{errores.licencia_vence}</span>}
          </div>
        </div>
      )}
    </>
  )
}

// GC-33: errores del cargo y la licencia antes de enviar
function erroresPersonalBus(datos) {
  if (!datos.cargo) return { cargo: 'Elige el cargo: chofer o ayudante' }
  return datos.cargo === 'chofer' ? erroresLicencia(datos.licencia_tipo, datos.licencia_vence) : {}
}

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No pudimos conectarnos con el servidor. Inténtalo de nuevo.'
}

const iniciales = (u) => `${u.nombres?.[0] || ''}${u.apellidos?.[0] || ''}`.toUpperCase()

/*
  CC-16 + CC-22: gestión de usuarios.
  - admin: crea usuarios internos y asigna un rol a cualquier usuario registrado
  - cooperativa: crea y administra el personal de su cooperativa
*/
export default function Usuarios() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'
  const roles = ROLES_POR_USUARIO[usuario?.rol] || []

  const [usuarios, setUsuarios] = useState([])
  const [cooperativas, setCooperativas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [pestana, setPestana] = useState('equipo')
  const [filtro, setFiltro] = useState('')
  const [panelAbierto, setPanelAbierto] = useState(false)
  const [editandoPersonal, setEditandoPersonal] = useState(null) // GC-33: cargo y licencia
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = () =>
    api.get('/usuarios')
      .then(({ data }) => setUsuarios(data))
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
    if (esAdmin) {
      api.get('/cooperativas').then(({ data }) => setCooperativas(data.filter((c) => c.activa))).catch(() => {})
    }
  }, [esAdmin])

  const alternarEstado = async (u) => {
    setError('')
    setAviso('')
    try {
      await api.patch(`/usuarios/${u.id}/estado`, { activo: !u.activo })
      setAviso(`${u.nombres} ${u.apellidos} quedó ${u.activo ? 'desactivado: ya no podrá iniciar sesión' : 'activo nuevamente'}`)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const alCrear = (creado) => {
    setPanelAbierto(false)
    setAviso(`Listo: ${creado.nombres} ${creado.apellidos} ya puede iniciar sesión con ${creado.email} como ${NOMBRE_ROL[creado.rol]}.`)
    cargar()
  }

  const alAsignar = (actualizado) => {
    setAviso(`${actualizado.nombres} ${actualizado.apellidos} ahora es ${NOMBRE_ROL[actualizado.rol]}${actualizado.cooperativa ? ` en ${actualizado.cooperativa}` : ''}. Verá el cambio la próxima vez que inicie sesión.`)
    cargar()
  }

  const texto = filtro.trim().toLowerCase()
  const visibles = usuarios.filter((u) =>
    !texto || `${u.nombres} ${u.apellidos} ${u.cedula} ${u.email} ${u.cooperativa || ''}`.toLowerCase().includes(texto))

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">{esAdmin ? 'Administración' : 'Mi cooperativa'}</span>
          <h1>{esAdmin ? 'Usuarios y roles' : 'Personal de la cooperativa'}</h1>
          <p>
            {esAdmin
              ? 'Crea usuarios internos o asigna un rol a una persona que ya tiene cuenta. Los clientes se registran solos.'
              : 'Crea las cuentas de tus oficinistas y del personal del bus (choferes o ayudantes).'}
          </p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn btn-primary" onClick={() => { setPanelAbierto(true); setAviso('') }}>
            + Nuevo usuario
          </button>
        </div>
      </div>

      {error && <div className="alerta alerta--error" role="alert">{error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status">{aviso}</div>}

      {esAdmin && (
        <div className="pestanas" role="tablist">
          <button type="button" role="tab" aria-selected={pestana === 'equipo'} onClick={() => setPestana('equipo')}>
            Usuarios internos ({usuarios.length})
          </button>
          <button type="button" role="tab" aria-selected={pestana === 'asignar'} onClick={() => setPestana('asignar')}>
            Asignar rol a un usuario registrado
          </button>
        </div>
      )}

      {pestana === 'asignar' && esAdmin ? (
        <AsignarRol cooperativas={cooperativas} solicitante={usuario} alAsignar={alAsignar} alFallar={setError} />
      ) : (
        <div className="card">
          <div className="card-header fila fila--entre">
            <span>{visibles.length} {visibles.length === 1 ? 'usuario' : 'usuarios'}</span>
            <input className="form-control" style={{ maxWidth: 320, minHeight: 38 }} placeholder="Buscar por nombre, cédula o correo"
              value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar usuarios" />
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr><th>Usuario</th><th>Cédula</th><th>Rol</th>{esAdmin && <th>Cooperativa</th>}<th>Estado</th><th /></tr>
              </thead>
              <tbody>
                {visibles.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="fila" style={{ flexWrap: 'nowrap' }}>
                        <span className="avatar">{iniciales(u)}</span>
                        <div>
                          <strong>{u.nombres} {u.apellidos}</strong>
                          <div className="texto-suave" style={{ fontSize: '.82rem' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.cedula}</td>
                    <td>
                      <span className={`insignia ${COLOR_ROL[u.rol] || ''}`}>{NOMBRE_ROL[u.rol] || u.rol}</span>
                      {/* GC-33: cargo y estado de la licencia del personal del bus */}
                      {u.rol === 'personal_bus' && (
                        <div style={{ display: 'grid', gap: '.25rem', marginTop: '.35rem', fontSize: '.8rem' }}>
                          <span className="texto-suave">{NOMBRE_CARGO[u.cargo] || 'Sin cargo'}</span>
                          {u.cargo === 'chofer' && <span className={`insignia ${estadoLicencia(u.licencia_vence).clase}`}>{estadoLicencia(u.licencia_vence).texto}</span>}
                        </div>
                      )}
                    </td>
                    {esAdmin && <td>{u.cooperativa || <span className="texto-suave">—</span>}</td>}
                    <td>
                      <span className={`insignia ${u.activo ? 'insignia--exito' : 'insignia--error'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {u.rol === 'personal_bus' && (
                        <button type="button" className="btn btn-sm" style={{ marginRight: '.4rem' }} onClick={() => { setEditandoPersonal(u); setAviso('') }}>Cargo y licencia</button>
                      )}
                      {u.id !== usuario.id && (
                        <button type="button" className={`btn btn-sm ${u.activo ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => alternarEstado(u)}>
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!cargando && visibles.length === 0 && (
                  <tr><td colSpan={6} className="text-center texto-suave" style={{ padding: '2rem' }}>
                    {texto ? 'Ningún usuario coincide con la búsqueda.' : 'Todavía no hay usuarios. Crea el primero con "Nuevo usuario".'}
                  </td></tr>
                )}
                {cargando && <tr><td colSpan={6}><div className="cargando"><span className="giro" /> Cargando usuarios…</div></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editandoPersonal && (
        <PanelPersonalBus usuario={editandoPersonal} alCerrar={() => setEditandoPersonal(null)}
          alGuardar={(u) => { setEditandoPersonal(null); setAviso(`Se actualizaron el cargo y la licencia de ${u.nombres} ${u.apellidos}.`); cargar() }} />
      )}

      {panelAbierto && (
        <PanelNuevoUsuario roles={roles} esAdmin={esAdmin} cooperativas={cooperativas}
          alCerrar={() => setPanelAbierto(false)} alCrear={alCrear} />
      )}
    </div>
  )
}

// Panel lateral con el formulario de un usuario nuevo
function PanelNuevoUsuario({ roles, esAdmin, cooperativas, alCerrar, alCrear }) {
  const [form, setForm] = useState({ ...FORM_VACIO, rol: roles[0] || '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => {
    let { value } = e.target
    if (e.target.name === 'cedula' || e.target.name === 'telefono') value = value.replace(/\D/g, '').slice(0, 10)
    setForm({ ...form, [e.target.name]: value })
    setErrores({ ...errores, [e.target.name]: '' })
  }

  // GC-33: se revisa todo antes de enviar, con las mismas reglas que el servidor
  const revisar = () => {
    const encontrados = {
      cedula: errorCedula(form.cedula),
      nombres: errorNombres(form.nombres, 'los nombres'),
      apellidos: errorNombres(form.apellidos, 'los apellidos'),
      email: errorCorreo(form.email),
      telefono: errorTelefono(form.telefono),
      fecha_nacimiento: errorFechaNacimiento(form.fecha_nacimiento, 18),
      password: errorContrasena(form.password),
      ...(esAdmin && ROLES_CON_COOPERATIVA.includes(form.rol) && !form.cooperativa_id ? { cooperativa_id: 'Elige la cooperativa a la que pertenece' } : {}),
      ...(form.rol === 'personal_bus' ? erroresPersonalBus(form) : {}),
    }
    const conError = Object.fromEntries(Object.entries(encontrados).filter(([, v]) => v))
    setErrores(conError)
    return Object.keys(conError).length === 0
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    if (!revisar()) return setError('Revisa los datos marcados')
    setEnviando(true)
    try {
      const { data } = await api.post('/usuarios', form)
      alCrear(data)
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setEnviando(false)
    }
  }

  const campo = (name, texto, props = {}, ayuda) => (
    <div className={`campo ${errores[name] ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={`nuevo-${name}`}>{texto}</label>
      <input id={`nuevo-${name}`} name={name} value={form[name]} onChange={cambiar} {...props} />
      {errores[name] ? <span className="campo__error">{errores[name]}</span> : ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </div>
  )

  return (
    <div className="capa" onMouseDown={(e) => { if (e.target === e.currentTarget) alCerrar() }}>
      <form className="panel" onSubmit={guardar} noValidate>
        <div className="panel__cabecera">
          <div>
            <h2>Nuevo usuario</h2>
            <p>La persona iniciará sesión con su correo y la contraseña que definas.</p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="panel__cuerpo">
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}

          <div className={`campo ${errores.rol ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor="nuevo-rol">Rol</label>
            <select id="nuevo-rol" name="rol" value={form.rol} onChange={cambiar}>
              {roles.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
            </select>
            {errores.rol ? <span className="campo__error">{errores.rol}</span> : <span className="campo__ayuda">{DESCRIPCION_ROL[form.rol]}</span>}
          </div>
          {esAdmin && ROLES_CON_COOPERATIVA.includes(form.rol) && (
            <div className={`campo ${errores.cooperativa_id ? 'campo--error' : ''}`}>
              <label className="campo__etiqueta" htmlFor="nuevo-cooperativa_id">Cooperativa</label>
              <select id="nuevo-cooperativa_id" name="cooperativa_id" value={form.cooperativa_id} onChange={cambiar}>
                <option value="">Elige una cooperativa</option>
                {cooperativas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {errores.cooperativa_id && <span className="campo__error">{errores.cooperativa_id}</span>}
            </div>
          )}

          {campo('cedula', 'Cédula', { inputMode: 'numeric', placeholder: '10 dígitos' })}
          <div className="rejilla-2">
            {campo('nombres', 'Nombres', { placeholder: 'Ej. Luis Alberto' })}
            {campo('apellidos', 'Apellidos', { placeholder: 'Ej. Paredes Mora' })}
          </div>
          {campo('email', 'Correo electrónico', { type: 'email', placeholder: 'nombre@correo.com' }, 'Con este correo iniciará sesión.')}
          <div className="rejilla-2">
            {campo('telefono', 'Celular (opcional)', { inputMode: 'tel', placeholder: '09XXXXXXXX' })}
            {campo('fecha_nacimiento', 'Fecha de nacimiento', { type: 'date', max: haceAnios(18), min: haceAnios(120) }, 'Debe ser mayor de edad.')}
          </div>
          {form.rol === 'personal_bus' && (
            <CamposPersonalBus prefijo="nuevo" datos={form} errores={errores}
              alCambiar={(nombre, valor) => { setForm({ ...form, [nombre]: valor }); setErrores({ ...errores, [nombre]: '' }) }} />
          )}
          {campo('password', 'Contraseña inicial', { type: 'password', autoComplete: 'new-password' },
            'Mínimo 8 caracteres, con mayúscula, minúscula y número. Compártela de forma segura.')}
        </div>
        <div className="panel__pie">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Creando…' : 'Crear usuario'}</button>
        </div>
      </form>
    </div>
  )
}

// CC-22: el administrador busca a un usuario registrado y le asigna un rol
function AsignarRol({ cooperativas, solicitante, alAsignar, alFallar }) {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [elegido, setElegido] = useState(null)
  const [rol, setRol] = useState('')
  const [cooperativaId, setCooperativaId] = useState('')
  const [personal, setPersonal] = useState({ cargo: '', licencia_tipo: '', licencia_vence: '' }) // GC-33
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const buscar = async (e) => {
    e.preventDefault()
    setErrorBusqueda('')
    if (texto.trim().length < 3) return setErrorBusqueda('Escribe al menos 3 caracteres: parte del nombre, la cédula o el correo')
    setBuscando(true)
    try {
      const { data } = await api.get('/usuarios/buscar', { params: { texto: texto.trim() } })
      setResultados(data)
      setElegido(null)
    } catch (err) {
      setErrorBusqueda(mensajeDeError(err))
    } finally {
      setBuscando(false)
    }
  }

  const elegir = (u) => {
    setElegido(u)
    setRol(u.rol)
    setCooperativaId(u.cooperativa_id ? String(u.cooperativa_id) : '')
    setPersonal({ cargo: u.cargo || '', licencia_tipo: u.licencia_tipo || '', licencia_vence: u.licencia_vence || '' })
    setErrores({})
  }

  const asignar = async (e) => {
    e.preventDefault()
    setErrores({})
    if (ROLES_CON_COOPERATIVA.includes(rol) && !cooperativaId) {
      return setErrores({ cooperativa_id: 'Elige la cooperativa a la que pertenecerá' })
    }
    if (rol === 'personal_bus') {
      const problemas = erroresPersonalBus(personal)
      if (Object.keys(problemas).length) return setErrores(problemas)
    }
    setGuardando(true)
    try {
      const { data } = await api.patch(`/usuarios/${elegido.id}/rol`, {
        rol,
        cooperativa_id: ROLES_CON_COOPERATIVA.includes(rol) ? Number(cooperativaId) : null,
        ...(rol === 'personal_bus' ? personal : {}),
      })
      setResultados((lista) => lista.map((u) => (u.id === data.id ? data : u)))
      setElegido(null)
      alAsignar(data)
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
      if (!err.response?.data?.detalles) alFallar(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rejilla-2" style={{ alignItems: 'start' }}>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-body">
          <h2>1. Busca a la persona</h2>
          <p className="texto-suave">Debe tener una cuenta creada (por ejemplo, un cliente que se registró en la página).</p>
          <form onSubmit={buscar} className="fila" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }} noValidate>
            <div className={`campo ${errorBusqueda ? 'campo--error' : ''}`} style={{ flex: 1, marginBottom: 0 }}>
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, cédula o correo" aria-label="Buscar usuario" />
              {errorBusqueda && <span className="campo__error">{errorBusqueda}</span>}
            </div>
            <button className="btn btn-primary" disabled={buscando}>{buscando ? 'Buscando…' : 'Buscar'}</button>
          </form>

          {resultados && (
            <div style={{ display: 'grid', gap: '.5rem', marginTop: '1.25rem' }}>
              {resultados.length === 0 && <p className="texto-suave">No encontramos usuarios con "{texto}".</p>}
              {resultados.map((u) => (
                <button key={u.id} type="button" onClick={() => elegir(u)} disabled={u.id === solicitante.id}
                  className="btn" style={{ justifyContent: 'flex-start', textAlign: 'left', minHeight: 60, whiteSpace: 'normal',
                    borderColor: elegido?.id === u.id ? 'var(--marca)' : undefined, background: elegido?.id === u.id ? 'var(--marca-suave)' : undefined }}>
                  <span className="avatar">{iniciales(u)}</span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: 'block' }}>{u.nombres} {u.apellidos}{u.id === solicitante.id ? ' (tú)' : ''}</strong>
                    <span className="texto-suave" style={{ fontSize: '.82rem', fontWeight: 500 }}>{u.cedula} · {u.email}</span>
                  </span>
                  <span className={`insignia ${COLOR_ROL[u.rol] || ''}`}>{NOMBRE_ROL[u.rol]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="card-body">
          <h2>2. Elige su nuevo rol</h2>
          {!elegido ? (
            <div className="vacio" style={{ padding: '2rem 1rem' }}>
              <h3>Ningún usuario elegido</h3>
              <span>Busca y selecciona a una persona de la lista.</span>
            </div>
          ) : (
            <form onSubmit={asignar} noValidate>
              <div className="fila" style={{ marginBottom: '1.25rem' }}>
                <span className="avatar">{iniciales(elegido)}</span>
                <div>
                  <strong>{elegido.nombres} {elegido.apellidos}</strong>
                  <div className="texto-suave" style={{ fontSize: '.84rem' }}>
                    Hoy: {NOMBRE_ROL[elegido.rol]}{elegido.cooperativa ? ` · ${elegido.cooperativa}` : ''}
                  </div>
                </div>
              </div>

              <div className={`campo ${errores.rol ? 'campo--error' : ''}`}>
                <span className="campo__etiqueta">Rol</span>
                <div style={{ display: 'grid', gap: '.5rem' }}>
                  {Object.keys(NOMBRE_ROL).map((r) => (
                    <label key={r} className="form-check" style={{ alignItems: 'flex-start', padding: '.7rem .85rem', borderRadius: 10,
                      border: `1.5px solid ${rol === r ? 'var(--marca)' : 'var(--borde)'}`, background: rol === r ? 'var(--marca-suave)' : undefined, marginBottom: 0 }}>
                      <input type="radio" name="rol" value={r} checked={rol === r} onChange={() => { setRol(r); setErrores({}) }} style={{ marginTop: 3 }} />
                      <span>
                        {NOMBRE_ROL[r]}
                        <span className="texto-suave" style={{ display: 'block', fontSize: '.8rem', fontWeight: 500 }}>{DESCRIPCION_ROL[r]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {errores.rol && <span className="campo__error">{errores.rol}</span>}
              </div>

              {ROLES_CON_COOPERATIVA.includes(rol) && (
                <div className={`campo ${errores.cooperativa_id ? 'campo--error' : ''}`}>
                  <label className="campo__etiqueta" htmlFor="asignar-cooperativa">Cooperativa</label>
                  <select id="asignar-cooperativa" value={cooperativaId} onChange={(e) => { setCooperativaId(e.target.value); setErrores({}) }}>
                    <option value="">Elige una cooperativa</option>
                    {cooperativas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  {errores.cooperativa_id && <span className="campo__error">{errores.cooperativa_id}</span>}
                </div>
              )}

              {rol === 'personal_bus' && (
                <CamposPersonalBus prefijo="asignar" datos={personal} errores={errores}
                  alCambiar={(nombre, valor) => { setPersonal({ ...personal, [nombre]: valor }); setErrores({}) }} />
              )}

              <div className="alerta alerta--info">El cambio se aplica la próxima vez que la persona inicie sesión.</div>
              <button className="btn btn-primary btn--bloque" disabled={guardando}>{guardando ? 'Guardando…' : 'Asignar rol'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// GC-33: cambiar el cargo o renovar la licencia de alguien del personal del bus
function PanelPersonalBus({ usuario, alCerrar, alGuardar }) {
  const [datos, setDatos] = useState({ cargo: usuario.cargo || '', licencia_tipo: usuario.licencia_tipo || '', licencia_vence: usuario.licencia_vence || '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    const problemas = erroresPersonalBus(datos)
    setErrores(problemas)
    if (Object.keys(problemas).length) return
    setEnviando(true)
    try {
      const { data } = await api.patch(`/usuarios/${usuario.id}/personal-bus`, datos)
      alGuardar(data)
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
            <h2>Cargo y licencia</h2>
            <p>{usuario.nombres} {usuario.apellidos}</p>
          </div>
          <button type="button" className="btn btn--fantasma btn--icono" onClick={alCerrar} aria-label="Cerrar">✕</button>
        </div>
        <div className="panel__cuerpo">
          {error && <div className="alerta alerta--error" role="alert">{error}</div>}
          <CamposPersonalBus prefijo="editar" datos={datos} errores={errores}
            alCambiar={(nombre, valor) => { setDatos({ ...datos, [nombre]: valor }); setErrores({ ...errores, [nombre]: '' }) }} />
          <p className="texto-suave" style={{ fontSize: '.85rem' }}>Cuando el chofer renueve su licencia, registra aquí la nueva fecha de vencimiento.</p>
        </div>
        <div className="panel__pie">
          <button type="button" className="btn" onClick={alCerrar}>Cancelar</button>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </div>
  )
}
