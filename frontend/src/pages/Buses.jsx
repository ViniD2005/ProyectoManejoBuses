import { useEffect, useMemo, useState } from 'react'
import api, { mensajeDeError } from '../services/api.js'
import Icono from '../components/Icono.jsx'
import { useDialogo } from '../hooks/useDialogo.jsx'
import './Buses.css'

/*
  GC-20 - Flota de la cooperativa.
  Tabla con todos los buses (búsqueda y filtros) y un panel lateral para
  registrar o editar la ficha completa: identificación, fabricación,
  capacidad, servicios a bordo, matrícula, observaciones y foto.
*/
const FORM_VACIO = {
  numero_disco: '',
  placa: '',
  numero_chasis: '',
  numero_motor: '',
  marca_chasis: '',
  marca_carroceria: '',
  anio_fabricacion: '',
  pisos: 1,
  cantidad_asientos: 40,
  tipo_asiento_id: '',
  servicios: [],
  vence_matricula: '',
  observaciones: '',
}

const ICONO_SERVICIO = { wifi: '📶', bano: '🚻', aire: '❄️', tv: '📺', usb: '🔌', reclinables: '💺', bodega: '🧳', accesible: '♿' }
const anioActual = new Date().getFullYear()
const hoy = () => new Date().toLocaleDateString('en-CA')

// Estado de la matrícula: vencida, por vencer (30 días) o al día
function estadoMatricula(fecha) {
  if (!fecha) return null
  const dias = Math.round((new Date(`${fecha}T12:00:00`) - new Date(`${hoy()}T12:00:00`)) / 86400000)
  if (dias < 0) return { clase: 'insignia--error', texto: 'Matrícula vencida' }
  if (dias <= 30) return { clase: 'insignia--aviso', texto: `Matrícula vence en ${dias} día${dias === 1 ? '' : 's'}` }
  return null
}

