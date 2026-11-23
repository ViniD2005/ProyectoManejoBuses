import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { errorContrasena, requisitosContrasena } from '../../utils/validaciones.js'
import { TarjetaCorreo } from './PiezasCorreo.jsx'

/*
  GC-12: el usuario llega desde el botón "Crear nueva contraseña".
  Primero se revisa el enlace (vencido, usado o inválido) y solo si sirve
  se muestra el formulario. Al terminar se le envía un aviso por correo.
*/
export default function RestablecerContrasena() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token') || ''
  const [enlace, setEnlace] = useState(token ? null : { error: 'El enlace está incompleto. Ábrelo de nuevo desde el correo.' })
  const [form, setForm] = useState({ password: '', confirmar: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(null)

  useEffect(() => {
    if (!token) return
    let activo = true
    api.post('/auth/revisar-enlace', { token })
      .then(({ data }) => activo && setEnlace(data))
      .catch((err) => activo && setEnlace({ error: mensajeDeError(err), motivo: err.response?.data?.detalles?.motivo }))
    return () => { activo = false }
  }, [token])

  const cambiar = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrores({ ...errores, [e.target.name]: '' })
    setError('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    const encontrados = {}
    const problema = errorContrasena(form.password)
    if (problema) encontrados.password = problema
    if (!form.confirmar) encontrados.confirmar = 'Vuelve a escribir la nueva contraseña'
    else if (form.confirmar !== form.password) encontrados.confirmar = 'Las contraseñas no coinciden'
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return
    setGuardando(true)
    try {
      const { data } = await api.post('/auth/restablecer-contrasena', { token, ...form })
      setListo(data)
    } catch (err) {
      const detalles = err.response?.data?.detalles || {}
      if (detalles.motivo) setEnlace({ error: mensajeDeError(err), motivo: detalles.motivo })
      else { setErrores(detalles); setError(mensajeDeError(err)) }
    } finally {
      setGuardando(false)
    }
  }

  if (!enlace) {
    return (
      <TarjetaCorreo icono="llave" titulo="Revisando el enlace…">
        <p className="correo-tarjeta__texto"><span className="giro" /> Un momento.</p>
      </TarjetaCorreo>
    )
  }

  if (enlace.error) {
    return (
      <TarjetaCorreo icono={enlace.motivo === 'vencido' ? 'reloj' : 'alerta'} tono="error"
        titulo={enlace.motivo === 'vencido' ? 'El enlace venció' : 'Este enlace ya no sirve'}
        pie={<>¿Recordaste tu contraseña? <Link to="/login">Inicia sesión</Link></>}>
        <p className="correo-tarjeta__texto">{enlace.error}</p>
        <div className="correo-acciones">
          <Link to="/olvide-contrasena" className="btn btn-primary btn--lg btn--bloque">Pedir un enlace nuevo</Link>
        </div>
      </TarjetaCorreo>
    )
  }

  if (listo) {
    return (
      <TarjetaCorreo icono="escudo" tono="exito" titulo="¡Contraseña actualizada!"
        pie="Te enviamos un correo confirmando el cambio. Si no fuiste tú, avísanos de inmediato.">
        <p className="correo-tarjeta__texto">{listo.mensaje}</p>
        <div className="correo-acciones">
          <Link to="/login" state={{ email: listo.email }} className="btn btn-primary btn--lg btn--bloque">
            Iniciar sesión <Icono nombre="flecha" tam={18} />
          </Link>
        </div>
      </TarjetaCorreo>
    )
  }

  const requisitos = requisitosContrasena(form.password)
  const nivel = form.password ? requisitos.filter((r) => r.cumple).length : 0

  return (
    <TarjetaCorreo icono="llave" titulo={`Crea tu nueva contraseña${enlace.nombres ? `, ${enlace.nombres}` : ''}`}
      pie="El enlace sirve una sola vez. Al guardar, tu contraseña anterior deja de funcionar.">
      <p className="correo-tarjeta__texto">Cuenta <strong>{enlace.email}</strong>. Usa una contraseña que no hayas usado antes.</p>
      <form onSubmit={guardar} noValidate>
        {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
        <div className={`campo ${errores.password ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor="password">Nueva contraseña</label>
          <div className="campo-contrasena">
            <input id="password" name="password" type={verClave ? 'text' : 'password'} autoComplete="new-password" autoFocus
              value={form.password} onChange={cambiar} placeholder="Crea una contraseña segura" aria-invalid={Boolean(errores.password)} />
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
          {errores.password && <span className="campo__error"><Icono nombre="alerta" tam={15} /> {errores.password}</span>}
        </div>
        <div className={`campo ${errores.confirmar ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor="confirmar">Confirmar contraseña</label>
          <input id="confirmar" name="confirmar" type={verClave ? 'text' : 'password'} autoComplete="new-password"
            value={form.confirmar} onChange={cambiar} placeholder="Repite la nueva contraseña" aria-invalid={Boolean(errores.confirmar)} />
          {errores.confirmar && <span className="campo__error"><Icono nombre="alerta" tam={15} /> {errores.confirmar}</span>}
        </div>
        <button className="btn btn-primary btn--lg btn--bloque" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar nueva contraseña'}
        </button>
      </form>
    </TarjetaCorreo>
  )
}
