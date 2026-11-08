import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import { EVENTO_CONFIGURACION } from '../../hooks/useConfiguracion.js'

const CAMPOS = [
  { name: 'nombre_app', texto: 'Nombre de la aplicación', props: { required: true } },
  { name: 'logo_url', texto: 'URL del logo (imagen)', props: { placeholder: 'https://...' } },
  { name: 'color_primario', texto: 'Color principal', props: { type: 'color' } },
  { name: 'color_acento', texto: 'Color de acento', props: { type: 'color' } },
  { name: 'soporte_email', texto: 'Correo de soporte', props: { type: 'email' } },
  { name: 'soporte_telefono', texto: 'Teléfono de soporte', props: { type: 'tel' } },
  { name: 'facebook_url', texto: 'Facebook', props: { placeholder: 'https://facebook.com/...' } },
  { name: 'instagram_url', texto: 'Instagram', props: { placeholder: 'https://instagram.com/...' } },
  { name: 'cuenta_bancaria', texto: 'Cuenta bancaria para transferencias', props: {} },
]

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

export default function Configuracion() {
  const [form, setForm] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api.get('/configuracion')
      .then(({ data }) => setForm(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    setErrores({})
    try {
      const { data } = await api.put('/configuracion', form)
      setForm(data)
      setAviso('Configuración guardada. Los cambios ya se ven en la aplicación.')
      window.dispatchEvent(new Event(EVENTO_CONFIGURACION))
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    }
  }

  if (!form) {
    return <div className="container"><p>{error || 'Cargando configuración…'}</p></div>
  }

  return (
    <div className="container">
      <h1 className="mb-2">Configuración de la aplicación</h1>
      <p className="text-muted mb-4">Nombre, logo, colores, redes sociales y datos de soporte que ven todos los usuarios.</p>

      <div className="card">
        <form className="card-body" onSubmit={guardar}>
          {CAMPOS.map((campo) => (
            <div className="mb-3" key={campo.name}>
              <label className="form-label" htmlFor={campo.name}>{campo.texto}</label>
              <input id={campo.name} name={campo.name} className="form-control"
                value={form[campo.name] || ''} onChange={cambiar} {...campo.props} />
              {errores[campo.name] && <small style={{ color: '#b3261e' }}>{errores[campo.name]}</small>}
            </div>
          ))}

          {form.logo_url && (
            <p className="mb-3">Vista previa del logo: <img src={form.logo_url} alt="Logo" style={{ height: 40, verticalAlign: 'middle' }} /></p>
          )}

          {error && <p style={{ color: '#b3261e' }}>{error}</p>}
          {aviso && <p style={{ color: '#1e7a4c' }}>{aviso}</p>}
          <button className="btn btn-primary">Guardar configuración</button>
        </form>
      </div>
    </div>
  )
}
