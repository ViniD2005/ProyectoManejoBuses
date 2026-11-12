import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import api from '../../services/api.js'

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

// CC-15: el chofer o ayudante registra el abordaje escaneando el QR del boleto
export default function Abordaje() {
  const [viajes, setViajes] = useState([])
  const [viajeId, setViajeId] = useState('')
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState(null)
  const [camaraActiva, setCamaraActiva] = useState(false)
  const [error, setError] = useState('')
  const lector = useRef(null)
  const ultimoCodigo = useRef({ codigo: '', momento: 0 })
  const viajeActual = useRef('')

  const cargarViajes = () =>
    api.get('/accesos/viajes-hoy')
      .then(({ data }) => setViajes(data))
      .catch((err) => setError(mensajeDeError(err)))

  useEffect(() => {
    cargarViajes()
    // Al salir de la pantalla se apaga la cámara
    return () => {
      if (lector.current?.isScanning) lector.current.stop().catch(() => {})
    }
  }, [])

  const elegirViaje = (id) => {
    setViajeId(id)
    viajeActual.current = id
  }

  const registrar = async (texto) => {
    setError('')
    try {
      const { data } = await api.post('/accesos', { codigo: texto, viaje_id: viajeActual.current || undefined })
      setResultado({ ok: true, ...data })
      cargarViajes()
    } catch (err) {
      setResultado({ ok: false, mensaje: mensajeDeError(err) })
    }
  }

  const activarCamara = async () => {
    setError('')
    try {
      lector.current = new Html5Qrcode('lector-qr')
      await lector.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220 },
        (texto) => {
          // Evita registrar el mismo código varias veces seguidas mientras sigue frente a la cámara
          const ahora = Date.now()
          if (texto === ultimoCodigo.current.codigo && ahora - ultimoCodigo.current.momento < 5000) return
          ultimoCodigo.current = { codigo: texto, momento: ahora }
          registrar(texto)
        },
        () => {}
      )
      setCamaraActiva(true)
    } catch {
      setError('No se pudo abrir la cámara. Revisa los permisos del navegador o ingresa el código a mano.')
    }
  }

  const apagarCamara = async () => {
    if (lector.current?.isScanning) await lector.current.stop().catch(() => {})
    setCamaraActiva(false)
  }

  const enviarManual = (e) => {
    e.preventDefault()
    if (codigo.trim()) registrar(codigo.trim())
    setCodigo('')
  }

  return (
    <div className="container">
      <h1 className="mb-2">Registro de abordaje</h1>
      <p className="text-muted mb-4">Escanea el código QR del boleto de cada pasajero al subir al bus.</p>

      <div className="mb-3">
        <label className="form-label" htmlFor="viaje">Viaje de hoy</label>
        <select id="viaje" className="form-control" value={viajeId} onChange={(e) => elegirViaje(e.target.value)}>
          <option value="">Todos los viajes de hoy de la cooperativa</option>
          {viajes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.hora_salida.slice(0, 5)} — {v.origen} → {v.destino} — Bus {v.numero_disco} — {v.abordados}/{v.boletos_emitidos} abordados
            </option>
          ))}
        </select>
        {viajes.length === 0 && <small className="text-muted">No hay viajes programados hoy.</small>}
      </div>

      <div className="card">
        <div className="card-body">
          <div id="lector-qr" style={{ width: '100%', maxWidth: 360 }} />
          {!camaraActiva
            ? <button type="button" className="btn btn-primary" onClick={activarCamara}>Activar cámara</button>
            : <button type="button" className="btn" onClick={apagarCamara}>Apagar cámara</button>}

          <form onSubmit={enviarManual} style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="form-control" style={{ maxWidth: 380 }} placeholder="O escribe el código del boleto"
              value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button className="btn">Registrar</button>
          </form>
        </div>
      </div>

      {error && <p style={{ color: '#b3261e' }}>{error}</p>}

      {resultado && (
        <div className="card" style={{ borderLeft: `6px solid ${resultado.ok ? '#1e7a4c' : '#b3261e'}` }}>
          <div className="card-body">
            {resultado.ok ? (
              <>
                <h2 className="h4" style={{ color: '#1e7a4c' }}>✔ {resultado.mensaje}</h2>
                <p>{resultado.pasajero} ({resultado.cedula}) — Asiento {resultado.asiento} — {resultado.tramo}</p>
              </>
            ) : (
              <h2 className="h4" style={{ color: '#b3261e' }}>✘ {resultado.mensaje}</h2>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
