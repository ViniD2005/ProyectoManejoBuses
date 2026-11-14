import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'

const NOMBRE_ROL = {
  admin: 'Administrador',
  cooperativa: 'Usuario de cooperativa',
  oficinista: 'Oficinista',
  personal_bus: 'Personal del bus (chofer o ayudante)',
}
const ROLES_POR_USUARIO = {
  admin: ['cooperativa', 'oficinista', 'personal_bus', 'admin'],
  cooperativa: ['oficinista', 'personal_bus'],
}
const FORM_VACIO = { rol: '', cooperativa_id: '', cedula: '', nombres: '', apellidos: '', email: '', telefono: '', password: '' }

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

// CC-16: gestión de usuarios internos (admin: todos; cooperativa: su personal)
export default function Usuarios() {
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === 'admin'
  const roles = ROLES_POR_USUARIO[usuario?.rol] || []

  const [usuarios, setUsuarios] = useState([])
  const [cooperativas, setCooperativas] = useState([])
  const [form, setForm] = useState({ ...FORM_VACIO, rol: roles[0] || '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = () =>
    api.get('/usuarios')
      .then(({ data }) => setUsuarios(data))
      .catch((err) => setError(mensajeDeError(err)))

  useEffect(() => {
    cargar()
    if (esAdmin) {
      api.get('/cooperativas').then(({ data }) => setCooperativas(data.filter((c) => c.activa))).catch(() => {})
    }
  }, [esAdmin])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    setErrores({})
    try {
      const { data } = await api.post('/usuarios', form)
      setAviso(`Usuario ${data.email} creado como ${NOMBRE_ROL[data.rol]}`)
      setForm({ ...FORM_VACIO, rol: form.rol, cooperativa_id: form.cooperativa_id })
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    }
  }

  const alternarEstado = async (u) => {
    try {
      await api.patch(`/usuarios/${u.id}/estado`, { activo: !u.activo })
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const campo = (name, texto, props = {}) => (
    <div className="mb-3">
      <label className="form-label" htmlFor={name}>{texto}</label>
      <input id={name} name={name} className="form-control" value={form[name]} onChange={cambiar} {...props} />
      {errores[name] && <small style={{ color: '#b3261e' }}>{errores[name]}</small>}
    </div>
  )

  return (
    <div className="container">
      <h1 className="mb-2">{esAdmin ? 'Usuarios' : 'Personal de la cooperativa'}</h1>
      <p className="text-muted mb-4">
        {esAdmin
          ? 'Crea usuarios de cooperativa, oficinistas y personal del bus. Los clientes se registran solos.'
          : 'Crea oficinistas y personal del bus (choferes o ayudantes) de tu cooperativa.'}
      </p>

      <div className="card">
        <form className="card-body" onSubmit={guardar}>
          <h2 className="h4 mb-3">Nuevo usuario</h2>
          <div className="mb-3">
            <label className="form-label" htmlFor="rol">Rol</label>
            <select id="rol" name="rol" className="form-control" value={form.rol} onChange={cambiar}>
              {roles.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r]}</option>)}
            </select>
            {errores.rol && <small style={{ color: '#b3261e' }}>{errores.rol}</small>}
          </div>
          {esAdmin && form.rol !== 'admin' && (
            <div className="mb-3">
              <label className="form-label" htmlFor="cooperativa_id">Cooperativa</label>
              <select id="cooperativa_id" name="cooperativa_id" className="form-control" value={form.cooperativa_id} onChange={cambiar}>
                <option value="">Elige una cooperativa</option>
                {cooperativas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {errores.cooperativa_id && <small style={{ color: '#b3261e' }}>{errores.cooperativa_id}</small>}
            </div>
          )}
          {campo('cedula', 'Cédula', { maxLength: 10, required: true })}
          {campo('nombres', 'Nombres', { required: true })}
          {campo('apellidos', 'Apellidos', { required: true })}
          {campo('email', 'Correo electrónico (con este inicia sesión)', { type: 'email', required: true })}
          {campo('telefono', 'Teléfono (opcional)', { type: 'tel' })}
          {campo('password', 'Contraseña inicial (mínimo 8 caracteres)', { type: 'password', minLength: 8, required: true })}

          {error && <p style={{ color: '#b3261e' }}>{error}</p>}
          {aviso && <p style={{ color: '#1e7a4c' }}>{aviso}</p>}
          <button className="btn btn-primary">Crear usuario</button>
        </form>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr><th>Nombre</th><th>Cédula</th><th>Correo</th><th>Rol</th>{esAdmin && <th>Cooperativa</th>}<th>Estado</th><th /></tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td>{u.nombres} {u.apellidos}</td>
                <td>{u.cedula}</td>
                <td>{u.email}</td>
                <td>{NOMBRE_ROL[u.rol] || u.rol}</td>
                {esAdmin && <td>{u.cooperativa || '—'}</td>}
                <td>{u.activo ? 'Activo' : 'Inactivo'}</td>
                <td>
                  {u.id !== usuario.id && (
                    <button type="button" className="btn" onClick={() => alternarEstado(u)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && <tr><td colSpan={7} className="text-muted">No hay usuarios.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
