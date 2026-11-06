import { useEffect, useState } from 'react'
import api from '../../services/api.js'

const PESTANAS = [
  { estado: 'en_revision', texto: 'Por validar' },
  { estado: 'aprobado', texto: 'Aprobados' },
  { estado: 'rechazado', texto: 'Rechazados' },
]

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

export default function ValidarPagos() {
  const [estado, setEstado] = useState('en_revision')
  const [compras, setCompras] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = (estadoElegido) =>
    api.get('/pagos', { params: { estado: estadoElegido } })
      .then(({ data }) => setCompras(data))
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar(estado)
  }, [estado])

  const cambiarPestana = (nuevo) => {
    setError('')
    setAviso('')
    setCargando(true)
    setEstado(nuevo)
  }

  const validar = async (compra, aprobado) => {
    let motivo = ''
    if (!aprobado) {
      motivo = window.prompt(`Motivo del rechazo de la compra N.º ${compra.id}:`) || ''
      if (!motivo.trim()) return
    } else if (!window.confirm(`¿Aprobar el pago de la compra N.º ${compra.id} por $${Number(compra.total).toFixed(2)}?`)) {
      return
    }
    setError('')
    try {
      await api.patch(`/pagos/${compra.id}/validar`, { aprobado, motivo })
      setAviso(aprobado
        ? `Compra N.º ${compra.id} aprobada: los boletos quedaron emitidos.`
        : `Compra N.º ${compra.id} rechazada: los asientos quedaron libres.`)
      cargar(estado)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  return (
    <div className="container">
      <h1 className="mb-2">Validar pagos</h1>
      <p className="text-muted mb-4">
        Revisa los comprobantes de transferencia o depósito. Verifica el monto, la referencia y,
        si hay descuento por discapacidad, el carné del pasajero.
      </p>

      <div className="mb-3">
        {PESTANAS.map((p) => (
          <button key={p.estado} type="button"
            className={p.estado === estado ? 'btn btn-primary' : 'btn'}
            style={{ marginRight: 8 }}
            onClick={() => cambiarPestana(p.estado)}>
            {p.texto}
          </button>
        ))}
      </div>

      {cargando && <p>Cargando…</p>}
      {error && <p style={{ color: '#b3261e' }}>{error}</p>}
      {aviso && <p style={{ color: '#1e7a4c' }}>{aviso}</p>}
      {!cargando && compras.length === 0 && <p className="text-muted">No hay compras en este estado.</p>}

      {compras.map((compra) => (
        <div className="card" key={compra.id}>
          <div className="card-body">
            <h2 className="h4 mb-2">Compra N.º {compra.id} — ${Number(compra.total).toFixed(2)}</h2>
            <p className="mb-2">
              {compra.origen} → {compra.destino}, {compra.fecha_viaje} a las {compra.hora_salida?.slice(0, 5)}
            </p>
            <p className="mb-2">
              Cliente: {compra.cliente} ({compra.cliente_cedula}, {compra.cliente_email})
            </p>
            <p className="mb-2">
              {compra.metodo_pago} — referencia: <strong>{compra.referencia_bancaria || 'sin referencia'}</strong>
              {compra.comprobante_url && (
                <> — <a href={compra.comprobante_url} target="_blank" rel="noreferrer">Ver comprobante</a></>
              )}
            </p>

            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr><th>Asiento</th><th>Pasajero</th><th>Cédula</th><th>Descuento</th><th>Precio</th><th>Boleto</th></tr>
                </thead>
                <tbody>
                  {compra.boletos.map((b) => (
                    <tr key={b.numero_asiento}>
                      <td>{b.numero_asiento}</td>
                      <td>{b.pasajero_nombre}</td>
                      <td>{b.pasajero_cedula}</td>
                      <td>{b.descuento || '—'}</td>
                      <td>${Number(b.precio_final).toFixed(2)}</td>
                      <td>{b.estado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {compra.motivo_rechazo && <p style={{ color: '#b3261e' }}>Motivo del rechazo: {compra.motivo_rechazo}</p>}

            {compra.estado_pago === 'en_revision' && (
              <div>
                <button type="button" className="btn btn-primary" onClick={() => validar(compra, true)}>Aprobar pago</button>
                <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => validar(compra, false)}>Rechazar</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
