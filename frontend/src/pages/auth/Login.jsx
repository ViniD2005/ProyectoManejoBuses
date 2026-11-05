import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, INICIO_POR_ROL } from '../../context/AuthContext.jsx'

function Login() {
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const usuario = await iniciarSesion(form.email, form.password)
      navigate(location.state?.desde || INICIO_POR_ROL[usuario.rol], { replace: true })
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No se pudo conectar con el servidor')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <h1>Iniciar sesión</h1>
      <label>
        Correo electrónico
        <input name="email" type="email" value={form.email} onChange={cambiar} required />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" value={form.password} onChange={cambiar} required />
      </label>
      {error && <p className="mensaje-error">{error}</p>}
      <button disabled={enviando}>{enviando ? 'Ingresando…' : 'Iniciar sesión'}</button>
      <p>¿No tienes cuenta? <Link to="/registro">Regístrate</Link></p>
    </form>
  )
}

export default Login
