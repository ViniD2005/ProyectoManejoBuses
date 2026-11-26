import { useEffect, useState } from 'react'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { EVENTO_CONFIGURACION } from '../../hooks/useConfiguracion.js'
import { errorCorreo, errorTelefono } from '../../utils/validaciones.js'

/*
  CC-12 + GC-33 + GC-43: configuración general de la aplicación (solo el administrador).
  Los datos se agrupan por tema y se validan antes de enviarlos, con las mismas
  reglas que aplica el servidor.
*/
const SECCIONES = [
  {
    titulo: 'Identidad', icono: 'paleta', campos: [
      { name: 'nombre_app', texto: 'Nombre de la aplicación', props: { maxLength: 40, placeholder: 'Pasajes Ecuador' } },
      { name: 'logo_url', texto: 'URL del logo (imagen)', props: { placeholder: 'https://…' }, ayuda: 'Opcional. Enlace público a una imagen PNG o SVG.' },
      { name: 'color_primario', texto: 'Color principal', props: { type: 'color' } },
      { name: 'color_acento', texto: 'Color de acento', props: { type: 'color' } },
    ],
  },
  {
    titulo: 'Soporte al cliente', icono: 'telefono', campos: [
      { name: 'soporte_email', texto: 'Correo de soporte', props: { type: 'email', placeholder: 'soporte@pasajes.ec' } },
      { name: 'soporte_telefono', texto: 'Teléfono de soporte', props: { inputMode: 'tel', placeholder: '09XXXXXXXX o 02XXXXXXX', maxLength: 12 } },
      { name: 'facebook_url', texto: 'Facebook', props: { placeholder: 'https://facebook.com/…' } },
      { name: 'instagram_url', texto: 'Instagram', props: { placeholder: 'https://instagram.com/…' } },
    ],
  },
]

const URL_WEB = /^https?:\/\/\S+$/
const COLOR = /^#[0-9a-fA-F]{6}$/

function validar(form) {
  const e = {}
  const nombre = String(form.nombre_app || '').trim()
  if (!nombre) e.nombre_app = 'El nombre de la aplicación es obligatorio'
  else if (nombre.length < 2 || nombre.length > 40) e.nombre_app = 'El nombre debe tener entre 2 y 40 caracteres'
  if (!COLOR.test(form.color_primario || '')) e.color_primario = 'Usa un color en formato #RRGGBB'
  if (!COLOR.test(form.color_acento || '')) e.color_acento = 'Usa un color en formato #RRGGBB'
  for (const clave of ['logo_url', 'facebook_url', 'instagram_url']) {
    if (form[clave] && !URL_WEB.test(form[clave])) e[clave] = 'Debe ser una dirección que empiece con http:// o https://'
  }
  if (form.soporte_email) e.soporte_email = errorCorreo(form.soporte_email)
  e.soporte_telefono = errorTelefono(form.soporte_telefono)
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v))
}

export default function Configuracion() {
  const [form, setForm] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api.get('/configuracion')
      .then(({ data }) => setForm(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  const cambiar = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrores({ ...errores, [e.target.name]: '' })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    const encontrados = validar(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return setError('Revisa los datos marcados')
    setGuardando(true)
    try {
      const { data } = await api.put('/configuracion', form)
      setForm(data)
      setAviso('Configuración guardada. Los cambios ya se ven en la aplicación.')
      window.dispatchEvent(new Event(EVENTO_CONFIGURACION))
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setGuardando(false)
    }
  }

  if (!form) {
    return (
      <div className="container">
        {error ? <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div> : <div className="cargando"><span className="giro" /> Cargando configuración…</div>}
      </div>
    )
  }

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Administración</span>
          <h1>Configuración de la aplicación</h1>
          <p>Nombre, logo, colores y datos de soporte que ven todos los usuarios.</p>
        </div>
      </div>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}

      {/* GC-43: la aplicación no cobra: cada cooperativa recibe los pagos en su propia cuenta */}
      <div className="alerta alerta--info">
        <Icono nombre="info" />
        <div>
          <b>Las cuentas bancarias las registra cada cooperativa</b>
          <div>Los clientes pagan directamente a la cooperativa de su viaje. Regístrala o corrígela en <b>Cooperativas → Cuenta bancaria</b>, o la cooperativa desde «Datos y apariencia».</div>
        </div>
      </div>

      <form onSubmit={guardar} noValidate>
        {SECCIONES.map((seccion) => (
          <section key={seccion.titulo} className="card">
            <div className="card-header fila"><Icono nombre={seccion.icono} tam={18} /> {seccion.titulo}</div>
            <div className="card-body rejilla-2">
              {seccion.campos.map((campo) => (
                <div key={campo.name} className={`campo ${errores[campo.name] ? 'campo--error' : ''}`}>
                  <label className="campo__etiqueta" htmlFor={campo.name}>{campo.texto}</label>
                  <input id={campo.name} name={campo.name} className="form-control" value={form[campo.name] || ''} onChange={cambiar}
                    aria-invalid={Boolean(errores[campo.name])} {...campo.props} />
                  {errores[campo.name]
                    ? <span className="campo__error">{errores[campo.name]}</span>
                    : campo.ayuda && <span className="campo__ayuda">{campo.ayuda}</span>}
                </div>
              ))}
            </div>
          </section>
        ))}

        {form.logo_url && URL_WEB.test(form.logo_url) && (
          <p className="texto-suave">Vista previa del logo: <img src={form.logo_url} alt="Logo" style={{ height: 40, verticalAlign: 'middle' }} /></p>
        )}

        <button className="btn btn-primary btn--lg" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar configuración'}</button>
      </form>
    </div>
  )
}
