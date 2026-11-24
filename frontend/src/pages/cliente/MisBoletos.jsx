import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import IconoBus from './IconoBus.jsx'
import { dinero, fechaLarga, horaEnParada } from './formatos.js'
import './Viajes.css'
import './Compra.css'

const NOMBRE_ESTADO = {
  pendiente: 'Pendiente de pago',
  en_revision: 'Comprobante en revisión',
  aprobado: 'Pago aprobado',
  rechazado: 'Pago rechazado',
}

const NOMBRE_BOLETO = {
  reservado: 'Reservado',
  emitido: 'Listo para viajar',
  usado: 'Usado',
  anulado: 'Anulado',
}

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No pudimos conectarnos con el servidor. Inténtalo de nuevo.'
}

// Formulario para subir el comprobante de una compra pendiente
function FormularioComprobante({ compraId, total, alSubir }) {
  const [archivo, setArchivo] = useState(null)
  const [referencia, setReferencia] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const elegirArchivo = (e) => {
    const elegido = e.target.files[0] || null
    setError('')
    if (elegido && elegido.size > 5 * 1024 * 1024) {
      setError('El archivo pesa más de 5 MB. Elige una imagen más liviana o un PDF.')
      setArchivo(null)
      return
    }
    setArchivo(elegido)
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!archivo) return setError('Adjunta la foto o el PDF del comprobante')
    if (!referencia.trim()) return setError('Escribe el número de referencia que aparece en el comprobante')
    setError('')
    setEnviando(true)
    try {
      const datos = new FormData()
      datos.append('comprobante', archivo)
      datos.append('referencia', referencia.trim())
      await api.post(`/compras/${compraId}/comprobante`, datos)
      alSubir()
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="comprobante" noValidate>
      <h3>Sube tu comprobante de pago por {dinero(total)}</h3>
      <div className="rejilla-campos">
        <label className="subir-archivo">
          <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={elegirArchivo} />
          <span>{archivo ? archivo.name : 'Elegir archivo (JPG, PNG o PDF, máx. 5 MB)'}</span>
        </label>
        <label className="viajes__campo">
          <span>Número de referencia</span>
          <input value={referencia} placeholder="Ej. 004512378" onChange={(e) => setReferencia(e.target.value)} />
        </label>
      </div>
      {error && <p role="alert" className="viajes__error" style={{ margin: 0 }}>{error}</p>}
      <div>
        <button className="viajes__boton" disabled={enviando}>{enviando ? 'Subiendo…' : 'Enviar comprobante'}</button>
      </div>
    </form>
  )
}

