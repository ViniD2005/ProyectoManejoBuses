import { useEffect, useState } from 'react'
import api from '../services/api.js'

const FORM_VACIO = {
  numero_disco: '',
  placa: '',
  marca_chasis: '',
  marca_carroceria: '',
  anio_fabricacion: '',
  pisos: 1,
  cantidad_asientos: 40,
  tipo_asiento_id: '',
}

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

export default function Buses() {
  const [buses, setBuses] = useState([])
  const [tipos, setTipos] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [idEdicion, setIdEdicion] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargarBuses = () =>
    api.get('/buses')
      .then(({ data }) => setBuses(data))
      .catch((err) => setError(mensajeDeError(err)))

  useEffect(() => {
    cargarBuses()
    api.get('/tipos-asiento')
      .then(({ data }) => setTipos(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  const cambiar = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const limpiar = () => {
    setForm(FORM_VACIO)
    setIdEdicion(null)
    setErrores({})
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    setErrores({})
    try {
      if (idEdicion) {
        await api.put(`/buses/${idEdicion}`, form)
        setAviso('Bus actualizado correctamente')
      } else {
        const { data } = await api.post('/buses', form)
        setAviso(`Bus registrado con ${data.total_asientos} asientos`)
      }
      limpiar()
      cargarBuses()
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    }
  }

  const editar = (bus) => {
    setIdEdicion(bus.id)
    setForm({ ...FORM_VACIO, ...bus, anio_fabricacion: bus.anio_fabricacion || '' })
    setAviso('')
  }

  const alternarEstado = async (bus) => {
    try {
      await api.patch(`/buses/${bus.id}/estado`, { activo: !bus.activo })
      cargarBuses()
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
      <h1 className="mb-2">Buses</h1>
      <p className="text-muted mb-4">Registra los buses de tu cooperativa. Al crear un bus se generan sus asientos.</p>

      <div className="card">
        <form className="card-body" onSubmit={guardar}>
          <h2 className="h4 mb-3">{idEdicion ? 'Editar bus' : 'Registrar bus'}</h2>
          {campo('numero_disco', 'Número de disco', { required: true })}
          {campo('placa', 'Placa', { required: true, placeholder: 'ABC-1234' })}
          {campo('marca_chasis', 'Marca del chasis', { required: true, placeholder: 'Mercedes-Benz' })}
          {campo('marca_carroceria', 'Marca de la carrocería', { required: true, placeholder: 'Olímpica' })}
          {campo('anio_fabricacion', 'Año de fabricación', { type: 'number', min: 1990, max: 2030 })}

          <div className="mb-3">
            <label className="form-label" htmlFor="pisos">Pisos</label>
            <select id="pisos" name="pisos" className="form-control" value={form.pisos} onChange={cambiar}>
              <option value={1}>1 piso</option>
              <option value={2}>2 pisos</option>
            </select>
          </div>

          {!idEdicion && (
            <>
              {campo('cantidad_asientos', 'Cantidad de asientos', { type: 'number', min: 1, max: 80, required: true })}
              <div className="mb-3">
                <label className="form-label" htmlFor="tipo_asiento_id">Tipo de asiento por defecto</label>
                <select id="tipo_asiento_id" name="tipo_asiento_id" className="form-control"
                  value={form.tipo_asiento_id} onChange={cambiar} required>
                  <option value="">Elige un tipo</option>
                  {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
                {errores.tipo_asiento_id && <small style={{ color: '#b3261e' }}>{errores.tipo_asiento_id}</small>}
              </div>
            </>
          )}

          {error && <p style={{ color: '#b3261e' }}>{error}</p>}
          {aviso && <p style={{ color: '#1e7a4c' }}>{aviso}</p>}

          <button className="btn btn-primary">{idEdicion ? 'Guardar cambios' : 'Registrar bus'}</button>
          {idEdicion && (
            <button type="button" className="btn" onClick={limpiar} style={{ marginLeft: 8 }}>Cancelar</button>
          )}
        </form>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Disco</th><th>Placa</th><th>Chasis</th><th>Carrocería</th>
              <th>Pisos</th><th>Asientos</th><th>Estado</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {buses.map((bus) => (
              <tr key={bus.id}>
                <td>{bus.numero_disco}</td>
                <td>{bus.placa}</td>
                <td>{bus.marca_chasis}</td>
                <td>{bus.marca_carroceria}</td>
                <td>{bus.pisos}</td>
                <td>{bus.total_asientos}</td>
                <td>{bus.activo ? 'Activo' : 'Inactivo'}</td>
                <td>
                  <button type="button" className="btn" onClick={() => editar(bus)}>Editar</button>
                  <button type="button" className="btn" onClick={() => alternarEstado(bus)} style={{ marginLeft: 6 }}>
                    {bus.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
            {buses.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted">No hay buses registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
