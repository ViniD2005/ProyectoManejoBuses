import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import ArteAcceso from './ArteAcceso.jsx'
import { TarjetaCorreo, BotonReenviar, AccesoMailHog } from './PiezasCorreo.jsx'
import {
  errorCedula, errorNombres, errorCorreo, errorTelefono, errorFechaNacimiento,
  errorContrasena, requisitosContrasena, haceAnios,
} from '../../utils/validaciones.js'

const VACIO = { cedula: '', nombres: '', apellidos: '', email: '', telefono: '', fecha_nacimiento: '', password: '', confirmar: '' }

// Revisa todo el formulario con las mismas reglas del servidor
function validar(form) {
  const errores = {
    cedula: errorCedula(form.cedula),
    nombres: errorNombres(form.nombres, 'tus nombres'),
    apellidos: errorNombres(form.apellidos, 'tus apellidos'),
    fecha_nacimiento: errorFechaNacimiento(form.fecha_nacimiento, 18), // GC-33: mayor de edad
    email: errorCorreo(form.email),
    telefono: errorTelefono(form.telefono),
    password: errorContrasena(form.password),
    confirmar: !form.confirmar ? 'Vuelve a escribir tu contraseña'
      : form.confirmar !== form.password ? 'Las contraseñas no coinciden' : '',
  }
  return Object.fromEntries(Object.entries(errores).filter(([, v]) => v))
}

