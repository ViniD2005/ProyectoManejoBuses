import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { useDialogo } from '../../hooks/useDialogo.jsx'
import { MapaBus } from '../oficinista/VenderBoletos.jsx'
import { errorCedula, errorNombres } from '../../utils/validaciones.js'
import '../oficinista/VenderBoletos.css'
import './Chofer.css'

/*
  GC-34 - Viaje en curso del chofer.
    Validar   → escanea el QR (o escribe el código) y registra que el pasajero abordó.
    Pasajeros → manifiesto: asiento, pasajero, tramo, si ya abordó y si se vendió a bordo.
    Vender    → venta a bordo en efectivo, con el mapa real del bus y el vuelto.
    Finalizar → cierra el viaje con observaciones opcionales.
  Si el viaje ya terminó, la pantalla muestra solo el resumen y el manifiesto.
*/
const dinero = (n) => `$${Number(n || 0).toFixed(2)}`
const PESTANAS = [['validar', 'Validar boletos', 'qr'], ['pasajeros', 'Pasajeros', 'usuarios'], ['vender', 'Vender a bordo', 'boleto'], ['finalizar', 'Finalizar', 'check']]
const esDescuentoPorEdad = (d) => ['tercera_edad', 'menor_edad'].includes(d?.codigo)

// ── Validar boletos ───────────────────────────────────────────────
function Validar({ viajeId, alValidar }) {
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState(null)
  const [camara, setCamara] = useState(false)
  const [errorCamara, setErrorCamara] = useState('')
  const lector = useRef(null)
  const ultimo = useRef({ codigo: '', momento: 0 })

  const registrar = useCallback(async (texto) => {
    try {
      const { data } = await api.post(`/chofer/viajes/${viajeId}/validar`, { codigo: texto })
      setResultado({ ok: true, ...data })
      alValidar()
    } catch (err) {
      setResultado({ ok: false, mensaje: mensajeDeError(err) })
    }
  }, [viajeId, alValidar])

  // Al salir de la pestaña se apaga la cámara
  useEffect(() => () => { if (lector.current?.isScanning) lector.current.stop().catch(() => {}) }, [])

  const encender = async () => {
    setErrorCamara('')
    try {
      lector.current = new Html5Qrcode('lector-qr')
      await lector.current.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (texto) => {
        // El mismo código frente a la cámara no se registra dos veces seguidas
        const ahora = Date.now()
        if (texto === ultimo.current.codigo && ahora - ultimo.current.momento < 5000) return
        ultimo.current = { codigo: texto, momento: ahora }
        registrar(texto)
      }, () => {})
      setCamara(true)
    } catch {
      setErrorCamara('No se pudo abrir la cámara. Revisa los permisos del navegador o escribe el código del boleto.')
    }
  }

  const apagar = async () => {
    if (lector.current?.isScanning) await lector.current.stop().catch(() => {})
    setCamara(false)
  }

  const enviar = (e) => {
    e.preventDefault()
    const texto = codigo.trim()
    if (!texto) return setResultado({ ok: false, mensaje: 'Escribe el código que aparece debajo del QR del boleto' })
    registrar(texto)
    setCodigo('')
  }

  return (
    <section className="card"><div className="card-body">
      <p style={{ marginTop: 0 }}>Escanea el código QR del boleto de cada pasajero cuando sube al bus.</p>
      <div id="lector-qr" className="chofer__lector" />
      {!camara
        ? <button type="button" className="btn btn-primary" onClick={encender}><Icono nombre="qr" /> Activar cámara</button>
        : <button type="button" className="btn" onClick={apagar}>Apagar cámara</button>}
      {errorCamara && <div className="alerta alerta--aviso" style={{ marginTop: '0.75rem' }}><Icono nombre="alerta" /> {errorCamara}</div>}
      <form className="chofer__manual" onSubmit={enviar}>
        <label className="sr-only" htmlFor="codigo">Código del boleto</label>
        <input id="codigo" className="form-control" placeholder="O escribe el código del boleto" value={codigo}
          maxLength={36} autoComplete="off" onChange={(e) => setCodigo(e.target.value)} />
        <button type="submit" className="btn">Validar</button>
      </form>
      {resultado && (
        <div className={`chofer__resultado ${resultado.ok ? 'chofer__resultado--ok' : 'chofer__resultado--mal'}`} role="status">
          <h2>{resultado.ok ? '✔' : '✘'} {resultado.mensaje}</h2>
          {resultado.ok && <div>{resultado.pasajero} · C.I. {resultado.cedula} · Asiento <b>{resultado.asiento}</b> · {resultado.tramo}</div>}
        </div>
      )}
    </div></section>
  )
}

