import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

/*
  GC-31: las compras se ordenan en tres pestañas, como en una app de viajes real:
    · Próximos viajes → pagadas y con viaje de hoy en adelante
    · Por pagar       → pendientes, en revisión o rechazadas (con viaje de hoy en adelante)
    · Historial       → viajes que ya pasaron y reservas vencidas
*/
// "viernes, 27 de noviembre" -> "Viernes, 27 de noviembre" (sin poner en mayúscula el "de")
const mayusculaInicial = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)
const hoyEcuador = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
const esVencida = (c) => c.estado_pago === 'rechazado' && /^reserva vencida/i.test(c.motivo_rechazo || '')
function grupoDe(compra, hoy) {
  if (compra.fecha_viaje < hoy || esVencida(compra)) return 'historial'
  return compra.estado_pago === 'aprobado' ? 'proximos' : 'pagar'
}
const PESTANAS = [['proximos', 'Próximos viajes'], ['pagar', 'Por pagar'], ['historial', 'Historial']]
const VACIO_PESTANA = {
  proximos: ['No tienes viajes próximos', 'Cuando un pago sea aprobado, tus boletos aparecerán aquí.'],
  pagar: ['No tienes pagos pendientes', 'Todo está al día.'],
  historial: ['Tu historial está vacío', 'Aquí verás los viajes que ya realizaste.'],
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
  const [pestana, setPestana] = useState(null) // null = se elige sola al cargar
  const navegar = useNavigate()

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

  const hoy = hoyEcuador()
  const conteo = { proximos: 0, pagar: 0, historial: 0 }
  compras.forEach((c) => { conteo[grupoDe(c, hoy)] += 1 })
  // Si hay algo por pagar se abre esa pestaña primero
  const activa = pestana || (conteo.pagar > 0 ? 'pagar' : 'proximos')
  const visibles = compras
    .filter((c) => grupoDe(c, hoy) === activa)
    .sort((a, b) => (activa === 'historial' ? b.fecha_viaje.localeCompare(a.fecha_viaje) : a.fecha_viaje.localeCompare(b.fecha_viaje)))

  return (
    <section className="viajes" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1>Mis boletos</h1>
          <p className="viajes__sub" style={{ margin: 0 }}>Tus compras, el estado de cada pago y tus boletos con código QR.</p>
        </div>
        <button type="button" className="viajes__boton" onClick={() => navegar('/viajes')}>Comprar un pasaje</button>
      </div>

      {error && <p role="alert" className="viajes__error">{error}</p>}
      {aviso && <p role="status" className="viajes__aviso">{aviso}</p>}

      {compras.length > 0 && (
        <div className="pisos" role="tablist" aria-label="Mis compras">
          {PESTANAS.map(([valor, texto]) => (
            <button key={valor} type="button" role="tab" aria-selected={activa === valor} onClick={() => setPestana(valor)}>
              {texto} ({conteo[valor]})
            </button>
          ))}
        </div>
      )}

      {!cargando && compras.length > 0 && visibles.length === 0 && (
        <div className="viajes__vacio">
          <strong>{VACIO_PESTANA[activa][0]}</strong>
          <span>{VACIO_PESTANA[activa][1]}</span>
        </div>
      )}

      {cargando && [1, 2].map((n) => <div key={n} className="viajes__esqueleto" />)}

      {!cargando && !error && compras.length === 0 && (
        <div className="viajes__vacio">
          <span className="viajes__vacio-icono"><IconoBus /></span>
          <strong>Todavía no tienes compras</strong>
          <span>Cuando compres un pasaje, aquí verás tus boletos.</span>
          <button type="button" className="viajes__boton" style={{ marginTop: '.5rem' }} onClick={() => navegar('/viajes')}>Buscar un viaje</button>
        </div>
      )}

      {visibles.map((compra) => (
        <article className="viajes__tarjeta compra" key={compra.id}>
          <header className="compra__cabecera">
            <div>
              <h2>{compra.origen} → {compra.destino}</h2>
              <p>
                {mayusculaInicial(fechaLarga(compra.fecha_viaje))} · {horaEnParada(compra.hora_salida)} · {compra.cooperativa}
              </p>
            </div>
            <span className={`estado estado--${compra.estado_pago}`}>{esVencida(compra) ? 'Reserva vencida' : NOMBRE_ESTADO[compra.estado_pago] || compra.estado_pago}</span>
          </header>

          <div className="compra__cuerpo">
            {esVencida(compra) ? (
              <p className="viajes__error">La reserva venció porque no se pagó a tiempo y los asientos se liberaron. Puedes comprar de nuevo si aún hay cupo.</p>
            ) : compra.estado_pago === 'rechazado' && compra.motivo_rechazo && (
              <p className="viajes__error">El pago fue rechazado: {compra.motivo_rechazo}</p>
            )}
            {compra.estado_pago === 'en_revision' && (
              <p className="viajes__aviso">Recibimos tu comprobante. Un oficinista lo está revisando; te avisaremos cuando tus boletos estén listos.</p>
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
