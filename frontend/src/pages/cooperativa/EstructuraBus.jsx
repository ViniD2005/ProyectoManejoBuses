import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { useDialogo } from '../../hooks/useDialogo.jsx'
import './EstructuraBus.css'

/*
  GC-18 - Estructura (plantilla) de asientos de cada bus.
  Como en la compra de pasajes de avión: la cooperativa dibuja cada piso del bus
  (filas, asientos a cada lado del pasillo) y pinta qué asientos son Normal,
  VIP, Semicama… Lo que se guarda aquí es exactamente el mapa que ve el cliente.
*/
const DISTRIBUCIONES = [
  { izquierda: 2, derecha: 2, texto: '2 + 2', detalle: 'Convencional' },
  { izquierda: 2, derecha: 1, texto: '2 + 1', detalle: 'VIP / ejecutivo' },
  { izquierda: 1, derecha: 2, texto: '1 + 2', detalle: 'VIP invertido' },
  { izquierda: 1, derecha: 1, texto: '1 + 1', detalle: 'Cama' },
]
const COLORES = ['#e2e8f0', '#f6c453', '#7cc4a4', '#8fb4ef', '#e7a1c4', '#c9a7f0']
const QUITAR = 'quitar'

const clave = (fila, columna) => `${fila}-${columna}`

// Convierte la respuesta del servidor en pisos editables (celdas: "fila-columna" → tipo)
function aEditable(pisos) {
  return pisos.map((p) => ({
    piso: p.piso,
    filas: p.filas,
    izquierda: p.izquierda,
    derecha: p.derecha,
    sobrante: p.sobrante,
    celdas: Object.fromEntries(p.asientos.map((a) => [clave(a.fila, a.columna), a.tipo_asiento_id])),
  }))
}

// Llena un piso completo con un tipo de asiento
function lleno(piso, tipoId) {
  const celdas = {}
  for (let f = 1; f <= piso.filas; f++) {
    for (let c = 1; c <= piso.izquierda + 1 + piso.derecha; c++) if (c !== piso.izquierda + 1) celdas[clave(f, c)] = tipoId
  }
  return { ...piso, celdas }
}

