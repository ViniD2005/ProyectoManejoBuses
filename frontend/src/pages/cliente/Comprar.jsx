import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useConfiguracion } from '../../hooks/useConfiguracion.js'
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
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

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
    setPasajeros((actuales) => actuales.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p)))
  }

  const confirmar = async (e) => {
    e.preventDefault()
    setError('')
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
          tipo_descuento_id: p.tipo_descuento_id ? Number(p.tipo_descuento_id) : null,
        })),
      })
      sessionStorage.removeItem('compraPendiente')
      setCompra(data)
    } catch (err) {
      const detalles = err.response?.data?.detalles
      setError(mensajeDeError(err) + (detalles ? ': ' + Object.values(detalles).join(' / ') : ''))
    } finally {
      setEnviando(false)
    }
  }

  // Compra registrada: resumen y siguientes pasos
  if (compra) {
    return (
      <section className="viajes">
        <h1>Compra registrada</h1>
        <div className="viajes__tarjeta">
          <p><strong>Compra N.º {compra.id}</strong> — Total a pagar: <strong>${compra.total.toFixed(2)}</strong></p>
          <p>Estado del pago: <strong>pendiente</strong>. Tus asientos quedan reservados.</p>
          <ul>
            {compra.boletos.map((b) => (
              <li key={b.id}>
                Asiento {b.numero_asiento} — {b.pasajero_nombre} — ${b.precio_final.toFixed(2)}
                {b.descuento > 0 && ` (descuento de $${b.descuento.toFixed(2)})`}
              </li>
            ))}
          </ul>
        </div>
        <div className="viajes__tarjeta">
          <h2>Siguiente paso: realiza el pago</h2>
          <p>Haz la transferencia o el depósito a: <strong>{cuentaBancaria || CUENTA_POR_DEFECTO}</strong></p>
          <p>Luego sube el comprobante desde <strong>Mis boletos</strong>. Un oficinista lo validará y tus boletos quedarán emitidos.</p>
          <p>
            <Link to="/mis-boletos">Ir a Mis boletos</Link>
            {' — '}
            <Link to="/viajes">Comprar otro boleto</Link>
          </p>
        </div>
      </section>
    )
  }

  if (!seleccion?.asientos?.length) {
    return (
      <section className="viajes">
        <h1>Comprar boletos</h1>
        <p>No hay asientos seleccionados. Busca un viaje y elige tus asientos.</p>
        <Link to="/viajes">Buscar viajes</Link>
      </section>
    )
  }

  const total = seleccion.asientos.reduce((suma, a) => suma + a.precio, 0)

  return (
    <section className="viajes">
      <h1>Comprar boletos</h1>

      {viaje && (
        <div className="viajes__tarjeta">
          <p><strong>{viaje.origen} → {viaje.destino}</strong> — {viaje.fecha} — salida {viaje.hora_salida?.slice(0, 5)}</p>
          <p>{viaje.cooperativa} — Bus {viaje.numero_disco} ({viaje.placa})</p>
        </div>
      )}

      <form onSubmit={confirmar}>
        {seleccion.asientos.map((asiento, i) => (
          <div className="viajes__tarjeta" key={asiento.id}>
            <h2>Pasajero {i + 1} — Asiento {asiento.numero} ({asiento.tipo_asiento}) — ${asiento.precio.toFixed(2)}</h2>
            <div className="viajes__formulario">
              <label>
                Cédula
                <input value={pasajeros[i].cedula} maxLength={10} required
                  onChange={(e) => cambiarPasajero(i, 'cedula', e.target.value)} />
              </label>
              <label>
                Nombre completo
                <input value={pasajeros[i].nombre} required
                  onChange={(e) => cambiarPasajero(i, 'nombre', e.target.value)} />
              </label>
              <label>
                Descuento
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
        ))}

        <div className="viajes__tarjeta">
          <div className="viajes__formulario">
            <label>
              Método de pago
              <select value={metodoPagoId} onChange={(e) => setMetodoPagoId(e.target.value)} required>
                <option value="">Elige un método</option>
                {catalogos.metodos_pago
                  .filter((m) => m.codigo !== 'efectivo')
                  .map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </label>
          </div>
          <p>Total sin descuentos: <strong>${total.toFixed(2)}</strong>. El total final lo calcula el sistema al confirmar.</p>
          <p><small>Los descuentos por tercera edad y menor de edad se validan con la fecha de nacimiento del pasajero registrado. El de discapacidad lo verifica el oficinista.</small></p>
          {error && <p role="alert" className="viajes__error">{error}</p>}
          <button disabled={enviando}>{enviando ? 'Registrando compra…' : 'Confirmar compra'}</button>
        </div>
      </form>
    </section>
  )
}

export default Comprar
