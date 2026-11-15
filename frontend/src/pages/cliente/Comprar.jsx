import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useConfiguracion } from '../../hooks/useConfiguracion.js'
import { dinero, fechaLarga, horaEnParada } from './formatos.js'
import './Viajes.css'

// Datos bancarios por defecto si la configuración no tiene cuenta registrada
const CUENTA_POR_DEFECTO = 'Banco Pichincha - Cuenta corriente 0000000000 - Pasajes Ecuador'

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
function revisarPasajero(p) {
  const errores = {}
  const cedula = p.cedula.trim()
  if (!cedula) errores.cedula = 'Escribe la cédula del pasajero'
  else if (!/^\d{10}$/.test(cedula)) errores.cedula = 'La cédula debe tener exactamente 10 dígitos'
  const nombre = p.nombre.trim().replace(/\s+/g, ' ')
  if (!nombre) errores.nombre = 'Escribe el nombre completo del pasajero'
  else if (!nombre.includes(' ')) errores.nombre = 'Escribe nombre y apellido del pasajero'
  else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' -]+$/.test(nombre)) errores.nombre = 'El nombre solo puede contener letras y espacios'
  return errores
}

const ETAPAS = ['Asientos', 'Pasajeros y pago', 'Comprobante']

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

// Compra de boletos (rediseño CC-20)
function Comprar() {
  const { usuario } = useAuth()
  const { cuenta_bancaria: cuentaBancaria } = useConfiguracion()
  const [seleccion] = useState(leerSeleccion)
  const [viaje, setViaje] = useState(null)
  const [catalogos, setCatalogos] = useState({ metodos_pago: [], tipos_descuento: [] })
  const [pasajeros, setPasajeros] = useState(() =>
    (seleccion?.asientos || []).map((asiento, i) => ({
      asiento_id: asiento.id,
      // El primer pasajero se completa con los datos del usuario
      cedula: i === 0 ? usuario?.cedula || '' : '',
      nombre: i === 0 ? `${usuario?.nombres || ''} ${usuario?.apellidos || ''}`.trim() : '',
      tipo_descuento_id: '',
    }))
  )
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [error, setError] = useState('')
  const [erroresPasajeros, setErroresPasajeros] = useState([])
  const [errorMetodo, setErrorMetodo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [compra, setCompra] = useState(null)

  useEffect(() => {
    if (!seleccion) return
    api.get(`/viajes/${seleccion.viaje_id}`, { params: { subida: seleccion.subida, bajada: seleccion.bajada } })
      .then(({ data }) => setViaje(data))
      .catch((err) => setError(mensajeDeError(err)))
    api.get('/compras/catalogos')
      .then(({ data }) => setCatalogos(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [seleccion])

  const cambiarPasajero = (indice, campo, valor) => {
    const limpio = campo === 'cedula' ? valor.replace(/\D/g, '').slice(0, 10) : valor
    setPasajeros((actuales) => actuales.map((p, i) => (i === indice ? { ...p, [campo]: limpio } : p)))
    setErroresPasajeros((actuales) => actuales.map((e, i) => (i === indice ? { ...e, [campo]: '' } : e)))
  }

  const confirmar = async (e) => {
    e.preventDefault()
    setError('')
    const revisados = pasajeros.map(revisarPasajero)
    const cedulas = pasajeros.map((p) => p.cedula.trim())
    cedulas.forEach((c, i) => {
      if (c && cedulas.indexOf(c) !== i && !revisados[i].cedula) revisados[i].cedula = 'Esta cédula ya está en otro asiento de la compra'
    })
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
        pasajeros: pasajeros.map((p) => ({
          ...p,
          cedula: p.cedula.trim(),
          nombre: p.nombre.trim().replace(/\s+/g, ' '),
          tipo_descuento_id: p.tipo_descuento_id ? Number(p.tipo_descuento_id) : null,
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

  // Compra registrada: resumen y siguientes pasos
  if (compra) {
    const metodo = catalogos.metodos_pago.find((m) => m.id === Number(metodoPagoId))
    return (
      <section className="viajes contenido-angosto" style={{ maxWidth: 760 }}>
        <Etapas actual={2} />
        <div className="viajes__tarjeta exito-compra">
          <div className="exito-compra__icono">✓</div>
          <h1>¡Tus asientos están reservados!</h1>
          <p className="viajes__sub" style={{ marginBottom: '.5rem' }}>
            Compra N.º {compra.id} · Total a pagar <strong>{dinero(compra.total)}</strong>
          </p>
        </div>

        <div className="viajes__tarjeta">
          <h2>Boletos</h2>
          <div className="boletos">
            {compra.boletos.map((b) => (
              <div key={b.id} className="boleto">
                <span className="boleto__asiento"><span><small>ASIENTO</small>{b.numero_asiento}</span></span>
                <div>
                  <strong>{b.pasajero_nombre}</strong>
                  <span>{b.descuento > 0 ? `Descuento de ${dinero(b.descuento)} aplicado` : 'Tarifa normal'}</span>
                </div>
                <strong>{dinero(b.precio_final)}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="viajes__tarjeta">
          <h2>Siguiente paso: realiza el pago</h2>
          <p>Haz la transferencia o el depósito{metodo ? ` (${metodo.nombre})` : ''} por <strong>{dinero(compra.total)}</strong> a esta cuenta:</p>
          <div className="cuenta">{cuentaBancaria || CUENTA_POR_DEFECTO}</div>
          <p style={{ marginTop: '1rem' }}>
            Luego sube la foto o el PDF del comprobante en <strong>Mis boletos</strong>. Un oficinista lo revisará y te avisaremos
            cuando tus boletos estén listos para descargar con su código QR.
          </p>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
            <Link to="/mis-boletos" className="viajes__boton">Ir a Mis boletos y subir el comprobante</Link>
            <Link to="/viajes" className="viajes__boton viajes__boton--claro">Comprar otro pasaje</Link>
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
          <Link to="/viajes" className="viajes__boton" style={{ marginTop: '.5rem' }}>Buscar viajes</Link>
        </div>
      </section>
    )
  }

  const total = seleccion.asientos.reduce((suma, a) => suma + a.precio, 0)
  const metodos = catalogos.metodos_pago.filter((m) => m.codigo !== 'efectivo')

  return (
    <section className="viajes">
      <Etapas actual={1} />
      <h1>Datos de los pasajeros</h1>
      <p className="viajes__sub">Cada asiento necesita la cédula y el nombre completo de quien viaja.</p>

      {error && <p role="alert" className="viajes__error">{error}</p>}

      <form onSubmit={confirmar} noValidate className="detalle">
        <div>
          {seleccion.asientos.map((asiento, i) => {
            const errores = erroresPasajeros[i] || {}
            return (
              <div className="viajes__tarjeta" key={asiento.id}>
                <div className="pasajero__cabecera">
                  <h2>Pasajero {i + 1}{i === 0 && usuario ? ' (tú)' : ''}</h2>
                  <span className="pasajero__asiento"><b>{asiento.numero}</b> {asiento.tipo_asiento} · {dinero(asiento.precio)}</span>
                </div>
                <div className="rejilla-campos">
                  <label className={`viajes__campo ${errores.cedula ? 'viajes__campo--error' : ''}`}>
                    <span>Cédula</span>
                    <input value={pasajeros[i].cedula} inputMode="numeric" placeholder="10 dígitos"
                      onChange={(e) => cambiarPasajero(i, 'cedula', e.target.value)} />
                    {errores.cedula && <small className="viajes__error-campo">{errores.cedula}</small>}
                  </label>
                  <label className={`viajes__campo ${errores.nombre ? 'viajes__campo--error' : ''}`}>
                    <span>Nombre completo</span>
                    <input value={pasajeros[i].nombre} placeholder="Nombres y apellidos"
                      onChange={(e) => cambiarPasajero(i, 'nombre', e.target.value)} />
                    {errores.nombre && <small className="viajes__error-campo">{errores.nombre}</small>}
                  </label>
                  <label className="viajes__campo ancho-total">
                    <span>Descuento</span>
                    <select value={pasajeros[i].tipo_descuento_id}
                      onChange={(e) => cambiarPasajero(i, 'tipo_descuento_id', e.target.value)}>
                      <option value="">Sin descuento</option>
                      {catalogos.tipos_descuento.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre} ({Number(t.porcentaje)} %)</option>
                      ))}
                    </select>
                  </label>
                </div>
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
                  <span>{m.nombre}<small>{m.requiere_comprobante === false ? 'Pago inmediato' : 'Subirás el comprobante después'}</small></span>
                </label>
              ))}
            </div>
            {errorMetodo && <small className="viajes__error-campo">{errorMetodo}</small>}
            <p style={{ margin: '1rem 0 0', color: 'var(--v-suave)', fontSize: '.85rem' }}>
              Los descuentos de tercera edad y menor de edad se validan con la fecha de nacimiento del pasajero registrado.
              El de discapacidad lo verifica el oficinista.
            </p>
          </div>
        </div>

        <aside className="lateral">
          <div className="viajes__tarjeta">
            <h2>Resumen</h2>
            {viaje && (
              <>
                <div className="lateral__fila"><span>Tramo</span><strong>{viaje.origen} → {viaje.destino}</strong></div>
                <div className="lateral__fila"><span>Fecha</span><strong style={{ textTransform: 'capitalize' }}>{fechaLarga(viaje.fecha)}</strong></div>
                <div className="lateral__fila"><span>Salida</span><strong>{horaEnParada(viaje.hora_salida, viaje.minutos_desde_salida)}</strong></div>
                <div className="lateral__fila"><span>Cooperativa</span><strong>{viaje.cooperativa}</strong></div>
                <div className="lateral__fila"><span>Bus</span><strong>{viaje.numero_disco} · {viaje.placa}</strong></div>
              </>
            )}
            <div className="lateral__fila"><span>Asientos</span><strong>{seleccion.asientos.map((a) => a.numero).join(', ')}</strong></div>
            <div className="lateral__total"><span>Total sin descuentos</span><strong>{dinero(total)}</strong></div>
            <p style={{ color: 'var(--v-suave)', fontSize: '.8rem', margin: '.4rem 0 1rem' }}>
              El total final, con descuentos, lo calcula el sistema al confirmar.
            </p>
            <button className="viajes__boton viajes__boton--bloque" disabled={enviando}>
              {enviando ? 'Reservando tus asientos…' : 'Confirmar compra'}
            </button>
          </div>
        </aside>
      </form>
    </section>
  )
}

export default Comprar
