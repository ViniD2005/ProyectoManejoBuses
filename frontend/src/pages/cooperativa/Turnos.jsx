import { useEffect, useState } from 'react'
import api from '../../services/api.js'

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

const FORM_VACIO = { nombre: '', frecuencias: [] }

// CC-13: un turno agrupa las frecuencias que un mismo bus hace en un día
export default function Turnos() {
  const [datos, setDatos] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [idEdicion, setIdEdicion] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    api.get('/turnos')
      .then(({ data }) => setDatos(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  // Frecuencias que se pueden elegir: las libres y las del turno que se edita
  const disponibles = datos
    ? [
        ...datos.frecuencias_sin_turno,
        ...(idEdicion ? datos.turnos.find((t) => t.id === idEdicion)?.frecuencias || [] : []),
      ].sort((a, b) => a.hora_salida.localeCompare(b.hora_salida))
    : []

  const alternarFrecuencia = (id) => {
    setForm({
      ...form,
      frecuencias: form.frecuencias.includes(id)
        ? form.frecuencias.filter((f) => f !== id)
        : [...form.frecuencias, id],
    })
  }

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
      const { data } = idEdicion
        ? await api.put(`/turnos/${idEdicion}`, form)
        : await api.post('/turnos', form)
      setDatos(data)
      setAviso(idEdicion ? 'Turno actualizado' : 'Turno creado')
      limpiar()
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    }
  }

  const editar = (turno) => {
    setIdEdicion(turno.id)
    setForm({ nombre: turno.nombre, frecuencias: turno.frecuencias.map((f) => f.id) })
    setAviso('')
  }

  const eliminar = async (turno) => {
    if (!window.confirm(`¿Eliminar ${turno.nombre}? Sus frecuencias quedarán sin turno.`)) return
    try {
      const { data } = await api.delete(`/turnos/${turno.id}`)
      setDatos(data)
      setAviso('Turno eliminado')
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  if (!datos) return <div className="container"><p>{error || 'Cargando…'}</p></div>

  return (
    <div className="container">
      <h1 className="mb-2">Turnos</h1>
      <p className="text-muted mb-4">
        Un turno agrupa las frecuencias que un mismo bus hace en un día (por ejemplo, la ida y el regreso).
        Los turnos rotan cada día entre los buses. Tienes {datos.total_buses} buses activos y {datos.turnos.length} turnos:
        cada día {datos.dias_parada_por_dia} bus(es) quedan en día de parada.
      </p>

      <div className="card">
        <form className="card-body" onSubmit={guardar}>
          <h2 className="h4 mb-3">{idEdicion ? 'Editar turno' : 'Nuevo turno'}</h2>
          <div className="mb-3">
            <label className="form-label" htmlFor="nombre">Nombre</label>
            <input id="nombre" className="form-control" value={form.nombre} placeholder="Turno 3"
              onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            {errores.nombre && <small style={{ color: '#b3261e' }}>{errores.nombre}</small>}
          </div>

          <p className="form-label">Frecuencias del turno (las hace el mismo bus, en orden de hora)</p>
          {disponibles.length === 0 && <p className="text-muted">No hay frecuencias libres. Todas pertenecen a algún turno.</p>}
          {disponibles.map((f) => (
            <label key={f.id} style={{ display: 'block', marginBottom: 6 }}>
              <input type="checkbox" checked={form.frecuencias.includes(f.id)} onChange={() => alternarFrecuencia(f.id)} />
              {' '}{f.hora_salida.slice(0, 5)} — {f.origen} → {f.destino}
            </label>
          ))}
          {errores.frecuencias && <p style={{ color: '#b3261e' }}>{errores.frecuencias}</p>}

          {error && <p style={{ color: '#b3261e' }}>{error}</p>}
          {aviso && <p style={{ color: '#1e7a4c' }}>{aviso}</p>}
          <button className="btn btn-primary">{idEdicion ? 'Guardar cambios' : 'Crear turno'}</button>
          {idEdicion && <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={limpiar}>Cancelar</button>}
        </form>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr><th>Orden</th><th>Turno</th><th>Frecuencias</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {datos.turnos.map((t) => (
              <tr key={t.id}>
                <td>{t.orden}</td>
                <td>{t.nombre}</td>
                <td>{t.frecuencias.map((f) => `${f.hora_salida.slice(0, 5)} ${f.origen} → ${f.destino}`).join(' · ')}</td>
                <td>
                  <button type="button" className="btn" onClick={() => editar(t)}>Editar</button>
                  <button type="button" className="btn" style={{ marginLeft: 6 }} onClick={() => eliminar(t)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {datos.turnos.length === 0 && <tr><td colSpan={4} className="text-muted">Todavía no hay turnos.</td></tr>}
          </tbody>
        </table>
      </div>

      {datos.frecuencias_sin_turno.length > 0 && (
        <p className="text-muted">
          Frecuencias activas sin turno (no se asignan en la hoja semanal):{' '}
          {datos.frecuencias_sin_turno.map((f) => `${f.hora_salida.slice(0, 5)} ${f.origen} → ${f.destino}`).join(', ')}
        </p>
      )}
    </div>
  )
}
