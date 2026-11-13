import { useEffect, useState } from 'react'
import api from '../../services/api.js'

const hoy = () => new Date().toLocaleDateString('en-CA')

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

// Descarga el PDF de un boleto (el oficinista también tiene acceso)
async function descargarBoleto(codigo, alFallar) {
  try {
    const { data } = await api.get(`/boletos/${codigo}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `boleto-${codigo.slice(0, 8)}.pdf`
    enlace.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch {
    alFallar('No se pudo descargar el boleto')
  }
}

// CC-14: venta de boletos en ventanilla (pago en efectivo, boletos emitidos al instante)
export default function VenderBoletos() {
  const [ciudades, setCiudades] = useState([])
  const [descuentos, setDescuentos] = useState([])
  const [busqueda, setBusqueda] = useState({ origen: '', destino: '', fecha: hoy() })
  const [viajes, setViajes] = useState(null)
  const [viaje, setViaje] = useState(null)
  const [asientos, setAsientos] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [venta, setVenta] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/ciudades').then(({ data }) => setCiudades(data)).catch((err) => setError(mensajeDeError(err)))
    api.get('/compras/catalogos').then(({ data }) => setDescuentos(data.tipos_descuento)).catch(() => {})
  }, [])

  const reiniciar = () => {
    setViajes(null)
    setViaje(null)
    setAsientos([])
    setPasajeros([])
    setVenta(null)
    setError('')
  }

  const buscar = async (e) => {
    e.preventDefault()
    reiniciar()
    try {
      const { data } = await api.get('/viajes/buscar', { params: busqueda })
      setViajes(data)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const elegirViaje = async (v) => {
    setError('')
    setPasajeros([])
    setViaje(v)
    try {
      const { data } = await api.get(`/viajes/${v.id}/asientos`, {
        params: { subida: busqueda.origen, bajada: busqueda.destino },
      })
      setAsientos(data)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const alternarAsiento = (asiento) => {
    if (pasajeros.some((p) => p.asiento.id === asiento.id)) {
      setPasajeros(pasajeros.filter((p) => p.asiento.id !== asiento.id))
    } else if (pasajeros.length < 10) {
      setPasajeros([...pasajeros, { asiento, cedula: '', nombre: '', tipo_descuento_id: '' }])
    }
  }

  const cambiarPasajero = (indice, campo, valor) => {
    setPasajeros(pasajeros.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)))
  }

  const vender = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const { data } = await api.post('/compras/ventanilla', {
        viaje_id: viaje.id,
        subida: Number(busqueda.origen),
        bajada: Number(busqueda.destino),
        pasajeros: pasajeros.map((p) => ({
          asiento_id: p.asiento.id,
          cedula: p.cedula.trim(),
          nombre: p.nombre.trim(),
          tipo_descuento_id: p.tipo_descuento_id ? Number(p.tipo_descuento_id) : null,
        })),
      })
      setVenta(data)
    } catch (err) {
      const detalles = err.response?.data?.detalles
      setError(mensajeDeError(err) + (detalles ? ': ' + Object.values(detalles).join(' / ') : ''))
    }
  }

  const total = pasajeros.reduce((suma, p) => suma + Number(p.asiento.precio || 0), 0)

  if (venta) {
    return (
      <div className="container">
        <h1 className="mb-2">Venta registrada</h1>
        <div className="card">
          <div className="card-body">
            <p><strong>Compra N.º {venta.id}</strong> — Total cobrado en efectivo: <strong>${Number(venta.total).toFixed(2)}</strong></p>
            <div className="table-responsive">
              <table className="table">
                <thead><tr><th>Asiento</th><th>Pasajero</th><th>Precio</th><th>Boleto</th></tr></thead>
                <tbody>
                  {venta.boletos.map((b) => (
                    <tr key={b.id}>
                      <td>{b.numero_asiento}</td>
                      <td>{b.pasajero_nombre}</td>
                      <td>${Number(b.precio_final).toFixed(2)}</td>
                      <td>
                        <button type="button" className="btn" onClick={() => descargarBoleto(b.codigo, setError)}>
                          Imprimir boleto (PDF con QR)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p style={{ color: '#b3261e' }}>{error}</p>}
            <button type="button" className="btn btn-primary" onClick={reiniciar}>Nueva venta</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <h1 className="mb-2">Vender boletos</h1>
      <p className="text-muted mb-4">Venta en ventanilla con pago en efectivo. Los boletos quedan emitidos al instante.</p>

      <div className="card">
        <form className="card-body" onSubmit={buscar} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" htmlFor="origen">Origen</label>
            <select id="origen" className="form-control" value={busqueda.origen} required
              onChange={(e) => setBusqueda({ ...busqueda, origen: e.target.value })}>
              <option value="">Elige</option>
              {ciudades.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="destino">Destino</label>
            <select id="destino" className="form-control" value={busqueda.destino} required
              onChange={(e) => setBusqueda({ ...busqueda, destino: e.target.value })}>
              <option value="">Elige</option>
              {ciudades.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="fecha">Fecha</label>
            <input id="fecha" type="date" className="form-control" value={busqueda.fecha} min={hoy()} required
              onChange={(e) => setBusqueda({ ...busqueda, fecha: e.target.value })} />
          </div>
          <button className="btn btn-primary">Buscar viajes</button>
        </form>
      </div>

      {error && <p style={{ color: '#b3261e' }}>{error}</p>}

      {viajes && viajes.length === 0 && <p className="text-muted">No hay viajes para ese tramo y fecha.</p>}
      {viajes && viajes.length > 0 && !viaje && (
        <div className="table-responsive">
          <table className="table">
            <thead><tr><th>Hora</th><th>Cooperativa</th><th>Bus</th><th>Libres</th><th>Desde</th><th /></tr></thead>
            <tbody>
              {viajes.map((v) => (
                <tr key={v.id}>
                  <td>{v.hora_salida?.slice(0, 5)}</td>
                  <td>{v.cooperativa}</td>
                  <td>{v.numero_disco} ({v.placa})</td>
                  <td>{v.asientos_libres}</td>
                  <td>{v.precio_desde != null ? `$${Number(v.precio_desde).toFixed(2)}` : '—'}</td>
                  <td><button type="button" className="btn" onClick={() => elegirViaje(v)}>Elegir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viaje && (
        <div className="card">
          <form className="card-body" onSubmit={vender}>
            <h2 className="h4 mb-2">
              {viaje.origen} → {viaje.destino} — {viaje.fecha} {viaje.hora_salida?.slice(0, 5)} — Bus {viaje.numero_disco}
            </h2>
            <p className="text-muted mb-2">Elige los asientos (hasta 10). Los ocupados en este tramo no se pueden elegir.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {asientos.map((a) => {
                const elegido = pasajeros.some((p) => p.asiento.id === a.id)
                return (
                  <button key={a.id} type="button" disabled={!a.disponible} onClick={() => alternarAsiento(a)}
                    className={elegido ? 'btn btn-primary' : 'btn'}
                    title={`${a.tipo_asiento} — $${Number(a.precio).toFixed(2)}`}
                    style={{ minWidth: 48, opacity: a.disponible ? 1 : 0.35 }}>
                    {a.numero}
                  </button>
                )
              })}
            </div>

            {pasajeros.map((p, i) => (
              <div key={p.asiento.id} className="mb-3" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong style={{ minWidth: 160 }}>Asiento {p.asiento.numero} ({p.asiento.tipo_asiento}) ${Number(p.asiento.precio).toFixed(2)}</strong>
                <input className="form-control" style={{ maxWidth: 160 }} placeholder="Cédula" maxLength={10} required
                  value={p.cedula} onChange={(e) => cambiarPasajero(i, 'cedula', e.target.value)} />
                <input className="form-control" style={{ maxWidth: 240 }} placeholder="Nombre completo" required
                  value={p.nombre} onChange={(e) => cambiarPasajero(i, 'nombre', e.target.value)} />
                <select className="form-control" style={{ maxWidth: 220 }} value={p.tipo_descuento_id}
                  onChange={(e) => cambiarPasajero(i, 'tipo_descuento_id', e.target.value)}>
                  <option value="">Sin descuento</option>
                  {descuentos.map((d) => <option key={d.id} value={d.id}>{d.nombre} ({Number(d.porcentaje)} %)</option>)}
                </select>
              </div>
            ))}

            {pasajeros.length > 0 && (
              <p>Total sin descuentos: <strong>${total.toFixed(2)}</strong>. El total final lo calcula el sistema.</p>
            )}
            <button className="btn btn-primary" disabled={pasajeros.length === 0}>Vender (pago en efectivo)</button>
            <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => { setViaje(null); setPasajeros([]) }}>
              Elegir otro viaje
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
