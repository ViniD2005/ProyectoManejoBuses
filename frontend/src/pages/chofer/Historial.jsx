import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import './Chofer.css'

/*
  GC-34 - Historial de viajes del chofer: por defecto los últimos 30 días.
  Muestra los pasajeros que abordaron, lo vendido a bordo y lo recaudado en efectivo.
*/
const dinero = (n) => `$${Number(n || 0).toFixed(2)}`
const ESTADO = { en_curso: ['En curso', 'insignia--exito'], finalizado: ['Finalizado', ''], programado: ['Programado', 'insignia--info'], cancelado: ['Cancelado', 'insignia--error'] }

export default function Historial() {
  const navegar = useNavigate()
  const [rango, setRango] = useState({ desde: '', hasta: '' })
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  const consultar = useCallback((filtro) => {
    api.get('/chofer/historial', { params: filtro })
      .then(({ data }) => { setDatos(data); setError(''); setRango({ desde: data.desde, hasta: data.hasta }) })
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  useEffect(() => { consultar({}) }, [consultar])

  const buscar = (e) => {
    e.preventDefault()
    if (!rango.desde || !rango.hasta) return setError('Elige las dos fechas')
    if (rango.desde > rango.hasta) return setError('La fecha «desde» no puede ser posterior a «hasta»')
    setError('')
    consultar(rango)
  }

  const hoy = new Date().toLocaleDateString('en-CA')
  const r = datos?.resumen

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Chofer</span>
          <h1>Mi historial de viajes</h1>
          <p>Los viajes que iniciaste, con los pasajeros que abordaron y lo cobrado a bordo.</p>
        </div>
      </div>

      <form className="card" onSubmit={buscar}><div className="card-body fila" style={{ alignItems: 'end' }}>
        <div>
          <label className="form-label" htmlFor="desde">Desde</label>
          <input id="desde" type="date" className="form-control" max={hoy} value={rango.desde} onChange={(e) => setRango({ ...rango, desde: e.target.value })} />
        </div>
        <div>
          <label className="form-label" htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" className="form-control" max={hoy} value={rango.hasta} onChange={(e) => setRango({ ...rango, hasta: e.target.value })} />
        </div>
        <button type="submit" className="btn btn-primary"><Icono nombre="buscar" /> Consultar</button>
      </div></form>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}

      {r && (
        <div className="rejilla-4" style={{ marginBottom: '1.5rem' }}>
          {[['bus', r.viajes, 'Viajes'], ['usuarios', r.pasajeros, 'Pasajeros a bordo'], ['boleto', r.vendidos_a_bordo, 'Vendidos a bordo'], ['dinero', dinero(r.recaudado_a_bordo), 'Recaudado a bordo']].map(([icono, valor, texto]) => (
            <div key={texto} className="indicador">
              <span className="indicador__icono"><Icono nombre={icono} tam={22} /></span>
              <div><div className="indicador__valor">{valor}</div><div className="indicador__texto">{texto}</div></div>
            </div>
          ))}
        </div>
      )}

      {datos?.viajes.length === 0 && (
        <div className="vacio">
          <span className="vacio__icono"><Icono nombre="calendario" tam={26} /></span>
          <h3>No hay viajes en estas fechas</h3>
          <p>Prueba con otro rango.</p>
        </div>
      )}
      {datos?.viajes.length > 0 && (
        <div className="card"><div className="table-responsive"><table className="table">
          <thead><tr><th>Fecha</th><th>Ruta</th><th>Bus</th><th>Pasajeros</th><th>A bordo</th><th>Estado</th><th aria-label="Detalle" /></tr></thead>
          <tbody>
            {datos.viajes.map((v) => {
              const [texto, clase] = ESTADO[v.estado] || [v.estado, '']
              return (
                <tr key={v.id}>
                  <td>{v.fecha}<div className="chofer__dato">{v.hora_salida.slice(0, 5)}</div></td>
                  <td>{v.origen} → {v.destino}{v.observaciones && <div className="chofer__dato">{v.observaciones}</div>}</td>
                  <td>{v.numero_disco}</td>
                  <td>{v.abordados}/{v.boletos}</td>
                  <td>{v.vendidos_a_bordo} · {dinero(v.recaudado_a_bordo)}</td>
                  <td><span className={`insignia ${clase}`}>{texto}</span></td>
                  <td><button type="button" className="btn btn-sm" onClick={() => navegar(`/chofer/viaje/${v.id}`)}>Ver</button></td>
                </tr>
              )
            })}
          </tbody>
        </table></div></div>
      )}
    </div>
  )
}
