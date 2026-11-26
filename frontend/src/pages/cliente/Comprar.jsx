import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import CuentaBancaria from '../../components/CuentaBancaria.jsx'
import { dinero, fechaLarga, horaEnParada } from './formatos.js'
import './Viajes.css'
import './Compra.css'

// Datos bancarios por defecto si la configuración no tiene cuenta registrada
const DESCUENTOS_POR_EDAD = ['tercera_edad', 'menor_edad']

function leerSeleccion() {
  try {
    return JSON.parse(sessionStorage.getItem('compraPendiente'))
  } catch {
    return null
  }
}

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No pudimos conectarnos con el servidor. Inténtalo de nuevo.'
}

// Revisión rápida en el navegador; el servidor valida la cédula completa (CC-21)
function revisarPasajero(p, necesitaFecha) {
  const errores = {}
  const cedula = p.cedula.trim()
  if (!cedula) errores.cedula = 'Escribe la cédula del pasajero'
  else if (!/^\d{10}$/.test(cedula)) errores.cedula = 'La cédula debe tener exactamente 10 dígitos'
  const nombre = p.nombre.trim().replace(/\s+/g, ' ')
  if (!nombre) errores.nombre = 'Escribe el nombre completo del pasajero'
  else if (!nombre.includes(' ')) errores.nombre = 'Escribe nombre y apellido del pasajero'
  else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]+$/.test(nombre)) errores.nombre = 'El nombre solo puede contener letras y espacios'
  if (necesitaFecha && !p.fecha_nacimiento) errores.fecha_nacimiento = 'Ingresa la fecha de nacimiento para aplicar este descuento'
  return errores
}

const ETAPAS = ['Asientos', 'Pasajeros', 'Pago', 'Listo']

function Etapas({ actual }) {
  return (
    <ol className="etapas">
      {ETAPAS.map((texto, i) => (
        <li key={texto} className={i < actual ? 'hecha' : i === actual ? 'actual' : ''}>
          <b>{i < actual ? '✓' : i + 1}</b> {texto}
        </li>
      ))}
    </ol>
  )
}

