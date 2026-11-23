import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, INICIO_POR_ROL } from '../../context/AuthContext.jsx'
import { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import ArteAcceso from './ArteAcceso.jsx'
import { BotonReenviar } from './PiezasCorreo.jsx'
import './Correo.css'

function Login() {
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: location.state?.email || '', password: '' })
  // GC-12: cuenta creada pero el correo aún no se confirma
  const [sinVerificar, setSinVerificar] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Escribe tu correo electrónico y tu contraseña')
      return
    }
    setError('')
    setSinVerificar('')
    setEnviando(true)
    try {
      const usuario = await iniciarSesion(form.email.trim(), form.password)
      // GC-10: el personal nunca vuelve a una página de compra; va a su propio inicio
      const desde = location.state?.desde
      const soloClientes = ['/comprar', '/mis-boletos']
      const volverA = desde && !(usuario.rol !== 'cliente' && soloClientes.includes(desde)) ? desde : null
      navigate(volverA || INICIO_POR_ROL[usuario.rol], { replace: true })
    } catch (err) {
      const detalles = err.response?.data?.detalles
      if (detalles?.correo_no_verificado) setSinVerificar(detalles.email)
      else setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="acceso">
      <ArteAcceso
        titulo="Tu próximo viaje empieza aquí"
        texto="Compra tus pasajes interprovinciales en minutos, elige tu asiento y lleva tu boleto en el celular."
      />
      <div className="acceso__formulario">
        <form className="acceso__caja" onSubmit={enviar} noValidate>
          <span className="etiqueta-seccion">Bienvenido de nuevo</span>
          <h1>Iniciar sesión</h1>
          <p>Ingresa con el correo y la contraseña de tu cuenta.</p>

          {location.state?.verificado && !error && !sinVerificar && (
            <div className="alerta alerta--exito" role="status">
              <Icono nombre="checkCirculo" /> Tu correo está confirmado. Ingresa con tu contraseña.
            </div>
          )}
          {sinVerificar && (
            <div className="alerta alerta--aviso" role="alert">
              <Icono nombre="correo" />
              <div style={{ flex: 1 }}>
                <strong>Confirma tu correo para ingresar</strong>
                Te enviamos un enlace a {sinVerificar}. Si no lo encuentras, revisa spam o pide uno nuevo.
                <BotonReenviar ruta="/auth/reenviar-verificacion" email={sinVerificar} esperaInicial={0}
                  texto="Reenviar el correo de confirmación" clase="btn btn-sm" />
              </div>
            </div>
          )}
          {location.state?.expirada && !error && (
            <div className="alerta alerta--info" role="status">
              <Icono nombre="info" /> Tu sesión expiró por seguridad. Vuelve a iniciar sesión para continuar.
            </div>
          )}
          {error && (
            <div className="alerta alerta--error" role="alert">
              <Icono nombre="alerta" /> {error}
            </div>
          )}

          <div className="campo">
            <label className="campo__etiqueta" htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="nombre@correo.com"
              value={form.email} onChange={cambiar} autoFocus />
          </div>
          <div className="campo">
            <label className="campo__etiqueta" htmlFor="password">Contraseña</label>
            <div className="campo-contrasena">
              <input id="password" name="password" type={verClave ? 'text' : 'password'} autoComplete="current-password"
                placeholder="Tu contraseña" value={form.password} onChange={cambiar} />
              <button type="button" onClick={() => setVerClave(!verClave)} aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <Icono nombre={verClave ? 'ojoCerrado' : 'ojo'} tam={18} />
              </button>
            </div>
          </div>
          <div className="acceso__olvide">
            <Link to="/olvide-contrasena" state={{ email: form.email.trim() }}>¿Olvidaste tu contraseña?</Link>
          </div>

          <button className="btn btn-primary btn--lg btn--bloque" disabled={enviando}>
            {enviando ? <><span className="giro" style={{ width: 18, height: 18, borderWidth: 2 }} /> Ingresando…</> : <>Iniciar sesión <Icono nombre="flecha" tam={18} /></>}
          </button>
          <p className="acceso__pie">¿Aún no tienes cuenta? <Link to="/registro">Crea una gratis</Link></p>
        </form>
      </div>
    </div>
  )
}

export default Login
