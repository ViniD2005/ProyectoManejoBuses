import { useEffect, useMemo, useState } from 'react'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import ComboBuscador from '../../components/ComboBuscador.jsx'
import './VenderBoletos.css'

/*
  GC-22 - Venta en ventanilla (oficinista).
  Mismo cuidado que la compra en línea, pensado para el mostrador:
    1. Viaje     → busca entre los viajes de SU cooperativa (salidas futuras con cupo).
    2. Asientos  → mapa real del bus; no deja elegir más asientos que pasajeros.
    3. Pasajeros → la cédula precarga el nombre si la persona está registrada;
                   descuentos de ley con fecha de nacimiento cuando hace falta.
    4. Cobro     → efectivo recibido y vuelto; los boletos quedan emitidos al instante.
  Al final se imprimen TODOS los boletos en un solo PDF (uno por pasajero).
*/
const hoy = () => new Date().toLocaleDateString('en-CA')
const dinero = (n) => `$${Number(n || 0).toFixed(2)}`
const PASOS = ['Viaje', 'Asientos', 'Pasajeros', 'Cobro']
const esDescuentoPorEdad = (d) => /tercera|mayor|menor|niñ/i.test(d?.nombre || '') || ['tercera_edad', 'menor_edad'].includes(d?.codigo)

function horaMas(hora, minutos) {
  if (!hora) return ''
  const [h, m] = hora.split(':').map(Number)
  const total = (h * 60 + m + Number(minutos || 0)) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// Abre un PDF del servidor en una pestaña nueva (para imprimir)
async function abrirPdf(url, alFallar) {
  try {
    const { data } = await api.get(url, { responseType: 'blob' })
    const enlace = URL.createObjectURL(data)
    window.open(enlace, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(enlace), 60000)
  } catch {
    alFallar('No se pudo abrir el PDF de los boletos')
  }
}

// Mapa del bus con la estructura real (fila/columna); sin estructura, filas de 2 + 2
function MapaBus({ asientos, elegidos, alElegir }) {
  const pisos = [...new Set(asientos.map((a) => a.piso))].sort()
  const [piso, setPiso] = useState(pisos[0] || 1)
  const delPiso = asientos.filter((a) => a.piso === piso)
  const izquierda = delPiso[0]?.izquierda || 2
  const derecha = delPiso[0]?.derecha || 2
  const columnas = izquierda + 1 + derecha
  const conPosicion = delPiso.every((a) => a.fila && a.columna)
  const ubicados = delPiso.map((a, i) => (conPosicion ? a : { ...a, fila: Math.floor(i / 4) + 1, columna: [1, 2, 4, 5][i % 4] }))
  const filas = Math.max(1, ...ubicados.map((a) => a.fila))

  return (
    <div className="mostrador__mapa">
      {pisos.length > 1 && (
        <div className="pestanas" role="tablist">
          {pisos.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={p === piso} onClick={() => setPiso(p)}>
              Piso {p} · {asientos.filter((a) => a.piso === p && a.disponible).length} libres
            </button>
          ))}
        </div>
      )}
      <div className="mostrador__bus" style={{ gridTemplateColumns: Array.from({ length: columnas }, (_, i) => (i === izquierda ? '18px' : '40px')).join(' ') }}>
        {Array.from({ length: filas }, (_, f) => Array.from({ length: columnas }, (_, c) => {
          if (c === izquierda) return <span key={`${f}-${c}`} />
          const a = ubicados.find((x) => x.fila === f + 1 && x.columna === c + 1)
          if (!a) return <span key={`${f}-${c}`} />
          const elegido = elegidos.includes(a.id)
          return (
            <button key={a.id} type="button" disabled={!a.disponible}
              className={`mostrador__asiento ${elegido ? 'elegido' : ''} ${/vip|ejecutivo|cama|premium/i.test(a.tipo_asiento) ? 'vip' : ''}`}
              title={`${a.tipo_asiento} · ${a.disponible ? dinero(a.precio) : 'Ocupado'}`}
              aria-pressed={elegido} onClick={() => alElegir(a)}>
              {a.numero}
            </button>
          )
        }))}
      </div>
      <div className="mostrador__leyenda">
        <span><i /> Libre</span><span><i className="vip" /> VIP / especial</span><span><i className="elegido" /> Elegido</span><span><i className="ocupado" /> Ocupado</span>
      </div>
    </div>
  )
}

