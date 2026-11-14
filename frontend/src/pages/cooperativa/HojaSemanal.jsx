import { useEffect, useState } from 'react'
import api from '../../services/api.js'

const COLORES = ['#e3f2fd', '#e8f5e9', '#fff3e0', '#f3e5f5', '#e0f7fa', '#fce4ec', '#f1f8e9', '#ede7f6']
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const hoy = () => new Date().toLocaleDateString('en-CA')

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

function encabezado(fecha) {
  const d = new Date(`${fecha}T12:00:00`)
  return { dia: NOMBRES_DIA[d.getDay()], fecha: `${d.getDate()}-${d.toLocaleString('es-EC', { month: 'short' })}` }
}

// CC-13: hoja de ruta semanal (filas: buses, columnas: días) con rotación de turnos
export default function HojaSemanal() {
  const [desde, setDesde] = useState(hoy)
  const [semana, setSemana] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    api.get('/turnos/semana', { params: { desde } })
      .then(({ data }) => setSemana(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [desde])

  const cambiarFecha = (e) => {
    setError('')
    setAviso('')
    setAvisos([])
    setDesde(e.target.value)
  }

  const generar = async () => {
    if (!window.confirm(`¿Generar la hoja de ruta del ${desde} al ${semana?.hasta || ''} con rotación de turnos?`)) return
    setError('')
    setAviso('')
    try {
      const { data } = await api.post('/turnos/generar-semana', { desde })
      setSemana(data)
      setAvisos(data.avisos || [])
      setAviso('Semana generada. Los turnos rotan cada día y los buses sobrantes quedan en día de parada (P).')
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  return (
    <div className="container" style={{ maxWidth: 'none' }}>
      <h1 className="mb-2">Hoja de ruta semanal</h1>
      <p className="text-muted mb-3">
        Una fila por bus y una columna por día. Cada celda muestra las salidas del turno asignado, o <strong>P</strong> si
        el bus está en día de parada. Los cambios manuales de un día se hacen en <em>Hojas de ruta</em>.
      </p>

      <div className="mb-3" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="form-label" htmlFor="desde">Semana desde</label>
          <input id="desde" type="date" className="form-control" value={desde} onChange={cambiarFecha} />
        </div>
        <button type="button" className="btn btn-primary" onClick={generar}>Generar semana con rotación</button>
        <button type="button" className="btn" onClick={() => window.print()}>Imprimir</button>
      </div>

      {error && <p style={{ color: '#b3261e' }}>{error}</p>}
      {aviso && <p style={{ color: '#1e7a4c' }}>{aviso}</p>}
      {avisos.map((a) => <p key={a} style={{ color: '#8a5a00' }}>⚠ {a}</p>)}
      {!semana && !error && <p>Cargando…</p>}

      {semana && (
        <div className="table-responsive">
          <table className="table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Disco</th>
                {semana.dias.map((fecha) => {
                  const e = encabezado(fecha)
                  return <th key={fecha} style={{ textAlign: 'center' }}>{e.dia}<br /><small>{e.fecha}</small></th>
                })}
              </tr>
            </thead>
            <tbody>
              {semana.filas.map((fila) => (
                <tr key={fila.bus.id}>
                  <td><strong>{fila.bus.numero_disco}</strong><br /><small>{fila.bus.placa}</small></td>
                  {fila.dias.map((celda) => (
                    <td key={celda.fecha} style={{
                      textAlign: 'center',
                      background: celda.parada ? '#f5f5f5' : COLORES[((celda.turno_orden || 1) - 1) % COLORES.length],
                    }}>
                      {celda.parada
                        ? <strong style={{ color: '#b3261e' }}>P</strong>
                        : (
                          <>
                            {celda.turno && <small><strong>{celda.turno}</strong><br /></small>}
                            {celda.viajes.map((v) => (
                              <div key={`${v.hora}-${v.origen}`}>{v.origen} → {v.destino} {v.hora}</div>
                            ))}
                          </>
                        )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
