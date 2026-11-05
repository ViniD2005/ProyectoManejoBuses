import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const VACIO = { cedula: '', nombres: '', apellidos: '', email: '', telefono: '', fecha_nacimiento: '', password: '' }

function Registro() {
  const { registrarse } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setErrores({})
    try {
      await registrarse(form)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo conectar con el servidor')
      setErrores(err.response?.data?.detalles || {})
    }
  }

  const campo = (name, texto, props = {}) => (
    <label>
      {texto}
      <input name={name} value={form[name]} onChange={cambiar} {...props} />
      {errores[name] && <small className="mensaje-error">{errores[name]}</small>}
    </label>
  )

  return (
    <form className="formulario" onSubmit={enviar}>
      <h1>Crear cuenta</h1>
      {campo('cedula', 'Cédula', { maxLength: 10, required: true })}
      {campo('nombres', 'Nombres', { required: true })}
      {campo('apellidos', 'Apellidos', { required: true })}
      {campo('fecha_nacimiento', 'Fecha de nacimiento', { type: 'date', required: true })}
      {campo('email', 'Correo electrónico', { type: 'email', required: true })}
      {campo('telefono', 'Teléfono (opcional)', { type: 'tel' })}
      {campo('password', 'Contraseña (mínimo 8 caracteres)', { type: 'password', minLength: 8, required: true })}
      {error && <p className="mensaje-error">{error}</p>}
      <button>Crear cuenta</button>
      <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </form>
  )
}

export default Registro