export default function Buses() {
  const [buses, setBuses] = useState(null)
  const [tipos, setTipos] = useState([])
  const [marcas, setMarcas] = useState([])
  const [servicios, setServicios] = useState([])
  const [form, setForm] = useState(null) // null = panel cerrado
  const [idEdicion, setIdEdicion] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState('todos')
  const [dialogo, preguntar] = useDialogo()

  const cargarBuses = () =>
    api.get('/buses')
      .then(({ data }) => setBuses(data))
      .catch((err) => { setBuses([]); setError(mensajeDeError(err)) })

  useEffect(() => {
    cargarBuses()
    api.get('/tipos-asiento').then(({ data }) => setTipos(data)).catch(() => {})
    api.get('/marcas').then(({ data }) => setMarcas(data)).catch(() => {})
    api.get('/buses/servicios').then(({ data }) => setServicios(data)).catch(() => {})
  }, [])

  const visibles = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return (buses || []).filter((b) =>
      (estado === 'todos' || (estado === 'activos' ? b.activo : !b.activo)) &&
      (!q || [b.numero_disco, b.placa, b.marca_chasis, b.marca_carroceria, b.numero_chasis].some((x) => String(x || '').toLowerCase().includes(q))))
  }, [buses, texto, estado])

  const resumen = useMemo(() => ({
    total: buses?.length || 0,
    activos: buses?.filter((b) => b.activo).length || 0,
    asientos: buses?.filter((b) => b.activo).reduce((s, b) => s + b.total_asientos, 0) || 0,
    matriculas: buses?.filter((b) => estadoMatricula(b.vence_matricula)).length || 0,
  }), [buses])

  const abrirNuevo = () => {
    const normal = tipos.find((t) => Number(t.factor_precio) === 1) || tipos[0]
    setForm({ ...FORM_VACIO, tipo_asiento_id: normal?.id || '' })
    setIdEdicion(null)
    setErrores({})
    setError('')
  }

  const abrirEdicion = (bus) => {
    setForm({
      ...FORM_VACIO,
      ...bus,
      anio_fabricacion: bus.anio_fabricacion || '',
      numero_chasis: bus.numero_chasis || '',
      numero_motor: bus.numero_motor || '',
      vence_matricula: bus.vence_matricula || '',
      observaciones: bus.observaciones || '',
      servicios: bus.servicios || [],
    })
    setIdEdicion(bus.id)
    setErrores({})
    setError('')
  }

  const cerrar = () => { setForm(null); setIdEdicion(null); setErrores({}) }

  const cambiar = (e) => {
    let { name, value } = e.target
    if (name === 'placa') value = value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8)
    if (name === 'numero_chasis') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17)
    if (name === 'numero_motor') value = value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 30)
    if (name === 'numero_disco') value = value.replace(/\D/g, '').slice(0, 4)
    setForm({ ...form, [name]: value })
    setErrores({ ...errores, [name]: '' })
  }

  const alternarServicio = (clave) => {
    const lista = form.servicios.includes(clave) ? form.servicios.filter((s) => s !== clave) : [...form.servicios, clave]
    setForm({ ...form, servicios: lista })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setErrores({})
    try {
      if (idEdicion) {
        await api.put(`/buses/${idEdicion}`, form)
        setAviso(`Bus disco ${form.numero_disco} actualizado.`)
      } else {
        const { data } = await api.post('/buses', form)
        setAviso(`Bus disco ${data.numero_disco} registrado con ${data.total_asientos} asientos. Ajusta cuáles son VIP en «Estructura de asientos».`)
      }
      cerrar()
      cargarBuses()
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
      setError(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  // CC-17: foto del bus (desde el panel de edición)
  const subirFoto = async (archivo) => {
    if (!archivo || !idEdicion) return
    setError('')
    try {
      const datos = new FormData()
      datos.append('foto', archivo)
      const { data } = await api.post(`/buses/${idEdicion}/foto`, datos)
      setForm({ ...form, foto_url: data.foto_url })
      setAviso(`Foto del bus disco ${form.numero_disco} actualizada.`)
      cargarBuses()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const alternarEstado = async (bus) => {
    if (bus.activo) {
      const ok = await preguntar({
        titulo: `¿Desactivar el bus disco ${bus.numero_disco}?`,
        mensaje: bus.viajes_programados > 0
          ? `Tiene ${bus.viajes_programados} viaje(s) programado(s) de hoy en adelante: reasígnalos en la hoja de ruta. Un bus inactivo no entra en las próximas hojas de ruta.`
          : 'Un bus inactivo no entra en las próximas hojas de ruta (por ejemplo, mientras está en el taller).',
        textoConfirmar: 'Desactivar',
        tono: 'peligro',
      })
      if (!ok) return
    }
    setError('')
    try {
      await api.patch(`/buses/${bus.id}/estado`, { activo: !bus.activo })
      setAviso(bus.activo ? `Bus disco ${bus.numero_disco} desactivado.` : `Bus disco ${bus.numero_disco} activado.`)
      cargarBuses()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const campo = (name, etiqueta, props = {}, ayuda = '') => (
    <div className={`campo ${errores[name] ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={`bus-${name}`}>{etiqueta}</label>
      <input id={`bus-${name}`} name={name} value={form[name] ?? ''} onChange={cambiar} aria-invalid={!!errores[name]} {...props} />
      {errores[name] ? <span className="campo__error">{errores[name]}</span> : ayuda && <span className="campo__ayuda">{ayuda}</span>}
    </div>
  )

  // GC-13: la marca se elige de la lista; si el bus tiene una marca desactivada, se sigue mostrando
  const selectorMarca = (name, tipo, etiqueta) => {
    const lista = marcas.filter((m) => m.tipo === tipo)
    const fueraDeLista = form[name] && !lista.some((m) => m.nombre === form[name])
    return (
      <div className={`campo ${errores[name] ? 'campo--error' : ''}`}>
        <label className="campo__etiqueta" htmlFor={`bus-${name}`}>{etiqueta}</label>
        <select id={`bus-${name}`} name={name} value={form[name]} onChange={cambiar}>
          <option value="">Elige una marca</option>
          {fueraDeLista && <option value={form[name]}>{form[name]} (ya no está en el catálogo)</option>}
          {lista.map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
        </select>
        {errores[name]
          ? <span className="campo__error">{errores[name]}</span>
          : <span className="campo__ayuda">¿No está la marca? Pídele al administrador que la agregue.</span>}
      </div>
    )
  }

  if (buses === null) return <div className="cargando"><span className="giro" /> Cargando la flota…</div>

  return (
    <div className="container">
      {dialogo}
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Flota</span>
          <h1>Buses</h1>
          <p>La ficha de cada unidad de tu cooperativa. Los buses inactivos (en taller, por ejemplo) no entran en la hoja de ruta.</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn btn-primary" onClick={abrirNuevo}><Icono nombre="mas" tam={18} /> Nuevo bus</button>
        </div>
      </div>

      <div className="rejilla-4 flota__resumen">
        <div className="indicador"><span className="indicador__icono"><Icono nombre="bus" /></span><div><div className="indicador__valor">{resumen.total}</div><div className="indicador__texto">buses registrados</div></div></div>
        <div className="indicador"><span className="indicador__icono"><Icono nombre="checkCirculo" /></span><div><div className="indicador__valor">{resumen.activos}</div><div className="indicador__texto">activos</div></div></div>
        <div className="indicador"><span className="indicador__icono"><Icono nombre="asiento" /></span><div><div className="indicador__valor">{resumen.asientos}</div><div className="indicador__texto">asientos en servicio</div></div></div>
        <div className="indicador"><span className="indicador__icono"><Icono nombre="documento" /></span><div><div className="indicador__valor">{resumen.matriculas}</div><div className="indicador__texto">matrículas por renovar</div></div></div>
      </div>

      {error && !form && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}

      <div className="card">
        <div className="card-body flota__filtros">
          <div className="campo flota__buscar">
            <label className="campo__etiqueta" htmlFor="flota-buscar">Buscar</label>
            <input id="flota-buscar" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Disco, placa, marca o chasis" />
          </div>
          <div className="pestanas" role="tablist" aria-label="Estado">
            {[['todos', 'Todos'], ['activos', 'Activos'], ['inactivos', 'Inactivos']].map(([valor, etiqueta]) => (
              <button key={valor} type="button" role="tab" aria-selected={estado === valor} onClick={() => setEstado(valor)}>{etiqueta}</button>
            ))}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table flota__tabla">
            <thead>
              <tr>
                <th>Bus</th><th>Marcas</th><th>Capacidad</th><th>Servicios</th><th>Estado</th><th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((bus) => {
                const matricula = estadoMatricula(bus.vence_matricula)
                return (
                  <tr key={bus.id} className={bus.activo ? '' : 'flota__inactivo'}>
                    <td>
                      <div className="flota__bus">
                        {bus.foto_url
                          ? <img src={bus.foto_url} alt="" />
                          : <span className="flota__sin-foto"><Icono nombre="bus" tam={22} /></span>}
                        <div>
                          <strong>Disco {bus.numero_disco}</strong>
                          <span>{bus.placa}{bus.anio_fabricacion ? ` · ${bus.anio_fabricacion}` : ''}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="flota__dato">{bus.marca_chasis}</span><span className="texto-suave flota__dato">{bus.marca_carroceria}</span></td>
                    <td>
                      <span className="flota__dato"><strong>{bus.total_asientos}</strong> asientos · {bus.pisos} piso{bus.pisos > 1 ? 's' : ''}</span>
                      {bus.asientos_especiales > 0 && <span className="texto-suave flota__dato">{bus.asientos_especiales} VIP / especiales</span>}
                    </td>
                    <td className="flota__servicios">
                      {(bus.servicios || []).length
                        ? bus.servicios.map((s) => <span key={s} title={servicios.find((x) => x.clave === s)?.nombre || s}>{ICONO_SERVICIO[s] || '•'}</span>)
                        : <span className="texto-suave">—</span>}
                    </td>
                    <td>
                      <span className={`insignia ${bus.activo ? 'insignia--exito' : 'insignia--error'}`}>{bus.activo ? 'Activo' : 'Inactivo'}</span>
                      {matricula && <span className={`insignia ${matricula.clase} flota__matricula`}>{matricula.texto}</span>}
                    </td>
                    <td className="flota__acciones">
                      <button type="button" className="btn btn-sm" onClick={() => abrirEdicion(bus)}><Icono nombre="editar" tam={16} /> Editar</button>
                      <button type="button" className="btn btn-sm btn--fantasma" onClick={() => alternarEstado(bus)}>
                        <Icono nombre="apagar" tam={16} /> {bus.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {visibles.length === 0 && (
                <tr><td colSpan={6} className="text-center texto-suave">{buses.length ? 'Ningún bus coincide con la búsqueda.' : 'Aún no registras buses. Presiona «Nuevo bus».'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel lateral: registrar / editar */}
      {form && (
        <div className="capa" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && cerrar()}>
          <form className="panel" onSubmit={guardar} noValidate role="dialog" aria-labelledby="titulo-bus">
            <div className="panel__cabecera">
              <div>
                <h2 id="titulo-bus">{idEdicion ? `Bus disco ${form.numero_disco}` : 'Nuevo bus'}</h2>
                <p>{idEdicion ? 'Actualiza la ficha de la unidad.' : 'Registra la unidad; los asientos se crean al guardar.'}</p>
              </div>
              <button type="button" className="btn btn--fantasma btn--icono" onClick={cerrar} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
            </div>
            <div className="panel__cuerpo">
              {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}

              <h3 className="flota__seccion">Identificación</h3>
              <div className="rejilla-2">
                {campo('numero_disco', 'Número de disco', { inputMode: 'numeric', placeholder: '12', autoFocus: !idEdicion })}
                {campo('placa', 'Placa', { placeholder: 'TBA-1234' }, 'Tres letras, guion y 3 o 4 números')}
              </div>
              <div className="rejilla-2">
                {campo('numero_chasis', 'Número de chasis (VIN)', { placeholder: '17 caracteres' }, `Opcional · ${form.numero_chasis.length}/17`)}
                {campo('numero_motor', 'Número de motor', { placeholder: 'OM457LA-1234' }, 'Opcional')}
              </div>

              <h3 className="flota__seccion">Fabricación</h3>
              <div className="rejilla-2">
                {selectorMarca('marca_chasis', 'chasis', 'Marca del chasis')}
                {selectorMarca('marca_carroceria', 'carroceria', 'Marca de la carrocería')}
              </div>
              <div className="rejilla-2">
                {campo('anio_fabricacion', 'Año de fabricación', { type: 'number', min: 1990, max: anioActual + 1, placeholder: String(anioActual) })}
                <div className={`campo ${errores.pisos ? 'campo--error' : ''}`}>
                  <label className="campo__etiqueta" htmlFor="bus-pisos">Pisos</label>
                  <select id="bus-pisos" name="pisos" value={form.pisos} onChange={cambiar}>
                    <option value={1}>1 piso</option>
                    <option value={2}>2 pisos</option>
                  </select>
                  {errores.pisos && <span className="campo__error">{errores.pisos}</span>}
                </div>
              </div>

              {!idEdicion && (
                <>
                  <h3 className="flota__seccion">Capacidad</h3>
                  <div className="rejilla-2">
                    {campo('cantidad_asientos', 'Cantidad de asientos', { type: 'number', min: 10, max: 80 }, 'Entre 10 y 80')}
                    <div className={`campo ${errores.tipo_asiento_id ? 'campo--error' : ''}`}>
                      <label className="campo__etiqueta" htmlFor="bus-tipo">Tipo de asiento inicial</label>
                      <select id="bus-tipo" name="tipo_asiento_id" value={form.tipo_asiento_id} onChange={cambiar}>
                        <option value="">Elige un tipo</option>
                        {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                      {errores.tipo_asiento_id
                        ? <span className="campo__error">{errores.tipo_asiento_id}</span>
                        : <span className="campo__ayuda">Luego pinta los VIP en «Estructura de asientos»</span>}
                    </div>
                  </div>
                </>
              )}

              <h3 className="flota__seccion">Servicios a bordo</h3>
              <div className="flota__checks">
                {servicios.map((s) => (
                  <label key={s.clave} className={`flota__check ${form.servicios.includes(s.clave) ? 'activo' : ''}`}>
                    <input type="checkbox" checked={form.servicios.includes(s.clave)} onChange={() => alternarServicio(s.clave)} />
                    <span aria-hidden="true">{ICONO_SERVICIO[s.clave]}</span> {s.nombre}
                  </label>
                ))}
              </div>
              {errores.servicios && <span className="campo__error">{errores.servicios}</span>}

              <h3 className="flota__seccion">Documentos y notas</h3>
              <div className="rejilla-2">
                {campo('vence_matricula', 'Matrícula vence el', { type: 'date' }, 'Te avisamos 30 días antes')}
              </div>
              <div className={`campo ${errores.observaciones ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="bus-observaciones">Observaciones</label>
                <textarea id="bus-observaciones" name="observaciones" rows={3} maxLength={300} value={form.observaciones} onChange={cambiar}
                  placeholder="Ej. Revisión de frenos en enero" />
                {errores.observaciones && <span className="campo__error">{errores.observaciones}</span>}
              </div>

              {idEdicion && (
                <>
                  <h3 className="flota__seccion">Foto</h3>
                  <div className="flota__foto">
                    {form.foto_url ? <img src={form.foto_url} alt={`Bus ${form.numero_disco}`} /> : <span className="flota__sin-foto flota__sin-foto--grande"><Icono nombre="imagen" tam={32} /></span>}
                    <label className="btn btn-sm">
                      <Icono nombre="imagen" tam={16} /> {form.foto_url ? 'Cambiar foto' : 'Subir foto'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => subirFoto(e.target.files[0])} />
                    </label>
                    <span className="campo__ayuda">JPG, PNG o WEBP. La ven los clientes en «Ver detalle».</span>
                  </div>
                </>
              )}
            </div>
            <div className="panel__pie">
              <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : idEdicion ? 'Guardar cambios' : 'Registrar bus'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
