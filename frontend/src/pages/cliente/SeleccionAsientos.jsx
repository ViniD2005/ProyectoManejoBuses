import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../services/api.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { dinero, duracion, fechaLarga, horaEnParada } from './formatos.js'
import './Viajes.css'

/*
  GC-18: arma el piso con la estructura real del bus (fila y columna de cada
  asiento; izquierda + pasillo + derecha). Devuelve las columnas de la
  cuadrícula, la posición del pasillo y una matriz [fila][columna] → asiento.
*/
function distribuir(asientos) {
  const izquierda = asientos[0]?.izquierda || 2
  const derecha = asientos[0]?.derecha || 2
  const columnas = izquierda + 1 + derecha
  const totalFilas = Math.max(1, ...asientos.map((a) => a.fila || 1))
  const matriz = Array.from({ length: totalFilas }, () => new Array(columnas).fill(null))
  for (const a of asientos) if (a.fila && a.columna) matriz[a.fila - 1][a.columna - 1] = a
  return { columnas, pasillo: izquierda, matriz }
}

// Mapa de asientos del bus (rediseño CC-20)
function SeleccionAsientos() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  // GC-10: solo los clientes (o visitantes que luego inician sesión) compran en línea
  const esPersonal = Boolean(usuario) && usuario.rol !== 'cliente'

  const subida = parametros.get('subida')
  const bajada = parametros.get('bajada')
  const pasajeros = Math.max(1, Number(parametros.get('pasajeros')) || 1)

  const [asientos, setAsientos] = useState([])
  const [seleccionados, setSeleccionados] = useState([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(true)
  const [pisoElegido, setPisoElegido] = useState(null)
  // GC-14: datos del viaje para mostrar el resumen de la compra
  const [viaje, setViaje] = useState(null)

  useEffect(() => {
    let activo = true
    api.get(`/viajes/${id}/asientos`, { params: { subida, bajada } })
      .then(({ data }) => { if (activo) setAsientos(Array.isArray(data) ? data : []) })
      .catch((fallo) => { if (activo) setError(fallo.response?.data?.mensaje || 'No pudimos cargar los asientos.') })
      .finally(() => { if (activo) setCargando(false) })
    api.get(`/viajes/${id}`, { params: { subida, bajada } })
      .then(({ data }) => { if (activo) setViaje(data) })
      .catch(() => {})
    return () => { activo = false }
  }, [id, subida, bajada])

  function alternar(asiento) {
    if (seleccionados.includes(asiento.id)) {
      setAviso('')
      setSeleccionados(seleccionados.filter((asientoId) => asientoId !== asiento.id))
      return
    }
    if (seleccionados.length >= pasajeros) {
      setAviso(`Ya elegiste ${pasajeros} ${pasajeros === 1 ? 'asiento' : 'asientos'}. Quita uno para cambiarlo.`)
      return
    }
    setAviso('')
    setSeleccionados([...seleccionados, asiento.id])
  }

  const pisos = [...new Set(asientos.map((a) => a.piso))].sort((a, b) => a - b)
  const piso = pisoElegido ?? pisos[0]
  const elegidos = asientos.filter((a) => seleccionados.includes(a.id))
  const distribucion = distribuir(asientos.filter((a) => a.piso === piso))
  // El pasillo es angosto; cada asiento ocupa una columna igual
  const plantillaColumnas = Array.from({ length: distribucion.columnas }, (_, j) => (j === distribucion.pasillo ? '22px' : 'minmax(0, 1fr)')).join(' ')
  const total = elegidos.reduce((suma, asiento) => suma + asiento.precio, 0)
  const libres = asientos.filter((a) => a.disponible).length

  // GC-14: total agrupado por tipo de asiento ("2 × Normal $9.00")
  const porTipo = Object.values(elegidos.reduce((grupos, a) => {
    const g = grupos[a.tipo_asiento] || { tipo: a.tipo_asiento, cantidad: 0, subtotal: 0 }
    g.cantidad += 1
    g.subtotal += a.precio
    return { ...grupos, [a.tipo_asiento]: g }
  }, {}))
  const paradaSubida = viaje?.paradas?.find((p) => p.orden === viaje.orden_subida)
  const paradaBajada = viaje?.paradas?.find((p) => p.orden === viaje.orden_bajada)

  // Guarda la selección (sobrevive al inicio de sesión) y va a la compra
  function continuarCompra() {
    sessionStorage.setItem('compraPendiente', JSON.stringify({
      viaje_id: Number(id),
      subida: Number(subida),
      bajada: Number(bajada),
      asientos: elegidos.map((a) => ({ id: a.id, numero: a.numero, tipo_asiento: a.tipo_asiento, precio: a.precio })),
    }))
    navigate('/comprar')
  }

  // Los asientos especiales (VIP, ejecutivo, semicama…) se pintan con el color de acento
  const esPremium = (a) => /vip|premium|ejecutivo|cama/i.test(a.tipo_asiento)

  return (
    <section className="viajes">
      <button type="button" className="viajes__boton viajes__boton--claro" style={{ marginBottom: '1rem' }} onClick={() => navigate(-1)}>
        ← Volver a los resultados
      </button>

      {/* GC-14: resumen del viaje que se está comprando */}
      {viaje && (
        <div className="resumen-viaje" style={viaje.cooperativa_color ? { '--coop': viaje.cooperativa_color } : undefined}>
          <div>
            <span className="resumen-viaje__etiqueta">Tu viaje</span>
            <h1>{viaje.origen} → {viaje.destino}</h1>
            <p>
              {fechaLarga(viaje.fecha)} · sale {horaEnParada(viaje.hora_salida, paradaSubida?.minutos_desde_salida)}
              {paradaBajada && ` · llega ${horaEnParada(viaje.hora_salida, paradaBajada.minutos_desde_salida)}`}
              {paradaSubida && paradaBajada && ` (${duracion(paradaBajada.minutos_desde_salida - paradaSubida.minutos_desde_salida)})`}
            </p>
          </div>
          <div className="resumen-viaje__bus">
            <strong>{viaje.cooperativa}</strong>
            <span>Bus {viaje.numero_disco} · {viaje.placa}</span>
          </div>
        </div>
      )}

      <h2 className="viajes__titulo-seccion">Elige {pasajeros} {pasajeros === 1 ? 'asiento' : 'asientos'}</h2>
      <p className="viajes__sub">
        La disponibilidad corresponde a tu tramo. Pasa el cursor sobre un asiento para ver su tipo y precio.
      </p>

      {cargando && <div className="viajes__cargando"><span className="viajes__giro" /> Consultando disponibilidad…</div>}
      {error && <p role="alert" className="viajes__error">{error}</p>}

      {!cargando && !error && (
        <div className="asientos">
          <div className="viajes__tarjeta">
            <div className="leyenda">
              <span><i /> Disponible</span>
              {asientos.some(esPremium) && <span><i className="vip" /> VIP / especial</span>}
              <span><i className="elegido" /> Tu elección</span>
              <span><i className="ocupado" /> Ocupado</span>
            </div>

            {pisos.length > 1 && (
              <div className="pisos" role="tablist" aria-label="Pisos del bus">
                {pisos.map((p) => (
                  <button key={p} type="button" role="tab" aria-selected={p === piso} onClick={() => setPisoElegido(p)}>
                    Piso {p} · {asientos.filter((a) => a.piso === p && a.disponible).length} libres
                  </button>
                ))}
              </div>
            )}

            {/* GC-18: el aviso aparece junto al mapa, donde el cliente está mirando */}
            {aviso && <p className="viajes__error" role="status" style={{ marginTop: 0 }}>{aviso}</p>}
            <div className="bus" aria-label={`Mapa de asientos del piso ${piso}`}>
              <div className="bus__frente">
                <span>{piso === 1 ? 'Frente del bus' : `Piso ${piso}`}</span>
                {piso === 1 && <span className="bus__volante" title="Conductor">◎</span>}
              </div>
              <div className="bus__filas">
                {distribucion.matriz.map((fila, i) => (
                  <div className="bus__fila" key={i} style={{ gridTemplateColumns: plantillaColumnas }}>
                    {fila.map((asiento, j) => {
                      if (j === distribucion.pasillo) return <span key="pasillo" className="bus__fila-numero">{i + 1}</span>
                      if (!asiento) return <span key={j} className="bus__hueco" />
                      const elegido = seleccionados.includes(asiento.id)
                      return (
                        <button
                          key={asiento.id}
                          type="button"
                          className={`asiento ${esPremium(asiento) ? 'asiento--vip' : ''} ${elegido ? 'asiento--elegido' : ''}`}
                          disabled={!asiento.disponible}
                          aria-pressed={elegido}
                          aria-label={`Asiento ${asiento.numero}, ${asiento.tipo_asiento}, ${asiento.disponible ? dinero(asiento.precio) : 'ocupado'}`}
                          title={`${asiento.tipo_asiento} · ${asiento.disponible ? dinero(asiento.precio) : 'Ocupado'}`}
                          onClick={() => alternar(asiento)}
                        >
                          {asiento.numero}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p style={{ textAlign: 'center', margin: '1rem 0 0', color: 'var(--v-suave)', fontSize: '.85rem' }}>
              {libres} asientos libres en total · pasa el cursor sobre un asiento para ver su tipo y precio
            </p>
          </div>

          <aside className="lateral">
            <div className="viajes__tarjeta">
              <h2>Detalle de tu compra</h2>
              {viaje && (
                <>
                  <div className="lateral__fila"><span>Tramo</span><strong>{viaje.origen} → {viaje.destino}</strong></div>
                  <div className="lateral__fila"><span>Salida</span><strong>{horaEnParada(viaje.hora_salida, paradaSubida?.minutos_desde_salida)}</strong></div>
                </>
              )}
              <div className="lateral__fila" style={{ borderBottom: 0 }}>
                <span>Asientos elegidos</span><strong>{seleccionados.length} de {pasajeros}</strong>
              </div>
              <div className="progreso"><span style={{ width: `${(seleccionados.length / pasajeros) * 100}%` }} /></div>

              {elegidos.length > 0 ? (
                <ul className="elegidos">
                  {elegidos.map((a) => (
                    <li key={a.id}>
                      <span><b>{a.numero}</b>{a.tipo_asiento} · piso {a.piso}</span>
                      <strong>{dinero(a.precio)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--v-suave)', fontSize: '.9rem' }}>Toca un asiento libre en el mapa para elegirlo.</p>
              )}


              {porTipo.map((g) => (
                <div key={g.tipo} className="lateral__fila"><span>{g.cantidad} × {g.tipo}</span><strong>{dinero(g.subtotal)}</strong></div>
              ))}
              <div className="lateral__total"><span>Total estimado</span><strong>{dinero(total)}</strong></div>
              <p style={{ color: 'var(--v-suave)', fontSize: '.8rem', margin: '.4rem 0 1rem' }}>
                Los descuentos de ley se aplican en el siguiente paso.
              </p>
              {esPersonal ? (
                <div className="viajes__aviso" role="status" style={{ display: 'block' }}>
                  <strong style={{ display: 'block', marginBottom: '.25rem' }}>La compra en línea es solo para clientes</strong>
                  {usuario.rol === 'oficinista' ? (
                    <>Para vender a un pasajero usa <Link to="/oficinista/vender">Vender boletos</Link> (venta en ventanilla).</>
                  ) : (
                    <>Tu cuenta administra el sistema; la venta en ventanilla la hace el oficinista de la cooperativa.</>
                  )}
                </div>
              ) : (
                <button type="button" className="viajes__boton viajes__boton--bloque" disabled={seleccionados.length !== pasajeros}
                  onClick={continuarCompra}>
                  {seleccionados.length === pasajeros
                    ? 'Continuar con la compra'
                    : `Elige ${pasajeros - seleccionados.length} ${pasajeros - seleccionados.length === 1 ? 'asiento más' : 'asientos más'}`}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}

export default SeleccionAsientos