export default function VenderBoletos() {
  const [ciudades, setCiudades] = useState([])
  const [descuentos, setDescuentos] = useState([])
  const [busqueda, setBusqueda] = useState({ origen: '', destino: '', fecha: hoy(), pasajeros: 1 })
  const [viajes, setViajes] = useState(null)
  const [viaje, setViaje] = useState(null)
  const [asientos, setAsientos] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [paso, setPaso] = useState(0)
  const [recibido, setRecibido] = useState('')
  const [venta, setVenta] = useState(null)
  const [caja, setCaja] = useState(null)
  const [error, setError] = useState('')
  const [errores, setErrores] = useState({})
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargarCaja = () => api.get('/compras/ventanilla/hoy').then(({ data }) => setCaja(data)).catch(() => {})

  useEffect(() => {
    api.get('/ciudades').then(({ data }) => setCiudades(data)).catch((err) => setError(mensajeDeError(err)))
    api.get('/compras/catalogos').then(({ data }) => setDescuentos(data.tipos_descuento || [])).catch(() => {})
    cargarCaja()
  }, [])

  const opcionesCiudad = useMemo(() => ciudades.map((c) => ({ valor: String(c.id), etiqueta: c.etiqueta || c.nombre })), [ciudades])
  const cantidad = Number(busqueda.pasajeros)

  const reiniciar = () => {
    setViajes(null); setViaje(null); setAsientos([]); setPasajeros([]); setVenta(null)
    setPaso(0); setRecibido(''); setError(''); setErrores({}); setAviso('')
  }

  // ── 1. Buscar viajes de la cooperativa ────────────────────────────
  const buscar = async (e) => {
    e.preventDefault()
    setError(''); setErrores({}); setViaje(null); setPasajeros([])
    try {
      const { data } = await api.get('/compras/ventanilla/viajes', { params: busqueda })
      setViajes(data)
    } catch (err) {
      setViajes(null)
      setErrores(err.response?.data?.detalles || {})
      setError(mensajeDeError(err))
    }
  }

  const elegirViaje = async (v) => {
    setError('')
    try {
      const { data } = await api.get(`/viajes/${v.id}/asientos`, { params: { subida: busqueda.origen, bajada: busqueda.destino } })
      setViaje(v)
      setAsientos(data)
      setPasajeros([])
      setPaso(1)
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  // ── 2. Asientos ───────────────────────────────────────────────────
  const alternarAsiento = (asiento) => {
    setAviso('')
    if (pasajeros.some((p) => p.asiento.id === asiento.id)) {
      setPasajeros(pasajeros.filter((p) => p.asiento.id !== asiento.id))
    } else if (pasajeros.length >= cantidad) {
      setAviso(`Ya elegiste ${cantidad} asiento(s) para ${cantidad} pasajero(s). Quita uno para cambiarlo.`)
    } else {
      setPasajeros([...pasajeros, { asiento, cedula: '', nombre: '', tipo_descuento_id: '', fecha_nacimiento: '', registrado: null }])
    }
  }

  // ── 3. Pasajeros ──────────────────────────────────────────────────
  const cambiarPasajero = async (indice, campo, valor) => {
    const lista = pasajeros.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p))
    setPasajeros(lista)
    setErrores({ ...errores, [`p${indice}`]: '' })
    // Cédula completa: si la persona está registrada se precarga su nombre
    if (campo === 'cedula' && /^\d{10}$/.test(valor)) {
      try {
        const { data } = await api.get('/compras/pasajero', { params: { cedula: valor } })
        setPasajeros((actual) => actual.map((p, i) => (i === indice
          ? { ...p, registrado: data.registrado ? data : false, nombre: data.registrado ? data.nombre : p.nombre }
          : p)))
      } catch (err) {
        setErrores((e) => ({ ...e, [`p${indice}`]: mensajeDeError(err) }))
      }
    } else if (campo === 'cedula') {
      setPasajeros((actual) => actual.map((p, i) => (i === indice ? { ...p, registrado: null } : p)))
    }
  }

  const precioEstimado = (p) => {
    const d = descuentos.find((x) => String(x.id) === String(p.tipo_descuento_id))
    // Igual que el servidor: el descuento se redondea a centavos y se resta del precio
    const precio = Number(p.asiento.precio)
    return precio - Math.round(precio * Number(d?.porcentaje || 0)) / 100
  }
  const totalEstimado = pasajeros.reduce((s, p) => s + precioEstimado(p), 0)

  const revisarPasajeros = () => {
    const encontrados = {}
    pasajeros.forEach((p, i) => {
      const d = descuentos.find((x) => String(x.id) === String(p.tipo_descuento_id))
      if (!/^\d{10}$/.test(p.cedula)) encontrados[`p${i}`] = 'La cédula debe tener 10 números'
      else if (p.nombre.trim().split(/\s+/).length < 2) encontrados[`p${i}`] = 'Escribe nombre y apellido del pasajero'
      else if (esDescuentoPorEdad(d) && !p.registrado?.tiene_fecha_nacimiento && !p.fecha_nacimiento) {
        encontrados[`p${i}`] = `Para el descuento «${d.nombre}» escribe la fecha de nacimiento`
      }
    })
    setErrores(encontrados)
    if (Object.keys(encontrados).length === 0) setPaso(3)
  }

  // ── 4. Cobrar ─────────────────────────────────────────────────────
  const vender = async () => {
    setEnviando(true)
    setError('')
    try {
      const { data } = await api.post('/compras/ventanilla', {
        viaje_id: viaje.id,
        subida: Number(busqueda.origen),
        bajada: Number(busqueda.destino),
        pasajeros: pasajeros.map((p) => ({
          asiento_id: p.asiento.id,
          cedula: p.cedula.trim(),
          nombre: p.nombre.trim().replace(/\s+/g, ' '),
          tipo_descuento_id: p.tipo_descuento_id ? Number(p.tipo_descuento_id) : null,
          ...(p.fecha_nacimiento ? { fecha_nacimiento: p.fecha_nacimiento } : {}),
        })),
      })
      setVenta(data)
      cargarCaja()
    } catch (err) {
      const detalles = err.response?.data?.detalles
      setError(mensajeDeError(err) + (detalles ? ': ' + Object.values(detalles).join(' · ') : ''))
    } finally {
      setEnviando(false)
    }
  }

  const efectivo = Number(recibido || 0)

  // ── Venta registrada ──────────────────────────────────────────────
  if (venta) {
    const total = Number(venta.total)
    return (
      <div className="container mostrador">
        <div className="mostrador__listo card">
          <div className="card-body">
            <span className="mostrador__check"><Icono nombre="checkCirculo" tam={40} /></span>
            <h1>Venta registrada</h1>
            <p className="texto-suave">Compra N.º {venta.id} · {viaje.origen} → {viaje.destino} · {viaje.fecha} {viaje.hora_salida.slice(0, 5)} · Bus {viaje.numero_disco}</p>
            <div className="mostrador__totales">
              <div><span>Total cobrado</span><strong>{dinero(total)}</strong></div>
              {efectivo > 0 && <div><span>Recibido</span><strong>{dinero(efectivo)}</strong></div>}
              {efectivo > 0 && <div className="vuelto"><span>Vuelto</span><strong>{dinero(Math.max(efectivo - total, 0))}</strong></div>}
            </div>
            {efectivo > 0 && efectivo < total && <div className="alerta alerta--aviso">El efectivo recibido es menor que el total real ({dinero(total)}): cobra la diferencia de {dinero(total - efectivo)}.</div>}
            <table className="table">
              <thead><tr><th>Asiento</th><th>Pasajero</th><th>Precio</th><th aria-label="Boleto" /></tr></thead>
              <tbody>
                {venta.boletos.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.numero_asiento}</strong></td>
                    <td>{b.pasajero_nombre}</td>
                    <td>{dinero(b.precio_final)}</td>
                    <td className="text-right"><button type="button" className="btn btn-sm" onClick={() => abrirPdf(`/boletos/${b.codigo}/pdf`, setError)}>Imprimir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && <div className="alerta alerta--error">{error}</div>}
            <div className="mostrador__acciones">
              <button type="button" className="btn btn-primary btn--lg" onClick={() => abrirPdf(`/boletos/compra/${venta.id}/pdf`, setError)}>
                <Icono nombre="boleto" tam={18} /> Imprimir los {venta.boletos.length} boletos
              </button>
              <button type="button" className="btn btn--lg" onClick={reiniciar}><Icono nombre="mas" tam={18} /> Nueva venta</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mostrador">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Ventanilla</span>
          <h1>Vender boletos</h1>
          <p>Venta en oficina con pago en efectivo. Los boletos quedan emitidos al instante.</p>
        </div>
        {caja && (
          <div className="mostrador__caja" title="Ventas en efectivo que registraste hoy">
            <span>Hoy</span>
            <strong>{dinero(caja.total)}</strong>
            <small>{caja.boletos} boleto(s) · {caja.ventas} venta(s)</small>
          </div>
        )}
      </div>

      <ol className="mostrador__pasos">
        {PASOS.map((p, i) => (
          <li key={p} className={i === paso ? 'actual' : i < paso ? 'hecho' : ''}>
            <span>{i < paso ? <Icono nombre="check" tam={14} /> : i + 1}</span>{p}
          </li>
        ))}
      </ol>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}

      {/* 1. Viaje */}
      {paso === 0 && (
        <>
          <form className="card" onSubmit={buscar} noValidate>
            <div className="card-body mostrador__buscador">
              <div className={`campo ${errores.origen ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="v-origen">Origen</label>
                <ComboBuscador id="v-origen" opciones={opcionesCiudad} valor={busqueda.origen} placeholder="Provincia o cantón"
                  invalido={!!errores.origen} alCambiar={(valor) => setBusqueda({ ...busqueda, origen: valor })} />
                {errores.origen && <span className="campo__error">{errores.origen}</span>}
              </div>
              <button type="button" className="btn btn--icono mostrador__intercambiar" title="Intercambiar origen y destino"
                onClick={() => setBusqueda({ ...busqueda, origen: busqueda.destino, destino: busqueda.origen })}><Icono nombre="intercambiar" /></button>
              <div className={`campo ${errores.destino ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="v-destino">Destino</label>
                <ComboBuscador id="v-destino" opciones={opcionesCiudad} valor={busqueda.destino} placeholder="Provincia o cantón"
                  invalido={!!errores.destino} alCambiar={(valor) => setBusqueda({ ...busqueda, destino: valor })} />
                {errores.destino && <span className="campo__error">{errores.destino}</span>}
              </div>
              <div className={`campo ${errores.fecha ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="v-fecha">Fecha</label>
                <input id="v-fecha" type="date" min={hoy()} value={busqueda.fecha} onChange={(e) => setBusqueda({ ...busqueda, fecha: e.target.value })} />
              </div>
              <div className={`campo ${errores.pasajeros ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="v-pasajeros">Pasajeros</label>
                <select id="v-pasajeros" value={busqueda.pasajeros} onChange={(e) => setBusqueda({ ...busqueda, pasajeros: Number(e.target.value) })}>
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn--lg"><Icono nombre="buscar" tam={18} /> Buscar</button>
            </div>
          </form>

          {viajes && viajes.length === 0 && (
            <div className="vacio">
              <span className="vacio__icono"><Icono nombre="calendario" tam={30} /></span>
              <h3>No hay salidas con {cantidad} asiento(s) libre(s)</h3>
              <p>Prueba otra fecha u otro tramo de tu cooperativa.</p>
            </div>
          )}
          {viajes && viajes.length > 0 && (
            <div className="mostrador__viajes">
              {viajes.map((v) => (
                <article key={v.id} className="card mostrador__viaje">
                  <div className="card-body">
                    <div className="mostrador__horas">
                      <strong>{v.hora_salida.slice(0, 5)}</strong>
                      <span><Icono nombre="flecha" tam={16} /></span>
                      <strong>{horaMas(v.hora_salida, v.minutos_llegada)}</strong>
                    </div>
                    <p>{v.origen} → {v.destino}</p>
                    <div className="mostrador__chips">
                      <span className="insignia">Bus {v.numero_disco}</span>
                      <span className="insignia">{v.asientos_libres} libres</span>
                      <span className="insignia insignia--marca">desde {dinero(v.precio_desde)}</span>
                    </div>
                    <button type="button" className="btn btn-primary btn--bloque" onClick={() => elegirViaje(v)}>Elegir asientos</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Resumen del viaje elegido */}
      {paso > 0 && viaje && (
        <div className="mostrador__resumen card">
          <div className="card-body">
            <div>
              <strong>{viaje.origen} → {viaje.destino}</strong>
              <span>{viaje.fecha} · sale {viaje.hora_salida.slice(0, 5)} · Bus {viaje.numero_disco} ({viaje.placa})</span>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => { setPaso(0); setPasajeros([]) }}><Icono nombre="flechaIzq" tam={16} /> Cambiar viaje</button>
          </div>
        </div>
      )}

      {/* 2. Asientos */}
      {paso === 1 && (
        <div className="mostrador__dos">
          <div className="card"><div className="card-body">
            <h2 className="mostrador__titulo">Elige {cantidad} asiento(s)</h2>
            {aviso && <div className="alerta alerta--aviso" role="status">{aviso}</div>}
            <MapaBus asientos={asientos} elegidos={pasajeros.map((p) => p.asiento.id)} alElegir={alternarAsiento} />
          </div></div>
          <aside className="card"><div className="card-body">
            <h2 className="mostrador__titulo">Asientos elegidos <small>{pasajeros.length} de {cantidad}</small></h2>
            {pasajeros.length === 0 && <p className="texto-suave">Toca los asientos libres en el mapa.</p>}
            <ul className="mostrador__lista">
              {pasajeros.map((p) => <li key={p.asiento.id}><span>Asiento {p.asiento.numero} · {p.asiento.tipo_asiento}</span><strong>{dinero(p.asiento.precio)}</strong></li>)}
            </ul>
            <div className="mostrador__total"><span>Subtotal</span><strong>{dinero(pasajeros.reduce((s, p) => s + Number(p.asiento.precio), 0))}</strong></div>
            <button type="button" className="btn btn-primary btn--bloque" disabled={pasajeros.length !== cantidad} onClick={() => setPaso(2)}>
              Continuar con los pasajeros
            </button>
          </div></aside>
        </div>
      )}

      {/* 3. Pasajeros */}
      {paso === 2 && (
        <div className="card"><div className="card-body">
          <h2 className="mostrador__titulo">Datos de los pasajeros</h2>
          <p className="texto-suave">Un boleto por asiento. Si la persona ya está registrada, al escribir su cédula se completa el nombre.</p>
          {pasajeros.map((p, i) => {
            const d = descuentos.find((x) => String(x.id) === String(p.tipo_descuento_id))
            const pedirFecha = esDescuentoPorEdad(d) && !p.registrado?.tiene_fecha_nacimiento
            return (
              <fieldset key={p.asiento.id} className={`mostrador__pasajero ${errores[`p${i}`] ? 'con-error' : ''}`}>
                <legend>Asiento {p.asiento.numero} · {p.asiento.tipo_asiento} · {dinero(precioEstimado(p))}</legend>
                <div className="mostrador__campos">
                  <div className="campo">
                    <label className="campo__etiqueta" htmlFor={`ced-${i}`}>Cédula</label>
                    <input id={`ced-${i}`} inputMode="numeric" maxLength={10} value={p.cedula}
                      onChange={(e) => cambiarPasajero(i, 'cedula', e.target.value.replace(/\D/g, ''))} placeholder="0102030405" />
                    {p.registrado && <span className="campo__ayuda mostrador__registrado">✓ Pasajero registrado</span>}
                  </div>
                  <div className="campo">
                    <label className="campo__etiqueta" htmlFor={`nom-${i}`}>Nombre completo</label>
                    <input id={`nom-${i}`} value={p.nombre} maxLength={120} onChange={(e) => cambiarPasajero(i, 'nombre', e.target.value)} placeholder="Nombres y apellidos" />
                  </div>
                  <div className="campo">
                    <label className="campo__etiqueta" htmlFor={`des-${i}`}>Descuento</label>
                    <select id={`des-${i}`} value={p.tipo_descuento_id} onChange={(e) => cambiarPasajero(i, 'tipo_descuento_id', e.target.value)}>
                      <option value="">Sin descuento</option>
                      {descuentos.map((x) => <option key={x.id} value={x.id}>{x.nombre} (−{Number(x.porcentaje)} %)</option>)}
                    </select>
                  </div>
                  {pedirFecha && (
                    <div className="campo">
                      <label className="campo__etiqueta" htmlFor={`nac-${i}`}>Fecha de nacimiento</label>
                      <input id={`nac-${i}`} type="date" max={hoy()} value={p.fecha_nacimiento} onChange={(e) => cambiarPasajero(i, 'fecha_nacimiento', e.target.value)} />
                    </div>
                  )}
                </div>
                {d && /discapacidad/i.test(d.nombre) && <p className="campo__ayuda">Pide el carné de discapacidad antes de aplicar el descuento.</p>}
                {errores[`p${i}`] && <span className="campo__error">{errores[`p${i}`]}</span>}
              </fieldset>
            )
          })}
          <div className="mostrador__acciones">
            <button type="button" className="btn" onClick={() => setPaso(1)}><Icono nombre="flechaIzq" tam={16} /> Asientos</button>
            <button type="button" className="btn btn-primary btn--lg" onClick={revisarPasajeros}>Continuar al cobro</button>
          </div>
        </div></div>
      )}

      {/* 4. Cobro */}
      {paso === 3 && (
        <div className="mostrador__dos">
          <div className="card"><div className="card-body">
            <h2 className="mostrador__titulo">Detalle de la venta</h2>
            <table className="table">
              <thead><tr><th>Asiento</th><th>Pasajero</th><th>Descuento</th><th>Precio</th></tr></thead>
              <tbody>
                {pasajeros.map((p) => (
                  <tr key={p.asiento.id}>
                    <td>{p.asiento.numero}</td>
                    <td>{p.nombre}<small className="texto-suave" style={{ display: 'block' }}>{p.cedula}</small></td>
                    <td>{descuentos.find((x) => String(x.id) === String(p.tipo_descuento_id))?.nombre || '—'}</td>
                    <td>{dinero(precioEstimado(p))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="campo__ayuda">El sistema confirma los descuentos de edad con la fecha de nacimiento al registrar la venta.</p>
          </div></div>
          <aside className="card"><div className="card-body">
            <h2 className="mostrador__titulo">Cobro en efectivo</h2>
            <div className="mostrador__total mostrador__total--grande"><span>Total</span><strong>{dinero(totalEstimado)}</strong></div>
            <div className="campo">
              <label className="campo__etiqueta" htmlFor="recibido">Efectivo recibido</label>
              <input id="recibido" type="number" min={0} step="0.05" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder={totalEstimado.toFixed(2)} />
            </div>
            <div className="mostrador__billetes">
              {[1, 5, 10, 20, 50].map((b) => <button key={b} type="button" className="btn btn-sm" onClick={() => setRecibido(String(b))}>${b}</button>)}
              <button type="button" className="btn btn-sm" onClick={() => setRecibido(totalEstimado.toFixed(2))}>Exacto</button>
            </div>
            {recibido !== '' && (
              efectivo >= totalEstimado
                ? <div className="mostrador__total mostrador__vuelto"><span>Vuelto</span><strong>{dinero(efectivo - totalEstimado)}</strong></div>
                : <div className="alerta alerta--aviso">Faltan {dinero(totalEstimado - efectivo)}</div>
            )}
            <button type="button" className="btn btn-success btn--lg btn--bloque" disabled={enviando || (recibido !== '' && efectivo < totalEstimado)} onClick={vender}>
              {enviando ? 'Registrando…' : `Cobrar ${dinero(totalEstimado)} y emitir boletos`}
            </button>
            <button type="button" className="btn btn--bloque" style={{ marginTop: '.5rem' }} onClick={() => setPaso(2)}>Volver a pasajeros</button>
          </div></aside>
        </div>
      )}

      {/* Últimas ventas del día */}
      {paso === 0 && caja?.ultimas?.length > 0 && (
        <div className="card"><div className="card-header">Tus últimas ventas de hoy</div>
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Hora</th><th>Compra</th><th>Tramo</th><th>Boletos</th><th>Total</th><th aria-label="Imprimir" /></tr></thead>
              <tbody>
                {caja.ultimas.map((u) => (
                  <tr key={u.id}>
                    <td>{u.hora}</td><td>N.º {u.id}</td><td>{u.origen} → {u.destino}</td><td>{u.boletos}</td><td>{dinero(u.total)}</td>
                    <td className="text-right"><button type="button" className="btn btn-sm btn--fantasma" onClick={() => abrirPdf(`/boletos/compra/${u.id}/pdf`, setError)}>Reimprimir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