// ── Manifiesto ────────────────────────────────────────────────────
function Pasajeros({ pasajeros }) {
  const [filtro, setFiltro] = useState('todos')
  const lista = pasajeros.filter((p) => filtro === 'todos' || (filtro === 'faltan' ? p.estado === 'emitido' : p.estado === 'usado'))
  const faltan = pasajeros.filter((p) => p.estado === 'emitido').length
  return (
    <section className="card">
      <div className="card-header fila fila--entre">
        <span>{pasajeros.length} pasajero(s) · {faltan} por abordar</span>
        <select className="form-control" style={{ maxWidth: 200 }} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar pasajeros">
          <option value="todos">Todos</option>
          <option value="faltan">Por abordar</option>
          <option value="abordaron">Ya abordaron</option>
        </select>
      </div>
      {lista.length === 0
        ? <div className="card-body chofer__dato">No hay pasajeros en esta lista.</div>
        : (
          <div className="table-responsive"><table className="table">
            <thead><tr><th>Asiento</th><th>Pasajero</th><th>Tramo</th><th>Estado</th></tr></thead>
            <tbody>
              {lista.map((p) => (
                <tr key={p.id}>
                  <td><b>{p.asiento}</b> <span className="chofer__dato">{p.tipo_asiento}</span></td>
                  <td>{p.pasajero_nombre}<div className="chofer__dato">C.I. {p.pasajero_cedula}</div></td>
                  <td>{p.sube_en} → {p.baja_en}</td>
                  <td>
                    {p.estado === 'usado'
                      ? <span className="insignia insignia--exito">A bordo {p.abordo_hora}</span>
                      : <span className="insignia insignia--aviso">Por abordar</span>}
                    {p.a_bordo && <span className="insignia insignia--marca" style={{ marginLeft: 4 }}>Vendido a bordo</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
    </section>
  )
}

// ── Venta a bordo ─────────────────────────────────────────────────
function Vender({ viaje, alVender }) {
  const [tramo, setTramo] = useState({ subida: String(viaje.paradas[0]?.ciudad_id || ''), bajada: String(viaje.paradas.at(-1)?.ciudad_id || '') })
  const [asientos, setAsientos] = useState([])
  const [pasajeros, setPasajeros] = useState([])
  const [descuentos, setDescuentos] = useState([])
  const [recibido, setRecibido] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [venta, setVenta] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const ordenDe = (id) => viaje.paradas.find((p) => String(p.ciudad_id) === String(id))?.orden || 0
  const tramoValido = ordenDe(tramo.subida) > 0 && ordenDe(tramo.subida) < ordenDe(tramo.bajada)

  const cargarAsientos = useCallback(() => {
    if (!tramoValido) return
    api.get(`/viajes/${viaje.id}/asientos`, { params: tramo })
      .then(({ data }) => setAsientos(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [viaje.id, tramo, tramoValido])

  useEffect(() => { api.get('/compras/catalogos').then(({ data }) => setDescuentos(data.tipos_descuento || [])).catch(() => {}) }, [])
  useEffect(() => { cargarAsientos() }, [cargarAsientos])

  // Al cambiar el tramo cambian la disponibilidad y el precio: se vuelve a elegir
  const cambiarTramo = (campo, valor) => { setPasajeros([]); setAsientos([]); setTramo((t) => ({ ...t, [campo]: valor })) }

  const alternar = (a) => {
    if (pasajeros.some((p) => p.asiento.id === a.id)) setPasajeros(pasajeros.filter((p) => p.asiento.id !== a.id))
    else if (pasajeros.length >= 10) setError('Puedes vender hasta 10 boletos a la vez')
    else setPasajeros([...pasajeros, { asiento: a, cedula: '', nombre: '', tipo_descuento_id: '', fecha_nacimiento: '', registrado: null }])
  }

  const cambiar = async (i, campo, valor) => {
    setPasajeros((lista) => lista.map((p, j) => (j === i ? { ...p, [campo]: valor, ...(campo === 'cedula' ? { registrado: null } : {}) } : p)))
    setErrores((e) => ({ ...e, [`p${i}`]: '' }))
    // Si la persona está registrada se completa su nombre
    if (campo === 'cedula' && !errorCedula(valor)) {
      try {
        const { data } = await api.get('/compras/pasajero', { params: { cedula: valor } })
        if (data.registrado) setPasajeros((lista) => lista.map((p, j) => (j === i ? { ...p, registrado: data, nombre: data.nombre } : p)))
      } catch { /* sin datos: se escribe a mano */ }
    }
  }

  const precio = (p) => {
    const d = descuentos.find((x) => String(x.id) === String(p.tipo_descuento_id))
    const base = Number(p.asiento.precio)
    return base - Math.round(base * Number(d?.porcentaje || 0)) / 100
  }
  const total = pasajeros.reduce((s, p) => s + precio(p), 0)
  const efectivo = Number(recibido || 0)

  const revisar = () => {
    const encontrados = {}
    pasajeros.forEach((p, i) => {
      const d = descuentos.find((x) => String(x.id) === String(p.tipo_descuento_id))
      const problema = errorCedula(p.cedula) || errorNombres(p.nombre, 'los nombres y apellidos')
      if (problema) encontrados[`p${i}`] = problema
      else if (p.nombre.trim().split(/\s+/).length < 2) encontrados[`p${i}`] = 'Escribe al menos un nombre y un apellido'
      else if (esDescuentoPorEdad(d) && !p.registrado?.tiene_fecha_nacimiento && !p.fecha_nacimiento) encontrados[`p${i}`] = `Para el descuento «${d.nombre}» escribe la fecha de nacimiento`
    })
    if (new Set(pasajeros.map((p) => p.cedula.trim())).size !== pasajeros.length) encontrados.general = 'No repitas la misma cédula en dos asientos'
    if (recibido !== '' && (Number.isNaN(efectivo) || efectivo < 0)) encontrados.recibido = 'Escribe un valor válido'
    else if (recibido !== '' && efectivo < total) encontrados.recibido = `Faltan ${dinero(total - efectivo)} para completar el pago`
    setErrores(encontrados)
    return Object.keys(encontrados).length === 0
  }

  const vender = async (e) => {
    e.preventDefault()
    setError('')
    if (!pasajeros.length) return setError('Toca en el mapa los asientos que vas a vender')
    if (!revisar()) return
    setEnviando(true)
    try {
      const { data } = await api.post(`/chofer/viajes/${viaje.id}/vender`, {
        subida: Number(tramo.subida),
        bajada: Number(tramo.bajada),
        pasajeros: pasajeros.map((p) => ({
          asiento_id: p.asiento.id,
          cedula: p.cedula.trim(),
          nombre: p.nombre.trim().replace(/\s+/g, ' '),
          tipo_descuento_id: p.tipo_descuento_id ? Number(p.tipo_descuento_id) : null,
          ...(p.fecha_nacimiento ? { fecha_nacimiento: p.fecha_nacimiento } : {}),
        })),
      })
      setVenta({ ...data, recibido: efectivo })
      alVender()
    } catch (err) {
      const detalles = err.response?.data?.detalles
      setError(mensajeDeError(err) + (detalles ? ': ' + Object.values(detalles).join(' · ') : ''))
      cargarAsientos()
    } finally {
      setEnviando(false)
    }
  }

  const otraVenta = () => { setVenta(null); setPasajeros([]); setRecibido(''); setErrores({}); cargarAsientos() }

  if (venta) {
    return (
      <section className="card"><div className="card-body">
        <div className="alerta alerta--exito"><Icono nombre="check" /><div><b>Venta N.º {venta.id} registrada</b><div>Los pasajeros ya constan a bordo.</div></div></div>
        <div className="chofer__total"><span>Total cobrado</span><strong>{dinero(venta.total)}</strong></div>
        {venta.recibido > 0 && <div className="chofer__total"><span>Vuelto</span><span className="chofer__vuelto">{dinero(Math.max(venta.recibido - venta.total, 0))}</span></div>}
        <ul>{venta.boletos.map((b) => <li key={b.id}>Asiento {b.numero_asiento} · {b.pasajero_nombre} · {dinero(b.precio_final)}</li>)}</ul>
        <button type="button" className="btn btn-primary" onClick={otraVenta}>Nueva venta</button>
      </div></section>
    )
  }

  return (
    <form className="chofer__venta" onSubmit={vender} noValidate>
      <section className="card"><div className="card-body">
        <div className="rejilla-2" style={{ marginBottom: '1rem' }}>
          <div>
            <label className="form-label" htmlFor="subida">Sube en</label>
            <select id="subida" className="form-control" value={tramo.subida} onChange={(e) => cambiarTramo('subida', e.target.value)}>
              {viaje.paradas.slice(0, -1).map((p) => <option key={p.ciudad_id} value={p.ciudad_id}>{p.ciudad}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="bajada">Baja en</label>
            <select id="bajada" className="form-control" value={tramo.bajada} onChange={(e) => cambiarTramo('bajada', e.target.value)}>
              {viaje.paradas.slice(1).map((p) => <option key={p.ciudad_id} value={p.ciudad_id}>{p.ciudad}</option>)}
            </select>
          </div>
        </div>
        {!tramoValido
          ? <div className="alerta alerta--aviso"><Icono nombre="alerta" /> La ciudad de bajada debe estar después de la de subida.</div>
          : <MapaBus asientos={asientos} elegidos={pasajeros.map((p) => p.asiento.id)} alElegir={alternar} />}
      </div></section>

      <section className="card"><div className="card-body">
        <h2 style={{ marginTop: 0 }}>Pasajeros</h2>
        {pasajeros.length === 0 && <p className="chofer__dato">Toca los asientos libres en el mapa.</p>}
        {pasajeros.map((p, i) => {
          const d = descuentos.find((x) => String(x.id) === String(p.tipo_descuento_id))
          return (
            <fieldset key={p.asiento.id} className="chofer__pasajero">
              <legend>Asiento {p.asiento.numero} · {dinero(precio(p))}</legend>
              <input className="form-control" inputMode="numeric" maxLength={10} placeholder="Cédula" aria-label={`Cédula del pasajero ${i + 1}`}
                value={p.cedula} onChange={(e) => cambiar(i, 'cedula', e.target.value.replace(/\D/g, ''))} />
              <input className="form-control" maxLength={120} placeholder="Nombres y apellidos" aria-label={`Nombre del pasajero ${i + 1}`}
                value={p.nombre} onChange={(e) => cambiar(i, 'nombre', e.target.value)} />
              <select className="form-control" value={p.tipo_descuento_id} onChange={(e) => cambiar(i, 'tipo_descuento_id', e.target.value)} aria-label={`Descuento del pasajero ${i + 1}`}>
                <option value="">Sin descuento</option>
                {descuentos.map((x) => <option key={x.id} value={x.id}>{x.nombre} (−{Number(x.porcentaje)} %)</option>)}
              </select>
              {esDescuentoPorEdad(d) && !p.registrado?.tiene_fecha_nacimiento && (
                <input className="form-control" type="date" aria-label="Fecha de nacimiento" max={new Date().toLocaleDateString('en-CA')}
                  value={p.fecha_nacimiento} onChange={(e) => cambiar(i, 'fecha_nacimiento', e.target.value)} />
              )}
              {errores[`p${i}`] && <span className="chofer__error">{errores[`p${i}`]}</span>}
            </fieldset>
          )
        })}
        {errores.general && <p className="chofer__error">{errores.general}</p>}
        <div className="chofer__total"><span>Total a cobrar</span><strong>{dinero(total)}</strong></div>
        <label className="form-label" htmlFor="recibido">Efectivo recibido (opcional)</label>
        <input id="recibido" className="form-control" type="number" min={0} step="0.05" placeholder={total.toFixed(2)}
          value={recibido} onChange={(e) => { setRecibido(e.target.value); setErrores({ ...errores, recibido: '' }) }} />
        {errores.recibido && <span className="chofer__error">{errores.recibido}</span>}
        {recibido !== '' && efectivo >= total && total > 0 && <p>Vuelto: <span className="chofer__vuelto">{dinero(efectivo - total)}</span></p>}
        {error && <div className="alerta alerta--error" role="alert" style={{ marginTop: '0.75rem' }}><Icono nombre="alerta" /> {error}</div>}
        <button type="submit" className="btn btn-primary btn--bloque btn--lg" style={{ marginTop: '1rem' }} disabled={enviando || !pasajeros.length}>
          {enviando ? 'Registrando…' : `Cobrar ${dinero(total)} en efectivo`}
        </button>
      </div></section>
    </form>
  )
}

// ── Finalizar ─────────────────────────────────────────────────────
function Finalizar({ viaje, alFinalizar }) {
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState('')
  const [dialogo, preguntar] = useDialogo()
  const faltan = viaje.boletos - viaje.abordados

  const finalizar = async (e) => {
    e.preventDefault()
    setError('')
    const texto = observaciones.trim()
    if (texto.length > 300) return setError('Las observaciones pueden tener hasta 300 caracteres')
    if (/[<>{}]/.test(texto)) return setError('Quita los caracteres < > { } de las observaciones')
    const ok = await preguntar({
      titulo: '¿Finalizar el viaje?',
      mensaje: faltan > 0
        ? `${faltan} pasajero(s) con boleto no abordaron. Al finalizar ya no podrás validar boletos ni vender a bordo.`
        : 'Al finalizar ya no podrás validar boletos ni vender a bordo.',
      textoConfirmar: 'Finalizar viaje',
      tono: 'peligro',
    })
    if (!ok) return
    try {
      await api.post(`/chofer/viajes/${viaje.id}/finalizar`, { observaciones: texto })
      alFinalizar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  return (
    <>
    {dialogo}
    <form className="card" onSubmit={finalizar}><div className="card-body">
      <div className="chofer__cifras" style={{ marginBottom: '1rem' }}>
        <span><b>{viaje.abordados}</b> de {viaje.boletos} a bordo</span>
        <span><b>{viaje.vendidos_a_bordo}</b> vendidos a bordo</span>
        <span><b>{dinero(viaje.recaudado_a_bordo)}</b> en efectivo para entregar</span>
      </div>
      <label className="form-label" htmlFor="observaciones">Observaciones (opcional)</label>
      <textarea id="observaciones" className="form-control" rows={3} maxLength={300} placeholder="Ej.: Llegamos 15 minutos tarde por un cierre de vía en Latacunga"
        value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
      <div className="chofer__dato">{observaciones.length}/300</div>
      {error && <div className="alerta alerta--error" role="alert" style={{ marginTop: '0.75rem' }}><Icono nombre="alerta" /> {error}</div>}
      <button type="submit" className="btn btn-danger" style={{ marginTop: '1rem' }}>Finalizar viaje</button>
    </div></form>
    </>
  )
}

export default function ViajeEnCurso() {
  const { id } = useParams()
  const navegar = useNavigate()
  const [viaje, setViaje] = useState(null)
  const [pestana, setPestana] = useState('validar')
  const [error, setError] = useState('')

  const cargar = useCallback(() => api.get(`/chofer/viajes/${id}`)
    .then(({ data }) => setViaje(data))
    .catch((err) => setError(mensajeDeError(err))), [id])

  useEffect(() => { cargar() }, [cargar])

  if (error && !viaje) {
    return (
      <div className="container">
        <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>
        <button type="button" className="btn" onClick={() => navegar('/chofer')}>Volver a los viajes de hoy</button>
      </div>
    )
  }
  if (!viaje) return <div className="container"><div className="cargando"><span className="giro" /> Cargando el viaje…</div></div>

  const enCurso = viaje.estado === 'en_curso' && viaje.es_mio
  const hora = (t) => (t ? new Date(t).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '—')

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">{enCurso ? 'Viaje en curso' : viaje.estado === 'finalizado' ? 'Viaje finalizado' : 'Viaje'}</span>
          <h1>{viaje.origen} → {viaje.destino}</h1>
          <p>{viaje.fecha} · salida {viaje.hora_salida.slice(0, 5)} · Bus {viaje.numero_disco} ({viaje.placa}) · Inicio {hora(viaje.iniciado_en)}{viaje.finalizado_en ? ` · Fin ${hora(viaje.finalizado_en)}` : ''}</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn" onClick={() => navegar('/chofer')}>Viajes de hoy</button>
        </div>
      </div>

      <div className="rejilla-4" style={{ marginBottom: '1.5rem' }}>
        {[['usuarios', viaje.boletos, 'Pasajeros con boleto'], ['qr', viaje.abordados, 'A bordo'], ['boleto', viaje.vendidos_a_bordo, 'Vendidos a bordo'], ['dinero', dinero(viaje.recaudado_a_bordo), 'Recaudado a bordo']].map(([icono, valor, texto]) => (
          <div key={texto} className="indicador">
            <span className="indicador__icono"><Icono nombre={icono} tam={22} /></span>
            <div><div className="indicador__valor">{valor}</div><div className="indicador__texto">{texto}</div></div>
          </div>
        ))}
      </div>

      {!enCurso && viaje.observaciones && <div className="alerta alerta--info"><Icono nombre="info" /><div><b>Observaciones del chofer</b><div>{viaje.observaciones}</div></div></div>}

      {enCurso ? (
        <>
          <div className="pestanas" role="tablist">
            {PESTANAS.map(([clave, texto, icono]) => (
              <button key={clave} type="button" role="tab" aria-selected={pestana === clave} onClick={() => setPestana(clave)}>
                <Icono nombre={icono} tam={16} /> {texto}
              </button>
            ))}
          </div>
          {pestana === 'validar' && <Validar viajeId={viaje.id} alValidar={cargar} />}
          {pestana === 'pasajeros' && <Pasajeros pasajeros={viaje.pasajeros} />}
          {pestana === 'vender' && <Vender viaje={viaje} alVender={cargar} />}
          {pestana === 'finalizar' && <Finalizar viaje={viaje} alFinalizar={() => { cargar(); setPestana('pasajeros') }} />}
        </>
      ) : <Pasajeros pasajeros={viaje.pasajeros} />}
    </div>
  )
}
