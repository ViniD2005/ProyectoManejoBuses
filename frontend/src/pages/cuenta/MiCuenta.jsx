import { useEffect, useState } from 'react'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { errorTelefono, errorFechaNacimiento, errorContrasena, requisitosContrasena } from '../../utils/validaciones.js'
import './MiCuenta.css'

/*
  GC-36 - Mi cuenta (todos los roles).
  Datos personales: la cédula, el nombre y el correo solo se muestran.
  Se puede cambiar el celular y registrar la fecha de nacimiento si falta.
  La contraseña se cambia escribiendo la actual.
*/
const NOMBRE_ROL = { admin: 'Administrador', cooperativa: 'Usuario de cooperativa', oficinista: 'Oficinista', personal_bus: 'Personal del bus', cliente: 'Cliente' }
const CLAVE_VACIA = { actual: '', nueva: '', confirmar: '' }

function edad(fecha) {
  const hoy = new Date().toLocaleDateString('en-CA')
  const [a, m, d] = fecha.split('-').map(Number)
  const [ha, hm, hd] = hoy.split('-').map(Number)
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
}

function Campo({ id, etiqueta, error, ayuda, children }) {
  return (
    <div className={`campo ${error ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={id}>{etiqueta}</label>
      {children}
      {error ? <span className="campo__error">{error}</span> : ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </div>
  )
}

export default function MiCuenta() {
  const [cuenta, setCuenta] = useState(null)
  const [datos, setDatos] = useState({ telefono: '', fecha_nacimiento: '' })
  const [clave, setClave] = useState(CLAVE_VACIA)
  const [verClave, setVerClave] = useState(false)
  const [errores, setErrores] = useState({})
  const [erroresClave, setErroresClave] = useState({})
  const [aviso, setAviso] = useState({ datos: '', clave: '' })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState('')

  useEffect(() => {
    api.get('/cuenta')
      .then(({ data }) => { setCuenta(data); setDatos({ telefono: data.telefono || '', fecha_nacimiento: data.fecha_nacimiento || '' }) })
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  const guardarDatos = async (e) => {
    e.preventDefault()
    setAviso({ ...aviso, datos: '' })
    const encontrados = {}
    const tel = errorTelefono(datos.telefono)
    if (tel) encontrados.telefono = tel
    if (!cuenta.fecha_nacimiento && datos.fecha_nacimiento) {
      const f = errorFechaNacimiento(datos.fecha_nacimiento)
      if (f) encontrados.fecha_nacimiento = f
      else if (edad(datos.fecha_nacimiento) < 18) encontrados.fecha_nacimiento = 'Debes tener al menos 18 años cumplidos'
    }
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return
    setGuardando('datos')
    try {
      const { data } = await api.put('/cuenta', { telefono: datos.telefono, ...(cuenta.fecha_nacimiento ? {} : { fecha_nacimiento: datos.fecha_nacimiento || null }) })
      setCuenta(data)
      setDatos({ telefono: data.telefono || '', fecha_nacimiento: data.fecha_nacimiento || '' })
      setAviso({ ...aviso, datos: 'Tus datos se guardaron correctamente.' })
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
      if (!err.response?.data?.detalles) setError(mensajeDeError(err))
    } finally {
      setGuardando('')
    }
  }

  const cambiarClave = async (e) => {
    e.preventDefault()
    setAviso({ ...aviso, clave: '' })
    const encontrados = {}
    if (!clave.actual) encontrados.actual = 'Escribe tu contraseña actual'
    const nueva = errorContrasena(clave.nueva)
    if (nueva) encontrados.nueva = nueva
    else if (clave.nueva === clave.actual) encontrados.nueva = 'La nueva contraseña debe ser distinta de la actual'
    if (!encontrados.nueva && clave.nueva !== clave.confirmar) encontrados.confirmar = 'Las contraseñas no coinciden'
    setErroresClave(encontrados)
    if (Object.keys(encontrados).length) return
    setGuardando('clave')
    try {
      const { data } = await api.put('/cuenta/contrasena', clave)
      setClave(CLAVE_VACIA)
      setAviso({ ...aviso, clave: data.mensaje })
    } catch (err) {
      setErroresClave(err.response?.data?.detalles || {})
      if (!err.response?.data?.detalles) setError(mensajeDeError(err))
    } finally {
      setGuardando('')
    }
  }

  if (!cuenta) {
    return (
      <div className="container mi-cuenta">
        {error ? <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div> : <div className="cargando"><span className="giro" /> Cargando tu cuenta…</div>}
      </div>
    )
  }

  const hoy = new Date().toLocaleDateString('en-CA')
  const [a, m, d] = hoy.split('-')
  const maxNacimiento = `${Number(a) - 18}-${m}-${d}`

  return (
    <div className="container mi-cuenta">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Mi cuenta</span>
          <h1>{cuenta.nombres} {cuenta.apellidos}</h1>
          <p>{NOMBRE_ROL[cuenta.rol]}{cuenta.cooperativa ? ` · ${cuenta.cooperativa}` : ''}</p>
        </div>
      </div>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}

      <div className="mi-cuenta__rejilla">
        <form className="card" onSubmit={guardarDatos} noValidate>
          <div className="card-header fila"><Icono nombre="usuario" tam={18} /> Datos personales</div>
          <div className="card-body">
            <dl className="mi-cuenta__fijos">
              <div><dt>Cédula</dt><dd>{cuenta.cedula}</dd></div>
              <div><dt>Correo</dt><dd>{cuenta.email}</dd></div>
              <div><dt>Cuenta creada el</dt><dd>{new Date(cuenta.creado_en).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
            </dl>
            <p className="mi-cuenta__nota">La cédula, el nombre y el correo identifican tu cuenta y no se pueden cambiar aquí.</p>

            <Campo id="telefono" etiqueta="Celular" error={errores.telefono} ayuda="Opcional. Celular (09XXXXXXXX) o fijo con código de provincia.">
              <input id="telefono" inputMode="tel" maxLength={10} placeholder="09XXXXXXXX" value={datos.telefono}
                onChange={(e) => { setDatos({ ...datos, telefono: e.target.value.replace(/\D/g, '') }); setErrores({ ...errores, telefono: '' }) }} />
            </Campo>
            <Campo id="fecha_nacimiento" etiqueta="Fecha de nacimiento" error={errores.fecha_nacimiento}
              ayuda={cuenta.fecha_nacimiento ? 'Ya registrada: de ella dependen los descuentos por edad. Si hay un error, escribe a soporte.' : 'Regístrala una sola vez para los descuentos por edad.'}>
              <input id="fecha_nacimiento" type="date" max={maxNacimiento} disabled={Boolean(cuenta.fecha_nacimiento)} value={datos.fecha_nacimiento}
                onChange={(e) => { setDatos({ ...datos, fecha_nacimiento: e.target.value }); setErrores({ ...errores, fecha_nacimiento: '' }) }} />
            </Campo>
            {aviso.datos && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso.datos}</div>}
            <button className="btn btn-primary" disabled={guardando === 'datos'}>{guardando === 'datos' ? 'Guardando…' : 'Guardar datos'}</button>
          </div>
        </form>

        <form className="card" onSubmit={cambiarClave} noValidate>
          <div className="card-header fila"><Icono nombre="llave" tam={18} /> Cambiar contraseña</div>
          <div className="card-body">
            <Campo id="actual" etiqueta="Contraseña actual" error={erroresClave.actual}>
              <input id="actual" type={verClave ? 'text' : 'password'} autoComplete="current-password" value={clave.actual}
                onChange={(e) => { setClave({ ...clave, actual: e.target.value }); setErroresClave({ ...erroresClave, actual: '' }) }} />
            </Campo>
            <Campo id="nueva" etiqueta="Nueva contraseña" error={erroresClave.nueva}>
              <input id="nueva" type={verClave ? 'text' : 'password'} autoComplete="new-password" maxLength={64} value={clave.nueva}
                onChange={(e) => { setClave({ ...clave, nueva: e.target.value }); setErroresClave({ ...erroresClave, nueva: '' }) }} />
            </Campo>
            <ul className="mi-cuenta__requisitos">
              {requisitosContrasena(clave.nueva).map((r) => (
                <li key={r.texto} className={r.cumple ? 'cumple' : ''}><Icono nombre={r.cumple ? 'check' : 'info'} tam={14} /> {r.texto}</li>
              ))}
            </ul>
            <Campo id="confirmar" etiqueta="Repite la nueva contraseña" error={erroresClave.confirmar}>
              <input id="confirmar" type={verClave ? 'text' : 'password'} autoComplete="new-password" maxLength={64} value={clave.confirmar}
                onChange={(e) => { setClave({ ...clave, confirmar: e.target.value }); setErroresClave({ ...erroresClave, confirmar: '' }) }} />
            </Campo>
            <label className="form-check"><input type="checkbox" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} /> Mostrar contraseñas</label>
            {aviso.clave && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso.clave}</div>}
            <button className="btn btn-primary" disabled={guardando === 'clave'}>{guardando === 'clave' ? 'Cambiando…' : 'Cambiar contraseña'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
