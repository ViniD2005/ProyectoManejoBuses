import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { errorCorreo } from '../../utils/validaciones.js'
import { TarjetaCorreo, BotonReenviar, AccesoMailHog } from './PiezasCorreo.jsx'

/*
  GC-12: el usuario pide un enlace para crear una nueva contraseña.
  La respuesta es la misma exista o no la cuenta, así nadie puede
  averiguar qué correos están registrados.
*/
export default function OlvideContrasena() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(null)

  const enviar = async (e) => {
    e.preventDefault()
    const problema = errorCorreo(email)
    if (problema) return setError(problema)
    setError('')
    setEnviando(true)
    try {
      const { data } = await api.post('/auth/olvide-contrasena', { email: email.trim() })
      setEnviado(data)
    } catch (err) {
      setError(err.response?.data?.detalles?.email || mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <TarjetaCorreo icono="correo" insignia="1" titulo="Revisa tu correo"
        pie={<>¿Recordaste tu contraseña? <Link to="/login" state={{ email }}>Inicia sesión</Link></>}>
        <p className="correo-tarjeta__texto">{enviado.mensaje}</p>
        <div className="correo-tarjeta__email"><Icono nombre="correo" tam={16} /> {email.trim().toLowerCase()}</div>
        <ol className="correo-pasos">
          <li>Abre el correo «Restablece tu contraseña».</li>
          <li>Presiona «Crear nueva contraseña». El enlace dura {enviado.minutos || 30} minutos y sirve una sola vez.</li>
          <li>Escribe tu nueva contraseña e inicia sesión con ella.</li>
        </ol>
        <div className="correo-acciones">
          <BotonReenviar ruta="/auth/olvide-contrasena" email={email.trim()} esperaInicial={enviado.espera || 60} />
          <button type="button" className="btn btn--fantasma btn--bloque" onClick={() => setEnviado(null)}>Usar otro correo</button>
        </div>
        <AccesoMailHog />
      </TarjetaCorreo>
    )
  }

  return (
    <TarjetaCorreo icono="llave" titulo="¿Olvidaste tu contraseña?"
      pie={<>¿No tienes cuenta? <Link to="/registro">Crea una gratis</Link></>}>
      <p className="correo-tarjeta__texto">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.</p>
      <form onSubmit={enviar} noValidate>
        <div className={`campo ${error ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="email" placeholder="nombre@correo.com" value={email} autoFocus
            onChange={(e) => { setEmail(e.target.value); setError('') }} aria-invalid={Boolean(error)} />
          {error && <span className="campo__error"><Icono nombre="alerta" tam={15} /> {error}</span>}
        </div>
        <button className="btn btn-primary btn--lg btn--bloque" disabled={enviando}>
          {enviando ? 'Enviando…' : <>Enviarme el enlace <Icono nombre="flecha" tam={18} /></>}
        </button>
        <Link to="/login" className="btn btn--fantasma btn--bloque" style={{ marginTop: '.6rem' }}>
          <Icono nombre="flechaIzq" tam={18} /> Volver a iniciar sesión
        </Link>
      </form>
    </TarjetaCorreo>
  )
}