// Descarga el boleto en PDF (con su código QR)
async function descargarBoleto(codigo, alFallar) {
  try {
    const { data } = await api.get(`/boletos/${codigo}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `boleto-${codigo.slice(0, 8)}.pdf`
    enlace.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (err) {
    // La respuesta de error también llega como blob: se lee para mostrar el mensaje
    let mensaje = 'No pudimos descargar el boleto. Inténtalo de nuevo.'
    try {
      mensaje = JSON.parse(await err.response.data.text()).mensaje || mensaje
    } catch {
      // se mantiene el mensaje genérico
    }
    alFallar(mensaje)
  }
}

// GC-15: todos los boletos de una compra en un solo PDF (una página por pasajero)
async function descargarTodos(compraId, alFallar) {
  try {
    const { data } = await api.get(`/boletos/compra/${compraId}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(data)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `boletos-compra-${compraId}.pdf`
    enlace.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (err) {
    let mensaje = 'No pudimos descargar los boletos. Inténtalo de nuevo.'
    try {
      mensaje = JSON.parse(await err.response.data.text()).mensaje || mensaje
    } catch {
      // se mantiene el mensaje genérico
    }
    alFallar(mensaje)
  }
}

// Historial de compras y boletos del cliente (rediseño CC-20)
function MisBoletos() {
  const [compras, setCompras] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [filtro, setFiltro] = useState('todas')

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

  const porPagar = compras.filter((c) => c.estado_pago === 'pendiente' || c.estado_pago === 'rechazado').length
  const visibles = compras.filter((c) => filtro === 'todas' || (filtro === 'pagar' ? ['pendiente', 'rechazado'].includes(c.estado_pago) : c.estado_pago === 'aprobado'))

  return (
    <section className="viajes" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1>Mis boletos</h1>
          <p className="viajes__sub" style={{ margin: 0 }}>Tus compras, el estado de cada pago y tus boletos con código QR.</p>
        </div>
        <Link to="/viajes" className="viajes__boton">Comprar un pasaje</Link>
      </div>

      {error && <p role="alert" className="viajes__error">{error}</p>}
      {aviso && <p role="status" className="viajes__aviso">{aviso}</p>}

      {compras.length > 0 && (
        <div className="pisos" role="tablist">
          {[['todas', `Todas (${compras.length})`], ['pagar', `Por pagar (${porPagar})`], ['listas', 'Pagadas']].map(([valor, texto]) => (
            <button key={valor} type="button" role="tab" aria-selected={filtro === valor} onClick={() => setFiltro(valor)}>{texto}</button>
          ))}
        </div>
      )}

      {cargando && [1, 2].map((n) => <div key={n} className="viajes__esqueleto" />)}

      {!cargando && !error && compras.length === 0 && (
        <div className="viajes__vacio">
          <span className="viajes__vacio-icono"><IconoBus /></span>
          <strong>Todavía no tienes compras</strong>
          <span>Cuando compres un pasaje, aquí verás tus boletos.</span>
          <Link to="/viajes" className="viajes__boton" style={{ marginTop: '.5rem' }}>Buscar un viaje</Link>
        </div>
      )}

      {visibles.map((compra) => (
        <article className="viajes__tarjeta compra" key={compra.id}>
          <header className="compra__cabecera">
            <div>
              <h2>{compra.origen} → {compra.destino}</h2>
              <p style={{ textTransform: 'capitalize' }}>
                {fechaLarga(compra.fecha_viaje)} · {horaEnParada(compra.hora_salida)} · {compra.cooperativa}
              </p>
            </div>
            <span className={`estado estado--${compra.estado_pago}`}>{NOMBRE_ESTADO[compra.estado_pago] || compra.estado_pago}</span>
          </header>

          <div className="compra__cuerpo">
            {compra.estado_pago === 'rechazado' && compra.motivo_rechazo && (
              <p className="viajes__error">El pago fue rechazado: {compra.motivo_rechazo}</p>
            )}

            <div className="boletos">
              {compra.boletos.map((b) => (
                <div key={b.id} className="boleto">
                  <span className="boleto__asiento"><span><small>ASIENTO</small>{b.numero_asiento}</span></span>
                  <div>
                    <strong>{b.pasajero_nombre}</strong>
                    <span>{NOMBRE_BOLETO[b.estado] || b.estado} · {dinero(b.precio_final)}</span>
                  </div>
                  {(b.estado === 'emitido' || b.estado === 'usado') ? (
                    <button type="button" className="viajes__boton viajes__boton--claro" onClick={() => descargarBoleto(b.codigo, setError)}>
                      Descargar boleto
                    </button>
                  ) : <span />}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '.75rem', marginTop: '1rem', color: 'var(--v-suave)', fontSize: '.88rem', fontWeight: 600 }}>
              <span>Compra N.º {compra.id} · {compra.metodo_pago}</span>
              <span>Total <strong style={{ color: 'var(--v-texto)', fontSize: '1.05rem' }}>{dinero(compra.total)}</strong></span>
            </div>

            {compra.boletos.some((b) => b.estado === 'emitido' || b.estado === 'usado') && (
              <div className="descargar-todos">
                <span>✓ Tus boletos están listos. Cada pasajero presenta su propio código QR al abordar.</span>
                <button type="button" className="viajes__boton" onClick={() => descargarTodos(compra.id, setError)}>
                  Descargar {compra.boletos.length > 1 ? `los ${compra.boletos.length} boletos` : 'el boleto'}
                </button>
              </div>
            )}

            {compra.estado_pago === 'pendiente' && compra.requiere_comprobante && (
              <FormularioComprobante compraId={compra.id} total={compra.total} alSubir={comprobanteSubido} />
            )}
            {compra.comprobante_url && (
              <p style={{ margin: '1rem 0 0' }}><a href={compra.comprobante_url} target="_blank" rel="noreferrer">Ver el comprobante enviado</a></p>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}

export default MisBoletos
