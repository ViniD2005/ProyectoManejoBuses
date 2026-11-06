			import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import './Viajes.css'

const NOMBRE_ESTADO = {
  pendiente: 'Pendiente de pago',
  en_revision: 'Comprobante en revisión',
  aprobado: 'Pago aprobado',
  rechazado: 'Pago rechazado',
}

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

// Formulario para subir el comprobante de una compra pendiente
function FormularioComprobante({ compraId, alSubir }) {
  const [archivo, setArchivo] = useState(null)
  const [referencia, setReferencia] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      const datos = new FormData()
      datos.append('comprobante', archivo)
      datos.append('referencia', referencia)
      await api.post(`/compras/${compraId}/comprobante`, datos)
      alSubir()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="viajes__formulario">
      <label>
        Comprobante (JPG, PNG o PDF, máximo 5 MB)
        <input type="file" accept="image/jpeg,image/png,application/pdf" required
          onChange={(e) => setArchivo(e.target.files[0] || null)} />
      </label>
      <label>
        Número de referencia
        <input value={referencia} required onChange={(e) => setReferencia(e.target.value)} />
      </label>
      <div>
        <button disabled={enviando}>{enviando ? 'Subiendo…' : 'Subir comprobante'}</button>
        {error && <p role="alert" className="viajes__error">{error}</p>}
      </div>
    </form>
  )
}

function MisBoletos() {
  const [compras, setCompras] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = () =>
    api.get('/compras/mias')
      .then(({ data }) => setCompras(data))
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargar()
  }, [])

  const comprobanteSubido = () => {
    setAviso('Comprobante enviado. Un oficinista lo revisará y te avisaremos cuando tus boletos estén emitidos.')
    cargar()
  }

  return (
    <section className="viajes">
      <h1>Mis boletos</h1>
      {cargando && <p>Cargando tus compras…</p>}
      {error && <p role="alert" className="viajes__error">{error}</p>}
      {aviso && <p role="status">{aviso}</p>}

      {!cargando && !error && compras.length === 0 && (
        <p>Todavía no tienes compras. <Link to="/viajes">Busca un viaje</Link></p>
      )}

      {compras.map((compra) => (
        <article className="viajes__tarjeta" key={compra.id}>
          <h2>{compra.origen} → {compra.destino}</h2>
          <p>
            {compra.fecha_viaje}, salida {compra.hora_salida?.slice(0, 5)} — {compra.cooperativa}
          </p>
          <p>
            Compra N.º {compra.id} — Total ${Number(compra.total).toFixed(2)} — {compra.metodo_pago}
          </p>
          <p><strong>{NOMBRE_ESTADO[compra.estado_pago] || compra.estado_pago}</strong></p>
          {compra.estado_pago === 'rechazado' && compra.motivo_rechazo && (
            <p className="viajes__error">Motivo: {compra.motivo_rechazo}</p>
          )}

          <ul>
            {compra.boletos.map((b) => (
              <li key={b.id}>
                Asiento {b.numero_asiento} — {b.pasajero_nombre} — ${Number(b.precio_final).toFixed(2)} — boleto {b.estado}
              </li>
            ))}
          </ul>

          {compra.estado_pago === 'pendiente' && compra.requiere_comprobante && (
            <FormularioComprobante compraId={compra.id} alSubir={comprobanteSubido} />
          )}
          {compra.comprobante_url && (
            <p><a href={compra.comprobante_url} target="_blank" rel="noreferrer">Ver comprobante enviado</a></p>
          )}
        </article>
      ))}
    </section>
  )
}

export default MisBoletos