/*
  Compra de boletos (GC-15):
  - Pasajero 1: casilla "Viajo yo en este asiento" (como "la factura va con los mismos datos")
  - Al escribir una cédula registrada se precarga el nombre
  - Se puede repetir la cédula (una persona puede comprar dos asientos para ella)
  - Descuentos por edad: si el pasajero no tiene cuenta, se pide su fecha de nacimiento
  - El comprobante se sube en el mismo flujo, antes de terminar
*/
function Comprar() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [seleccion] = useState(leerSeleccion)
  const [viaje, setViaje] = useState(null)
  const [catalogos, setCatalogos] = useState({ metodos_pago: [], tipos_descuento: [] })
  const [viajoYo, setViajoYo] = useState(Boolean(usuario))
  const [pasajeros, setPasajeros] = useState(() =>
    (seleccion?.asientos || []).map((asiento, i) => ({
      asiento_id: asiento.id,
      cedula: i === 0 ? usuario?.cedula || '' : '',
      nombre: i === 0 ? `${usuario?.nombres || ''} ${usuario?.apellidos || ''}`.trim() : '',
      tipo_descuento_id: '',
      fecha_nacimiento: '',
    }))
  )
  // Pasajeros encontrados por cédula: { indice: { registrado, nombre, tiene_fecha_nacimiento } }
  const [registrados, setRegistrados] = useState({})
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [error, setError] = useState('')
  const [erroresPasajeros, setErroresPasajeros] = useState([])
  const [errorMetodo, setErrorMetodo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [compra, setCompra] = useState(null)
  const [comprobanteEnviado, setComprobanteEnviado] = useState(false)

  useEffect(() => {
    if (!seleccion) return
    api.get(`/viajes/${seleccion.viaje_id}`, { params: { subida: seleccion.subida, bajada: seleccion.bajada } })
      .then(({ data }) => setViaje(data))
      .catch((err) => setError(mensajeDeError(err)))
    api.get('/compras/catalogos')
      .then(({ data }) => setCatalogos(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [seleccion])

  const tipoDescuento = (id) => catalogos.tipos_descuento.find((t) => String(t.id) === String(id))
  const esElUsuario = (i) => i === 0 && viajoYo && usuario
  // ¿Hace falta pedir la fecha de nacimiento para el descuento elegido?
  const necesitaFecha = (p, i) => {
    const tipo = tipoDescuento(p.tipo_descuento_id)
    if (!tipo || !DESCUENTOS_POR_EDAD.includes(tipo.codigo)) return false
    if (esElUsuario(i)) return !usuario.fecha_nacimiento
    return !registrados[i]?.tiene_fecha_nacimiento
  }

  const cambiarPasajero = (indice, campo, valor) => {
    const limpio = campo === 'cedula' ? valor.replace(/\D/g, '').slice(0, 10) : valor
    setPasajeros((actuales) => actuales.map((p, i) => (i === indice ? { ...p, [campo]: limpio } : p)))
    setErroresPasajeros((actuales) => actuales.map((e, i) => (i === indice ? { ...e, [campo]: '' } : e)))
    if (campo === 'cedula') {
      setRegistrados((r) => ({ ...r, [indice]: undefined }))
      if (limpio.length === 10) buscarRegistrado(indice, limpio)
    }
  }

  // GC-15: si la cédula ya está registrada, se precarga el nombre del pasajero
  const buscarRegistrado = async (indice, cedula) => {
    try {
      const { data } = await api.get('/compras/pasajero', { params: { cedula } })
      setRegistrados((r) => ({ ...r, [indice]: data }))
      if (data.registrado) {
        setPasajeros((actuales) => actuales.map((p, i) => (i === indice ? { ...p, nombre: data.nombre } : p)))
      }
    } catch {
      // cédula no válida: el mensaje aparece al confirmar
    }
  }

  // Casilla "Viajo yo": llena o vacía el primer asiento con los datos de la cuenta
  const alternarViajoYo = (marcado) => {
    setViajoYo(marcado)
    setRegistrados((r) => ({ ...r, 0: undefined }))
    setPasajeros((actuales) => actuales.map((p, i) => (i !== 0 ? p : {
      ...p,
      cedula: marcado ? usuario?.cedula || '' : '',
      nombre: marcado ? `${usuario?.nombres || ''} ${usuario?.apellidos || ''}`.trim() : '',
      fecha_nacimiento: '',
    })))
    setErroresPasajeros((actuales) => actuales.map((e, i) => (i === 0 ? {} : e)))
  }

  const confirmar = async (e) => {
    e.preventDefault()
    setError('')
    const revisados = pasajeros.map((p, i) => revisarPasajero(p, necesitaFecha(p, i)))
    setErroresPasajeros(revisados)
    setErrorMetodo(metodoPagoId ? '' : 'Elige cómo vas a pagar')
    if (revisados.some((r) => Object.keys(r).length) || !metodoPagoId) {
      setError('Revisa los datos marcados antes de confirmar')
      return
    }

    setEnviando(true)
    try {
      const { data } = await api.post('/compras', {
        viaje_id: seleccion.viaje_id,
        subida: seleccion.subida,
        bajada: seleccion.bajada,
        metodo_pago_id: Number(metodoPagoId),
        pasajeros: pasajeros.map((p, i) => ({
          asiento_id: p.asiento_id,
          cedula: p.cedula.trim(),
          nombre: p.nombre.trim().replace(/\s+/g, ' '),
          tipo_descuento_id: p.tipo_descuento_id ? Number(p.tipo_descuento_id) : null,
          fecha_nacimiento: necesitaFecha(p, i) ? p.fecha_nacimiento : undefined,
        })),
      })
      sessionStorage.removeItem('compraPendiente')
      setCompra(data)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(mensajeDeError(err))
      // Errores por pasajero: { pasajero_1: 'Pasajero 1: la cédula no es válida…' }
      const detalles = err.response?.data?.detalles || {}
      setErroresPasajeros(pasajeros.map((_, i) => {
        const texto = detalles[`pasajero_${i + 1}`]
        return texto ? { cedula: texto.replace(/^Pasajero \d+:\s*/, '') } : {}
      }))
    } finally {
      setEnviando(false)
    }
  }

  const metodo = catalogos.metodos_pago.find((m) => m.id === Number(metodoPagoId))

  // ── Paso 3 y 4: compra registrada ──────────────────────────────────
  if (compra) {
    const requiereComprobante = metodo?.requiere_comprobante !== false
    return (
      <section className="viajes" style={{ maxWidth: 820 }}>
        <Etapas actual={comprobanteEnviado || !requiereComprobante ? 3 : 2} />

        <div className="viajes__tarjeta exito-compra">
          <div className="exito-compra__icono">{comprobanteEnviado ? '✓' : '⏱'}</div>
          <h1>{comprobanteEnviado ? '¡Listo! Recibimos tu comprobante' : 'Tus asientos están reservados'}</h1>
          <p className="viajes__sub" style={{ marginBottom: '.5rem' }}>
            Compra N.º {compra.id} · Total <strong>{dinero(compra.total)}</strong> · {compra.boletos.length} {compra.boletos.length === 1 ? 'boleto' : 'boletos'}
          </p>
          {comprobanteEnviado && (
            <p style={{ margin: 0 }}>Un oficinista revisará tu pago. Te avisaremos cuando tus boletos estén listos para descargar con su código QR.</p>
          )}
        </div>

        {!comprobanteEnviado && requiereComprobante && (
          <div className="viajes__tarjeta">
            <h2>Paga y sube tu comprobante</h2>
            <p>Haz la transferencia o el depósito{metodo ? ` (${metodo.nombre})` : ''} por <strong>{dinero(compra.total)}</strong> a la cuenta de la cooperativa:</p>
            {/* GC-37: la reserva sin comprobante vence a los 30 minutos */}
            <p className="viajes__aviso" style={{ margin: '0 0 .75rem' }}>Tienes <strong>30 minutos</strong> para subir el comprobante. Si no lo subes a tiempo, la reserva vence y los asientos se liberan.</p>
            {/* GC-43: el pago va a la cuenta de la cooperativa que opera el viaje */}
            <CuentaBancaria cuenta={compra.cuenta_cooperativa} total={compra.total} />
            <SubirComprobante compraId={compra.id} alSubir={() => { setComprobanteEnviado(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
            <p style={{ margin: '1rem 0 0', color: 'var(--v-suave)', fontSize: '.88rem' }}>
              ¿Todavía no pagas? Puedes subir el comprobante desde <Link to="/mis-boletos">Mis boletos</Link> antes de que venza la reserva.
            </p>
          </div>
        )}

        <div className="viajes__tarjeta">
          <h2>Boletos ({compra.boletos.length})</h2>
          <div className="boletos">
            {compra.boletos.map((b) => (
              <div key={b.id} className="boleto">
                <span className="boleto__asiento"><span><small>ASIENTO</small>{b.numero_asiento}</span></span>
                <div>
                  <strong>{b.pasajero_nombre}</strong>
                  <span>{b.pasajero_cedula} · {b.descuento > 0 ? `descuento de ${dinero(b.descuento)}` : 'tarifa normal'}</span>
                </div>
                <strong>{dinero(b.precio_final)}</strong>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginTop: '1.25rem' }}>
            <button type="button" className="viajes__boton" onClick={() => navigate('/mis-boletos')}>Ir a Mis boletos</button>
            <button type="button" className="viajes__boton viajes__boton--claro" onClick={() => navigate('/viajes')}>Comprar otro pasaje</button>
          </div>
        </div>
      </section>
    )
  }

  if (!seleccion?.asientos?.length) {
    return (
      <section className="viajes">
        <div className="viajes__vacio">
          <strong>Aún no elegiste asientos</strong>
          <span>Busca un viaje y elige tus asientos para continuar con la compra.</span>
          <button type="button" className="viajes__boton" style={{ marginTop: '.5rem' }} onClick={() => navigate('/viajes')}>Buscar viajes</button>
        </div>
      </section>
    )
  }

  const total = seleccion.asientos.reduce((suma, a) => suma + a.precio, 0)
  const metodos = catalogos.metodos_pago.filter((m) => m.codigo !== 'efectivo')

  // ── Paso 2: pasajeros y método de pago ─────────────────────────────
  return (
    <section className="viajes">
      <button type="button" className="viajes__boton viajes__boton--claro" style={{ marginBottom: '1rem' }} onClick={() => navigate(-1)}>
        ← Cambiar asientos
      </button>
      <Etapas actual={1} />
      <h1>¿Quiénes viajan?</h1>
      <p className="viajes__sub">Cada asiento es un boleto con la cédula y el nombre de quien viaja.</p>

      {error && <p role="alert" className="viajes__error">{error}</p>}

      <form onSubmit={confirmar} noValidate className="detalle">
        <div>
          {seleccion.asientos.map((asiento, i) => {
            const errores = erroresPasajeros[i] || {}
            const bloqueado = esElUsuario(i)
            const registro = registrados[i]
            return (
              <div className="viajes__tarjeta" key={asiento.id}>
                <div className="pasajero__cabecera">
                  <h2>Pasajero {i + 1}</h2>
                  <span className="pasajero__asiento"><b>{asiento.numero}</b> {asiento.tipo_asiento} · {dinero(asiento.precio)}</span>
                </div>

                {i === 0 && usuario && (
                  <label className="casilla-viajo">
                    <input type="checkbox" checked={viajoYo} onChange={(e) => alternarViajoYo(e.target.checked)} />
                    <span>
                      <strong>Viajo yo en este asiento</strong>
                      <small>Usamos los datos de tu cuenta ({usuario.nombres} {usuario.apellidos}). Desmárcalo si compras para otra persona.</small>
                    </span>
                  </label>
                )}

                <div className="rejilla-campos">
                  <label className={`viajes__campo ${errores.cedula ? 'viajes__campo--error' : ''}`}>
                    <span>Cédula</span>
                    <input value={pasajeros[i].cedula} inputMode="numeric" placeholder="10 dígitos" disabled={bloqueado}
                      onChange={(e) => cambiarPasajero(i, 'cedula', e.target.value)} />
                    {errores.cedula && <small className="viajes__error-campo">{errores.cedula}</small>}
                    {!errores.cedula && registro?.registrado && !bloqueado && <small className="pasajero__registrado">✓ Pasajero registrado: datos precargados</small>}
                  </label>
                  <label className={`viajes__campo ${errores.nombre ? 'viajes__campo--error' : ''}`}>
                    <span>Nombre completo</span>
                    <input value={pasajeros[i].nombre} placeholder="Nombres y apellidos" disabled={bloqueado}
                      onChange={(e) => cambiarPasajero(i, 'nombre', e.target.value)} />
                    {errores.nombre && <small className="viajes__error-campo">{errores.nombre}</small>}
                  </label>
                  <label className="viajes__campo">
                    <span>Descuento</span>
                    <select value={pasajeros[i].tipo_descuento_id}
                      onChange={(e) => cambiarPasajero(i, 'tipo_descuento_id', e.target.value)}>
                      <option value="">Sin descuento</option>
                      {catalogos.tipos_descuento.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre} ({Number(t.porcentaje)} %)</option>
                      ))}
                    </select>
                  </label>
                  {necesitaFecha(pasajeros[i], i) && (
                    <label className={`viajes__campo ${errores.fecha_nacimiento ? 'viajes__campo--error' : ''}`}>
                      <span>Fecha de nacimiento</span>
                      <input type="date" value={pasajeros[i].fecha_nacimiento}
                        onChange={(e) => cambiarPasajero(i, 'fecha_nacimiento', e.target.value)} />
                      {errores.fecha_nacimiento
                        ? <small className="viajes__error-campo">{errores.fecha_nacimiento}</small>
                        : <small style={{ color: 'var(--v-suave)' }}>La usamos para validar el descuento por edad.</small>}
                    </label>
                  )}
                </div>
                {tipoDescuento(pasajeros[i].tipo_descuento_id)?.codigo === 'discapacidad' && (
                  <p className="pasajero__nota">El pasajero debe presentar su carné de discapacidad al abordar.</p>
                )}
              </div>
            )
          })}

          <div className="viajes__tarjeta">
            <h2>¿Cómo vas a pagar?</h2>
            <div className="metodos" role="radiogroup">
              {metodos.map((m) => (
                <label key={m.id} className={`metodo ${String(m.id) === metodoPagoId ? 'metodo--activo' : ''}`}>
                  <input type="radio" name="metodo" value={m.id} checked={String(m.id) === metodoPagoId}
                    onChange={(e) => { setMetodoPagoId(e.target.value); setErrorMetodo('') }} />
                  <span>{m.nombre}<small>{m.requiere_comprobante === false ? 'Pago inmediato' : 'Subirás el comprobante en el siguiente paso'}</small></span>
                </label>
              ))}
            </div>
            {errorMetodo && <small className="viajes__error-campo">{errorMetodo}</small>}
          </div>
        </div>

        <aside className="lateral">
          <div className="viajes__tarjeta">
            <h2>Resumen</h2>
            {viaje && (
              <>
                <div className="lateral__fila"><span>Tramo</span><strong>{viaje.origen} → {viaje.destino}</strong></div>
                <div className="lateral__fila"><span>Fecha</span><strong>{fechaLarga(viaje.fecha).replace(/^./, (letra) => letra.toUpperCase())}</strong></div>
                <div className="lateral__fila"><span>Salida</span><strong>{horaEnParada(viaje.hora_salida, viaje.paradas?.find((p) => p.orden === viaje.orden_subida)?.minutos_desde_salida)}</strong></div>
                <div className="lateral__fila"><span>Cooperativa</span><strong>{viaje.cooperativa}</strong></div>
                <div className="lateral__fila"><span>Bus</span><strong>{viaje.numero_disco} · {viaje.placa}</strong></div>
              </>
            )}
            {seleccion.asientos.map((a, i) => (
              <div key={a.id} className="lateral__fila">
                <span>Asiento {a.numero} · {pasajeros[i].nombre.split(' ')[0] || `Pasajero ${i + 1}`}</span>
                <strong>{dinero(a.precio)}</strong>
              </div>
            ))}
            <div className="lateral__total"><span>Total sin descuentos</span><strong>{dinero(total)}</strong></div>
            <p style={{ color: 'var(--v-suave)', fontSize: '.8rem', margin: '.4rem 0 1rem' }}>
              El total final, con descuentos, lo calcula el sistema al confirmar.
            </p>
            {/* GC-43: sin cuenta bancaria la cooperativa no recibe pagos en línea */}
            {viaje && viaje.pago_en_linea === false && (
              <p className="viajes__error" style={{ margin: '0 0 .75rem' }}>
                {viaje.cooperativa} todavía no recibe pagos por transferencia o depósito. Puedes comprar este viaje en su ventanilla.
              </p>
            )}
            <button className="viajes__boton viajes__boton--bloque" disabled={enviando || viaje?.pago_en_linea === false}>
              {enviando ? 'Reservando tus asientos…' : 'Confirmar y continuar al pago'}
            </button>
          </div>
        </aside>
      </form>
    </section>
  )
}

// Paso 3: subir el comprobante sin salir de la compra
function SubirComprobante({ compraId, alSubir }) {
  const [archivo, setArchivo] = useState(null)
  const [referencia, setReferencia] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const entrada = useRef(null)

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
      <div className="rejilla-campos">
        <div className="viajes__campo">
          <span>Comprobante</span>
          <button type="button" className="subir-archivo" onClick={() => entrada.current?.click()}>
            {archivo ? `📄 ${archivo.name}` : 'Elegir archivo (JPG, PNG o PDF, máx. 5 MB)'}
          </button>
          <input ref={entrada} type="file" accept="image/jpeg,image/png,application/pdf" onChange={elegirArchivo} hidden />
        </div>
        <label className="viajes__campo">
          <span>Número de referencia</span>
          <input value={referencia} placeholder="Ej. 004512378" onChange={(e) => setReferencia(e.target.value)} />
        </label>
      </div>
      {error && <p role="alert" className="viajes__error" style={{ margin: 0 }}>{error}</p>}
      <div>
        <button className="viajes__boton" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar comprobante y terminar'}</button>
      </div>
    </form>
  )
}

export default Comprar