// Números que tendrán los asientos al guardar (piso 1 primero, adelante → atrás, izquierda → derecha)
function numerar(pisos) {
  const numeros = {}
  let n = 0
  for (const p of pisos.filter((x) => !x.sobrante)) {
    const ordenadas = Object.keys(p.celdas)
      .map((k) => k.split('-').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    for (const [f, c] of ordenadas) numeros[`${p.piso}:${clave(f, c)}`] = ++n
  }
  return numeros
}

export default function EstructuraBus() {
  const [parametros, setParametros] = useSearchParams()
  const [buses, setBuses] = useState(null)
  const [busId, setBusId] = useState(parametros.get('bus') || '')
  const [datos, setDatos] = useState(null)
  const [pisos, setPisos] = useState([])
  const [pisoActivo, setPisoActivo] = useState(1)
  const [herramienta, setHerramienta] = useState(null)
  const [pintando, setPintando] = useState(false)
  const [cambios, setCambios] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [dialogo, preguntar] = useDialogo()

  useEffect(() => {
    api.get('/estructura-buses')
      .then(({ data }) => {
        setBuses(data)
        setBusId((actual) => actual || String(data[0]?.id || ''))
      })
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  useEffect(() => {
    if (!busId) return
    let activo = true
    api.get(`/estructura-buses/${busId}`)
      .then(({ data }) => {
        if (!activo) return
        setDatos(data)
        setPisos(aEditable(data.pisos))
        setPisoActivo(1)
        setCambios(false)
        const normal = data.tipos.find((t) => t.factor_precio === 1) || data.tipos[0]
        setHerramienta(normal?.id ?? null)
      })
      .catch((err) => activo && setError(mensajeDeError(err)))
    return () => { activo = false }
  }, [busId])

  // Al soltar el mouse en cualquier parte se deja de pintar
  useEffect(() => {
    const soltar = () => setPintando(false)
    window.addEventListener('mouseup', soltar)
    return () => window.removeEventListener('mouseup', soltar)
  }, [])

  const tipos = useMemo(() => datos?.tipos || [], [datos])
  const colorTipo = useMemo(() => Object.fromEntries(tipos.map((t, i) => [t.id, COLORES[i % COLORES.length]])), [tipos])
  const numeros = useMemo(() => numerar(pisos), [pisos])
  const bloqueado = (datos?.boletos_futuros || 0) > 0
  const piso = pisos.find((p) => p.piso === pisoActivo)
  const visibles = pisos.filter((p) => !p.sobrante)
  const total = visibles.reduce((s, p) => s + Object.keys(p.celdas).length, 0)
  const porTipo = tipos.map((t) => ({ ...t, cantidad: visibles.reduce((s, p) => s + Object.values(p.celdas).filter((x) => x === t.id).length, 0) }))
  const limites = datos?.limites || { min_asientos: 10, max_asientos: 80, max_filas: 25 }
  const tipoPorDefecto = (tipos.find((t) => t.factor_precio === 1) || tipos[0])?.id

  const elegirBus = async (id) => {
    if (cambios) {
      const ok = await preguntar({ titulo: '¿Descartar los cambios?', mensaje: 'Tienes cambios sin guardar en la estructura de este bus.', textoConfirmar: 'Descartar', tono: 'peligro' })
      if (!ok) return
    }
    setError('')
    setAviso('')
    setBusId(id)
    setParametros(id ? { bus: id } : {})
  }

  const actualizarPiso = (nuevo) => {
    setPisos(pisos.map((p) => (p.piso === nuevo.piso ? nuevo : p)))
    setCambios(true)
    setAviso('')
  }

  const pintar = (fila, columna) => {
    if (bloqueado || !piso || herramienta === null) return
    const celdas = { ...piso.celdas }
    if (herramienta === QUITAR) delete celdas[clave(fila, columna)]
    else celdas[clave(fila, columna)] = herramienta
    actualizarPiso({ ...piso, celdas })
  }

  const pintarFila = (fila) => {
    if (bloqueado || !piso) return
    const celdas = { ...piso.celdas }
    for (let c = 1; c <= piso.izquierda + 1 + piso.derecha; c++) {
      if (c === piso.izquierda + 1) continue
      if (herramienta === QUITAR) delete celdas[clave(fila, c)]
      else celdas[clave(fila, c)] = herramienta
    }
    actualizarPiso({ ...piso, celdas })
  }

  const cambiarFilas = (valor) => {
    const filas = Math.min(Math.max(Number(valor) || 1, 1), limites.max_filas)
    const celdas = Object.fromEntries(Object.entries(piso.celdas).filter(([k]) => Number(k.split('-')[0]) <= filas))
    // Las filas nuevas llegan llenas con el tipo normal
    for (let f = piso.filas + 1; f <= filas; f++) {
      for (let c = 1; c <= piso.izquierda + 1 + piso.derecha; c++) if (c !== piso.izquierda + 1) celdas[clave(f, c)] = tipoPorDefecto
    }
    actualizarPiso({ ...piso, filas, celdas })
  }

  const cambiarDistribucion = async (d) => {
    if (d.izquierda === piso.izquierda && d.derecha === piso.derecha) return
    if (Object.keys(piso.celdas).length) {
      const ok = await preguntar({
        titulo: `¿Cambiar el piso ${piso.piso} a ${d.texto}?`,
        mensaje: 'Las columnas cambian de lugar, así que el piso se vuelve a llenar con asientos del tipo normal. Luego puedes pintar los VIP.',
        textoConfirmar: 'Cambiar distribución',
      })
      if (!ok) return
    }
    actualizarPiso(lleno({ ...piso, izquierda: d.izquierda, derecha: d.derecha }, tipoPorDefecto))
  }

  const llenarPiso = () => actualizarPiso(lleno(piso, herramienta === QUITAR ? tipoPorDefecto : herramienta))
  const vaciarPiso = () => actualizarPiso({ ...piso, celdas: {} })

  const descartar = () => {
    setPisos(aEditable(datos.pisos))
    setCambios(false)
    setError('')
  }

  const guardar = async () => {
    setError('')
    if (total < limites.min_asientos || total > limites.max_asientos) {
      setError(`El bus debe tener entre ${limites.min_asientos} y ${limites.max_asientos} asientos (ahora tiene ${total}).`)
      return
    }
    const vacio = visibles.find((p) => Object.keys(p.celdas).length === 0)
    if (vacio) {
      setError(`El piso ${vacio.piso} no tiene asientos.`)
      return
    }
    const sobrante = pisos.find((p) => p.sobrante && Object.keys(p.celdas).length)
    const ok = await preguntar({
      titulo: `¿Guardar la estructura del disco ${datos.bus.numero_disco}?`,
      mensaje: 'Los asientos se numeran solos: piso 1 primero, de adelante hacia atrás y de izquierda a derecha. Así los verá el cliente al comprar.',
      detalle: (
        <>
          <span>Total: <strong>{total} asientos</strong></span>
          {porTipo.filter((t) => t.cantidad).map((t) => <span key={t.id}>{t.nombre}: <strong>{t.cantidad}</strong></span>)}
          {sobrante && <span>Se quitarán los asientos del piso {sobrante.piso} (el bus es de {datos.bus.pisos} piso).</span>}
        </>
      ),
      textoConfirmar: 'Guardar estructura',
      tono: 'exito',
    })
    if (!ok) return
    setGuardando(true)
    try {
      const cuerpo = {
        pisos: visibles.map((p) => ({
          filas: p.filas,
          izquierda: p.izquierda,
          derecha: p.derecha,
          asientos: Object.entries(p.celdas).map(([k, tipo]) => {
            const [fila, columna] = k.split('-').map(Number)
            return { fila, columna, tipo_asiento_id: tipo }
          }),
        })),
      }
      const { data } = await api.put(`/estructura-buses/${busId}`, cuerpo)
      setDatos(data)
      setPisos(aEditable(data.pisos))
      setCambios(false)
      setAviso(`Estructura guardada: ${total} asientos. Los clientes ya verán este mapa al comprar.`)
      setBuses((lista) => lista.map((b) => (String(b.id) === String(busId) ? { ...b, asientos: total } : b)))
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  if (buses === null) return <div className="cargando"><span className="giro" /> Cargando buses…</div>

  return (
    <div className="container estructura">
      {dialogo}
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Flota</span>
          <h1>Estructura de asientos</h1>
          <p>Dibuja cómo están distribuidos los asientos de cada bus y pinta cuáles son VIP, normales o del tipo que manejes.</p>
        </div>
      </div>

      {buses.length === 0 ? (
        <div className="vacio">
          <span className="vacio__icono"><Icono nombre="bus" tam={30} /></span>
          <h3>Aún no tienes buses</h3>
          <p>Registra un bus en la sección Buses para armar su estructura.</p>
        </div>
      ) : (
        <>
          <div className="card estructura__barra">
            <div className="card-body">
              <div className="campo">
                <label className="campo__etiqueta" htmlFor="estructura-bus">Bus</label>
                <select id="estructura-bus" value={busId} onChange={(e) => elegirBus(e.target.value)}>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      Disco {b.numero_disco} · {b.placa} · {b.pisos} piso{b.pisos > 1 ? 's' : ''} · {b.asientos} asientos{b.activo ? '' : ' (inactivo)'}
                    </option>
                  ))}
                </select>
              </div>
              {datos && (
                <div className="estructura__chips">
                  <span className="insignia insignia--marca">{total} asientos</span>
                  {porTipo.filter((t) => t.cantidad).map((t) => (
                    <span key={t.id} className="insignia" style={{ background: colorTipo[t.id], color: '#1f2937' }}>{t.cantidad} {t.nombre}</span>
                  ))}
                  {cambios && <span className="insignia insignia--aviso">Cambios sin guardar</span>}
                </div>
              )}
            </div>
          </div>

          {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
          {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}
          {bloqueado && (
            <div className="alerta alerta--aviso">
              <Icono nombre="llave" />
              <span>Este bus tiene <b>{datos.boletos_futuros} boleto(s) vendido(s)</b> para viajes de hoy en adelante. Su estructura se puede ver pero no cambiar hasta que pasen esos viajes.</span>
            </div>
          )}
          {tipos.length === 0 && datos && (
            <div className="alerta alerta--aviso"><Icono nombre="info" /> Primero crea tus tipos de asiento (Normal, VIP…) en «Tipos de asiento».</div>
          )}

          {datos && piso && (
            <div className="estructura__cuerpo">
              {/* Herramientas */}
              <aside className="card estructura__herramientas">
                <div className="card-body">
                  {pisos.length > 1 && (
                    <div className="pestanas" role="tablist" aria-label="Pisos">
                      {pisos.map((p) => (
                        <button key={p.piso} type="button" role="tab" aria-selected={p.piso === pisoActivo} onClick={() => setPisoActivo(p.piso)}>
                          Piso {p.piso}{p.sobrante ? ' (sobra)' : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  <h3 className="estructura__titulo">Distribución del piso {piso.piso}</h3>
                  <div className="estructura__distribuciones">
                    {DISTRIBUCIONES.map((d) => (
                      <button key={d.texto} type="button" disabled={bloqueado}
                        className={d.izquierda === piso.izquierda && d.derecha === piso.derecha ? 'activa' : ''}
                        onClick={() => cambiarDistribucion(d)}>
                        <strong>{d.texto}</strong><span>{d.detalle}</span>
                      </button>
                    ))}
                  </div>
                  <div className="campo">
                    <label className="campo__etiqueta" htmlFor="estructura-filas">Filas</label>
                    <div className="estructura__filas">
                      <button type="button" className="btn btn--icono" disabled={bloqueado || piso.filas <= 1} onClick={() => cambiarFilas(piso.filas - 1)} aria-label="Quitar fila">−</button>
                      <input id="estructura-filas" type="number" min={1} max={limites.max_filas} value={piso.filas} disabled={bloqueado}
                        onChange={(e) => cambiarFilas(e.target.value)} />
                      <button type="button" className="btn btn--icono" disabled={bloqueado || piso.filas >= limites.max_filas} onClick={() => cambiarFilas(piso.filas + 1)} aria-label="Agregar fila">+</button>
                    </div>
                  </div>

                  <h3 className="estructura__titulo">Pincel</h3>
                  <p className="texto-suave estructura__ayuda">Elige un tipo y haz clic (o arrastra) sobre los asientos. El número de fila pinta la fila completa.</p>
                  <div className="estructura__pinceles">
                    {tipos.map((t) => (
                      <button key={t.id} type="button" disabled={bloqueado} className={herramienta === t.id ? 'activo' : ''} onClick={() => setHerramienta(t.id)}>
                        <i style={{ background: colorTipo[t.id] }} />
                        <span><strong>{t.nombre}</strong><small>× {t.factor_precio.toFixed(2)} del precio</small></span>
                      </button>
                    ))}
                    <button type="button" disabled={bloqueado} className={herramienta === QUITAR ? 'activo' : ''} onClick={() => setHerramienta(QUITAR)}>
                      <i className="quitar" />
                      <span><strong>Quitar asiento</strong><small>Deja un espacio vacío</small></span>
                    </button>
                  </div>
                  <div className="estructura__rapidas">
                    <button type="button" className="btn btn-sm" disabled={bloqueado} onClick={llenarPiso}>Llenar piso</button>
                    <button type="button" className="btn btn-sm" disabled={bloqueado} onClick={vaciarPiso}>Vaciar piso</button>
                  </div>
                </div>
              </aside>

              {/* Dibujo del bus */}
              <div className="card estructura__lienzo">
                <div className="card-body">
                  {piso.sobrante && (
                    <div className="alerta alerta--aviso">El bus ahora es de {datos.bus.pisos} piso: estos asientos se quitarán al guardar.</div>
                  )}
                  <div className="estructura__bus" onMouseLeave={() => setPintando(false)}>
                    <div className="estructura__frente">
                      <span>{piso.piso === 1 ? 'Frente del bus' : `Piso ${piso.piso}`}</span>
                      {piso.piso === 1 && <span className="estructura__volante" title="Conductor">◎</span>}
                    </div>
                    <div className="estructura__rejilla"
                      style={{ gridTemplateColumns: `28px ${Array.from({ length: piso.izquierda + 1 + piso.derecha }, (_, i) => (i === piso.izquierda ? '24px' : '46px')).join(' ')}` }}>
                      {Array.from({ length: piso.filas }, (_, i) => i + 1).map((fila) => (
                        <div key={fila} className="estructura__fila" role="row">
                          <button type="button" className="estructura__numero-fila" disabled={bloqueado} onClick={() => pintarFila(fila)} title={`Pintar la fila ${fila}`}>{fila}</button>
                          {Array.from({ length: piso.izquierda + 1 + piso.derecha }, (_, i) => i + 1).map((columna) => {
                            if (columna === piso.izquierda + 1) return <span key={columna} className="estructura__pasillo" />
                            const tipo = piso.celdas[clave(fila, columna)]
                            const numero = numeros[`${piso.piso}:${clave(fila, columna)}`]
                            return (
                              <button key={columna} type="button" disabled={bloqueado}
                                className={`estructura__asiento ${tipo ? '' : 'estructura__asiento--vacio'}`}
                                style={tipo ? { background: colorTipo[tipo] } : undefined}
                                aria-label={tipo ? `Asiento ${numero}, ${tipos.find((t) => t.id === tipo)?.nombre}` : `Espacio vacío, fila ${fila}`}
                                onMouseDown={(e) => { e.preventDefault(); setPintando(true); pintar(fila, columna) }}
                                onMouseEnter={() => pintando && pintar(fila, columna)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pintar(fila, columna) } }}>
                                {tipo ? numero : ''}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                    <div className="estructura__fondo">Parte trasera</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {datos && !bloqueado && (
            <div className="estructura__acciones">
              {cambios && <button type="button" className="btn" onClick={descartar}>Descartar cambios</button>}
              <button type="button" className="btn btn-success btn--lg" disabled={!cambios || guardando} onClick={guardar}>
                <Icono nombre="checkCirculo" tam={18} /> {guardando ? 'Guardando…' : 'Guardar estructura'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