function Registro() {
  const { registrarse } = useAuth()
  const [form, setForm] = useState(VACIO)
  const [registrado, setRegistrado] = useState(null)
  const [tocados, setTocados] = useState({})
  const [erroresServidor, setErroresServidor] = useState({})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [verClave, setVerClave] = useState(false)

  const erroresLocales = validar(form)
  const errorDe = (campo) => erroresServidor[campo] || (tocados[campo] ? erroresLocales[campo] : '')

  const cambiar = (e) => {
    let { value } = e.target
    if (e.target.name === 'cedula' || e.target.name === 'telefono') value = value.replace(/\D/g, '').slice(0, 10)
    setForm({ ...form, [e.target.name]: value })
    if (erroresServidor[e.target.name]) setErroresServidor({ ...erroresServidor, [e.target.name]: undefined })
  }
  const tocar = (e) => setTocados({ ...tocados, [e.target.name]: true })

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    if (Object.keys(erroresLocales).length) {
      setTocados(Object.fromEntries(Object.keys(VACIO).map((k) => [k, true])))
      setError('Revisa los datos marcados en el formulario')
      return
    }
    setEnviando(true)
    try {
      const datos = { ...form }
      delete datos.confirmar
      // GC-12: se muestra "revisa tu correo" en lugar de entrar directo
      setRegistrado(await registrarse(datos))
      window.scrollTo(0, 0)
    } catch (err) {
      setError(mensajeDeError(err))
      setErroresServidor(err.response?.data?.detalles || {})
    } finally {
      setEnviando(false)
    }
  }

  const campo = (name, etiqueta, props = {}, ayuda) => (
    <div className={`campo ${errorDe(name) ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={name}>{etiqueta}</label>
      <input id={name} name={name} value={form[name]} onChange={cambiar} onBlur={tocar}
        aria-invalid={Boolean(errorDe(name))} {...props} />
      {errorDe(name)
        ? <span className="campo__error"><Icono nombre="alerta" tam={15} /> {errorDe(name)}</span>
        : ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </div>
  )

  if (registrado) {
    return (
      <TarjetaCorreo icono="correo" insignia="1" titulo="¡Ya casi! Confirma tu correo"
        pie={<>¿Escribiste mal el correo? <button type="button" className="btn-enlace" onClick={() => setRegistrado(null)}>Corrige tus datos</button></>}>
        <p className="correo-tarjeta__texto">
          Hola, <strong>{form.nombres.trim().split(/\s+/)[0]}</strong>. Creamos tu cuenta y te enviamos un enlace para activarla a:
        </p>
        <div className="correo-tarjeta__email">{registrado.email}</div>
        {!registrado.correo_enviado && (
          <div className="alerta alerta--aviso" style={{ textAlign: 'left', marginTop: '1rem' }}>
            No pudimos enviar el correo en este momento. Presiona «Reenviar el correo» en un minuto.
          </div>
        )}
        <ol className="correo-pasos">
          <li>Abre el correo «Confirma tu correo para activar tu cuenta». Si no aparece, revisa la carpeta de spam.</li>
          <li>Presiona «Confirmar mi correo». El enlace dura 24 horas.</li>
          <li>Inicia sesión y compra tu primer pasaje.</li>
        </ol>
        <div className="correo-acciones">
          <BotonReenviar ruta="/auth/reenviar-verificacion" email={registrado.email} />
          <Link to="/login" state={{ email: registrado.email }} className="btn btn--fantasma btn--bloque">Ya lo confirmé, iniciar sesión</Link>
        </div>
        <AccesoMailHog />
      </TarjetaCorreo>
    )
  }

  const requisitos = requisitosContrasena(form.password)
  const nivel = form.password ? requisitos.filter((r) => r.cumple).length : 0

  return (
    <div className="acceso">
      <ArteAcceso
        titulo="Crea tu cuenta y viaja sin filas"
        texto="Con tu cuenta compras pasajes, guardas tus boletos y recibes avisos de tus viajes."
      />
      <div className="acceso__formulario">
        <form className="acceso__caja acceso__caja--ancha" onSubmit={enviar} noValidate>
          <span className="etiqueta-seccion">Registro gratuito</span>
          <h1>Crear cuenta</h1>
          <p>Completa tus datos tal como aparecen en tu cédula.</p>

          {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}

          {campo('cedula', 'Cédula', { inputMode: 'numeric', placeholder: '10 dígitos', autoComplete: 'off' })}
          <div className="rejilla-2">
            {campo('nombres', 'Nombres', { autoComplete: 'given-name', placeholder: 'Ej. María José' })}
            {campo('apellidos', 'Apellidos', { autoComplete: 'family-name', placeholder: 'Ej. Pérez Gómez' })}
          </div>
          <div className="rejilla-2">
            {campo('fecha_nacimiento', 'Fecha de nacimiento', { type: 'date', max: haceAnios(18), min: haceAnios(120) }, 'Debes ser mayor de edad. Sirve para aplicar descuentos de ley.')}
            {campo('telefono', 'Celular (opcional)', { inputMode: 'tel', placeholder: '09XXXXXXXX', autoComplete: 'tel' })}
          </div>
          {campo('email', 'Correo electrónico', { type: 'email', placeholder: 'nombre@correo.com', autoComplete: 'email' })}

          <div className={`campo ${errorDe('password') ? 'campo--error' : ''}`}>
            <label className="campo__etiqueta" htmlFor="password">Contraseña</label>
            <div className="campo-contrasena">
              <input id="password" name="password" type={verClave ? 'text' : 'password'} autoComplete="new-password"
                value={form.password} onChange={cambiar} onBlur={tocar} placeholder="Crea una contraseña segura" />
              <button type="button" onClick={() => setVerClave(!verClave)} aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <Icono nombre={verClave ? 'ojoCerrado' : 'ojo'} tam={18} />
              </button>
            </div>
            <div className="fortaleza" data-nivel={nivel}><span /><span /><span /><span /></div>
            <ul className="requisitos">
              {requisitos.map((r) => (
                <li key={r.texto} className={r.cumple ? 'cumple' : ''}>
                  <Icono nombre={r.cumple ? 'checkCirculo' : 'info'} tam={14} /> {r.texto}
                </li>
              ))}
            </ul>
          </div>
          {campo('confirmar', 'Confirmar contraseña', { type: verClave ? 'text' : 'password', autoComplete: 'new-password', placeholder: 'Repite la contraseña' })}

          <button className="btn btn-primary btn--lg btn--bloque" disabled={enviando}>
            {enviando ? 'Creando tu cuenta…' : <>Crear cuenta <Icono nombre="flecha" tam={18} /></>}
          </button>
          <p className="acceso__pie">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
        </form>
      </div>
    </div>
  )
}

export default Registro
