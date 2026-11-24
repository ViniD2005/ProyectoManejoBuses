import { useEffect, useState } from 'react'
import api from '../../services/api.js'
import { aplicarTema } from '../../utils/temaCooperativa.js'

const VACIO = {
  color_primario: '#1f4e5f',
  color_acento: '#e8a317',
  eslogan: '',
  descripcion: '',
  facebook_url: '',
  instagram_url: '',
  whatsapp: '',
}

// Combinaciones sugeridas: [principal, acento, nombre]
const PALETAS = [
  ['#0f5b46', '#f2b134', 'Andes'],
  ['#7a1f2b', '#f0a43a', 'Vino'],
  ['#1d4e89', '#f4c542', 'Pacífico'],
  ['#2f3e46', '#e76f51', 'Volcán'],
  ['#3a2e6e', '#4fd1c5', 'Noche'],
  ['#14532d', '#a3e635', 'Amazonía'],
]

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No pudimos conectarnos con el servidor. Inténtalo de nuevo.'
}

const deServidor = (datos) => ({
  color_primario: datos.color_primario || VACIO.color_primario,
  color_acento: datos.color_acento || VACIO.color_acento,
  eslogan: datos.eslogan || '',
  descripcion: datos.descripcion || '',
  facebook_url: datos.facebook_url || '',
  instagram_url: datos.instagram_url || '',
  whatsapp: datos.whatsapp || '',
})

const iniciales = (texto = '') =>
  texto.replace(/^Cooperativa\s+/i, '').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

/*
  CC-24: el usuario de la cooperativa personaliza cómo se ve SU cooperativa:
  logo, colores, eslogan, descripción y redes sociales.
  Los cambios se ven en su panel y en las tarjetas de viaje que ven los clientes.
*/
export default function MiCooperativa() {
  const [cooperativa, setCooperativa] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [original, setOriginal] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    api.get('/apariencia/mia')
      .then(({ data }) => {
        setCooperativa(data)
        setForm(deServidor(data))
        setOriginal(deServidor(data))
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [])

  const hayCambios = JSON.stringify(form) !== JSON.stringify(original)

  const cambiar = (e) => {
    let { value } = e.target
    if (e.target.name === 'whatsapp') value = value.replace(/\D/g, '').slice(0, 10)
    setForm({ ...form, [e.target.name]: value })
    setErrores({ ...errores, [e.target.name]: '' })
    setAviso('')
  }

  const elegirPaleta = ([primario, acento]) => {
    setForm({ ...form, color_primario: primario, color_acento: acento })
    setErrores({ ...errores, color_primario: '', color_acento: '' })
    setAviso('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    if (form.color_primario.toLowerCase() === form.color_acento.toLowerCase()) {
      return setErrores({ color_acento: 'El color de acento debe ser distinto del color principal' })
    }
    setGuardando(true)
    try {
      const { data } = await api.put('/apariencia/mia', form)
      setCooperativa(data)
      setForm(deServidor(data))
      setOriginal(deServidor(data))
      aplicarTema(data)
      setAviso('¡Listo! Tu cooperativa ya luce con su nueva apariencia.')
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setGuardando(false)
    }
  }

  const subirLogo = async (e) => {
    const archivo = e.target.files[0]
    e.target.value = ''
    if (!archivo) return
    setError('')
    setAviso('')
    if (archivo.size > 2 * 1024 * 1024) return setError('El logo pesa más de 2 MB. Elige una imagen más liviana.')
    setSubiendo(true)
    try {
      const datos = new FormData()
      datos.append('logo', archivo)
      const { data } = await api.post('/apariencia/mia/logo', datos)
      setCooperativa(data)
      aplicarTema(data)
      setAviso('Logo actualizado.')
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setSubiendo(false)
    }
  }

  const quitarLogo = async () => {
    setError('')
    try {
      const { data } = await api.delete('/apariencia/mia/logo')
      setCooperativa(data)
      aplicarTema(data)
      setAviso('Se quitó el logo. Se mostrarán las iniciales de tu cooperativa.')
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  if (cargando) return <div className="cargando"><span className="giro" /> Cargando la apariencia de tu cooperativa…</div>
  if (!cooperativa) return <div className="alerta alerta--error">{error || 'No encontramos tu cooperativa.'}</div>

  const campoError = (nombre) => errores[nombre] && <span className="campo__error">{errores[nombre]}</span>

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Mi cooperativa</span>
          <h1>{cooperativa.nombre}</h1>
          <p>Mantén al día los datos de contacto y elige el logo, los colores y los textos con los que tus clientes y tu personal reconocen a tu cooperativa.</p>
        </div>
      </div>

      {/* GC-16: datos de contacto (tiene su propio botón de guardar) */}
      <DatosCooperativa cooperativa={cooperativa} alGuardar={(data) => { setCooperativa(data); aplicarTema(data) }} />

      {error && <div className="alerta alerta--error" role="alert">{error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status">{aviso}</div>}

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
        <form onSubmit={guardar} noValidate>
          {/* Logo */}
          <section className="card">
            <div className="card-body">
              <h2>Logo</h2>
              <div className="fila" style={{ gap: '1.25rem' }}>
                <div style={{ width: 96, height: 96, borderRadius: 20, display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none',
                  border: '1px solid var(--borde, #e2e8f0)', background: cooperativa.logo_url ? '#fff' : form.color_primario, color: '#fff', fontWeight: 800, fontSize: '1.8rem' }}>
                  {cooperativa.logo_url
                    ? <img src={cooperativa.logo_url} alt={`Logo de ${cooperativa.nombre}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : iniciales(cooperativa.nombre)}
                </div>
                <div style={{ display: 'grid', gap: '.5rem' }}>
                  <div className="fila">
                    <label className="btn btn-primary" style={{ cursor: subiendo ? 'wait' : 'pointer' }}>
                      {subiendo ? 'Subiendo…' : cooperativa.logo_url ? 'Cambiar logo' : 'Subir logo'}
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={subirLogo} disabled={subiendo}
                        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                    </label>
                    {cooperativa.logo_url && <button type="button" className="btn" onClick={quitarLogo}>Quitar</button>}
                  </div>
                  <span className="campo__ayuda" style={{ margin: 0 }}>PNG, JPG, WEBP o SVG de hasta 2 MB. Mejor si es cuadrado y con fondo transparente.</span>
                </div>
              </div>
            </div>
          </section>

          {/* Colores */}
          <section className="card">
            <div className="card-body">
              <h2>Colores</h2>
              <p className="texto-suave" style={{ fontSize: '.9rem' }}>Elige una combinación sugerida o define tus propios colores.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.6rem', marginBottom: '1.25rem' }}>
                {PALETAS.map((p) => {
                  const activa = p[0] === form.color_primario.toLowerCase() && p[1] === form.color_acento.toLowerCase()
                  return (
                    <button key={p[2]} type="button" onClick={() => elegirPaleta(p)} title={p[2]}
                      className="btn btn-sm" style={{ gap: '.45rem', borderColor: activa ? p[0] : undefined, boxShadow: activa ? `0 0 0 3px ${p[0]}33` : undefined }}>
                      <span style={{ display: 'inline-flex' }}>
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: p[0] }} />
                        <span style={{ width: 16, height: 16, borderRadius: '50%', background: p[1], marginLeft: -5, border: '2px solid #fff' }} />
                      </span>
                      {p[2]}
                    </button>
                  )
                })}
              </div>
              <div className="rejilla-2">
                <div className={`campo ${errores.color_primario ? 'campo--error' : ''}`}>
                  <label className="campo__etiqueta" htmlFor="color_primario">Color principal</label>
                  <div className="fila" style={{ flexWrap: 'nowrap' }}>
                    <input type="color" id="color_primario" name="color_primario" value={form.color_primario} onChange={cambiar}
                      className="form-control" style={{ width: 56, flex: 'none' }} />
                    <input value={form.color_primario} name="color_primario" onChange={cambiar} maxLength={7} aria-label="Código del color principal" />
                  </div>
                  {campoError('color_primario') || <span className="campo__ayuda">Menú, botones y encabezados.</span>}
                </div>
                <div className={`campo ${errores.color_acento ? 'campo--error' : ''}`}>
                  <label className="campo__etiqueta" htmlFor="color_acento">Color de acento</label>
                  <div className="fila" style={{ flexWrap: 'nowrap' }}>
                    <input type="color" id="color_acento" name="color_acento" value={form.color_acento} onChange={cambiar}
                      className="form-control" style={{ width: 56, flex: 'none' }} />
                    <input value={form.color_acento} name="color_acento" onChange={cambiar} maxLength={7} aria-label="Código del color de acento" />
                  </div>
                  {campoError('color_acento') || <span className="campo__ayuda">Detalles y botones destacados.</span>}
                </div>
              </div>
            </div>
          </section>

          {/* Textos y redes */}
          <section className="card">
            <div className="card-body">
              <h2>Presentación</h2>
              <div className={`campo ${errores.eslogan ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="eslogan">Eslogan</label>
                <input id="eslogan" name="eslogan" value={form.eslogan} onChange={cambiar} maxLength={120} placeholder="Ej. Viaja seguro por la Sierra y el Austro" />
                {campoError('eslogan') || <span className="campo__ayuda">{form.eslogan.length}/120 · aparece en las tarjetas de viaje.</span>}
              </div>
              <div className={`campo ${errores.descripcion ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="descripcion">Descripción</label>
                <textarea id="descripcion" name="descripcion" value={form.descripcion} onChange={cambiar} maxLength={500} rows={4}
                  placeholder="Cuenta a tus clientes desde cuándo operan, sus rutas principales y qué los distingue." />
                {campoError('descripcion') || <span className="campo__ayuda">{form.descripcion.length}/500</span>}
              </div>
              <div className="rejilla-2">
                <div className={`campo ${errores.facebook_url ? 'campo--error' : ''}`}>
                  <label className="campo__etiqueta" htmlFor="facebook_url">Facebook</label>
                  <input id="facebook_url" name="facebook_url" value={form.facebook_url} onChange={cambiar} placeholder="https://facebook.com/tu-cooperativa" />
                  {campoError('facebook_url')}
                </div>
                <div className={`campo ${errores.instagram_url ? 'campo--error' : ''}`}>
                  <label className="campo__etiqueta" htmlFor="instagram_url">Instagram</label>
                  <input id="instagram_url" name="instagram_url" value={form.instagram_url} onChange={cambiar} placeholder="https://instagram.com/tu-cooperativa" />
                  {campoError('instagram_url')}
                </div>
              </div>
              <div className={`campo ${errores.whatsapp ? 'campo--error' : ''}`}>
                <label className="campo__etiqueta" htmlFor="whatsapp">WhatsApp de atención</label>
                <input id="whatsapp" name="whatsapp" value={form.whatsapp} onChange={cambiar} inputMode="tel" placeholder="09XXXXXXXX" />
                {campoError('whatsapp')}
              </div>
            </div>
          </section>

          <div className="card" style={{ position: 'sticky', bottom: '1rem', zIndex: 5 }}>
            <div className="card-body fila fila--entre" style={{ padding: '1rem 1.25rem' }}>
              <span className="texto-suave" style={{ fontSize: '.9rem' }}>{hayCambios ? 'Tienes cambios sin guardar' : 'Todo está guardado'}</span>
              <div className="fila">
                {hayCambios && <button type="button" className="btn" onClick={() => { setForm(original); setErrores({}) }}>Descartar</button>}
                <button className="btn btn-primary" disabled={guardando || !hayCambios}>{guardando ? 'Guardando…' : 'Guardar apariencia'}</button>
              </div>
            </div>
          </div>
        </form>

        <VistaPrevia cooperativa={cooperativa} form={form} />
      </div>
    </div>
  )
}

/*
  GC-16: datos de la cooperativa que antes solo podía cambiar el administrador.
  Mismas reglas que el registro: RUC de 13 dígitos, teléfono ecuatoriano,
  correo válido y nombre/RUC sin repetir con otra cooperativa.
*/
const DATOS = ['nombre', 'ruc', 'telefono', 'email', 'direccion']
const datosDe = (c) => Object.fromEntries(DATOS.map((k) => [k, c?.[k] || '']))

function DatosCooperativa({ cooperativa, alGuardar }) {
  const [form, setForm] = useState(() => datosDe(cooperativa))
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const original = datosDe(cooperativa)
  const hayCambios = DATOS.some((k) => form[k] !== original[k])

  const cambiar = (e) => {
    let { name, value } = e.target
    if (name === 'ruc') value = value.replace(/\D/g, '').slice(0, 13)
    if (name === 'telefono') value = value.replace(/[^\d]/g, '').slice(0, 10)
    setForm({ ...form, [name]: value })
    setErrores({ ...errores, [name]: '' })
    setMensaje(null)
  }

  // Revisión rápida en el navegador; el servidor vuelve a validar todo
  const revisar = () => {
    const e = {}
    if (form.nombre.trim().length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres'
    if (!/^\d{13}$/.test(form.ruc)) e.ruc = 'El RUC debe tener exactamente 13 dígitos'
    else if (!form.ruc.endsWith('001')) e.ruc = 'El RUC debe terminar en 001'
    if (!/^09\d{8}$/.test(form.telefono) && !/^0[2-7]\d{7}$/.test(form.telefono)) e.telefono = 'Escribe un celular (09XXXXXXXX) o un fijo con código de provincia (02XXXXXXX)'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) e.email = 'Escribe un correo válido'
    if (form.direccion.trim().length < 5) e.direccion = 'Escribe la dirección completa de la oficina matriz'
    return e
  }

  const guardar = async (e) => {
    e.preventDefault()
    const encontrados = revisar()
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return setMensaje({ tipo: 'error', texto: 'Revisa los datos marcados.' })
    setGuardando(true)
    try {
      const { data } = await api.put('/apariencia/mia/datos', form)
      alGuardar(data)
      setForm(datosDe(data))
      setMensaje({ tipo: 'exito', texto: 'Datos de la cooperativa actualizados.' })
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
      setMensaje({ tipo: 'error', texto: mensajeDeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  const campo = (name, etiqueta, props = {}) => (
    <div className={`campo ${errores[name] ? 'campo--error' : ''}`}>
      <label className="campo__etiqueta" htmlFor={`dato-${name}`}>{etiqueta}</label>
      <input id={`dato-${name}`} name={name} value={form[name]} onChange={cambiar} aria-invalid={!!errores[name]} {...props} />
      {errores[name] && <span className="campo__error">{errores[name]}</span>}
    </div>
  )

  return (
    <form className="card" onSubmit={guardar} noValidate>
      <div className="card-header fila fila--entre">
        <span>Datos de la cooperativa</span>
        <span className="insignia">Información de contacto para tus clientes</span>
      </div>
      <div className="card-body">
        {mensaje && <div className={`alerta alerta--${mensaje.tipo}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</div>}
        <div className="rejilla-2">
          {campo('nombre', 'Nombre comercial', { maxLength: 120, placeholder: 'Cooperativa de Transportes …' })}
          {campo('ruc', 'RUC', { inputMode: 'numeric', placeholder: '1890000009001' })}
          {campo('telefono', 'Teléfono', { inputMode: 'tel', placeholder: '032400001 o 0991234567' })}
          {campo('email', 'Correo de contacto', { type: 'email', maxLength: 120, placeholder: 'contacto@cooperativa.com' })}
        </div>
        {campo('direccion', 'Dirección de la oficina matriz', { maxLength: 200, placeholder: 'Av. Cevallos y Montalvo, Ambato' })}
        <div className="fila" style={{ justifyContent: 'flex-end' }}>
          {hayCambios && <button type="button" className="btn" onClick={() => { setForm(original); setErrores({}); setMensaje(null) }}>Descartar</button>}
          <button className="btn btn-primary" disabled={guardando || !hayCambios}>{guardando ? 'Guardando…' : 'Guardar datos'}</button>
        </div>
      </div>
    </form>
  )
}

// Así ven los clientes y el personal la cooperativa con los valores del formulario
function VistaPrevia({ cooperativa, form }) {
  // claro: para mostrarlo sobre el fondo de color del menú
  const logo = (tam, claro = false) => (
    <span style={{ width: tam, height: tam, borderRadius: tam / 3.5, display: 'grid', placeItems: 'center', flex: 'none', overflow: 'hidden',
      background: cooperativa.logo_url ? '#fff' : claro ? 'rgba(255,255,255,.18)' : `${form.color_primario}1f`,
      color: claro ? '#fff' : form.color_primario, fontWeight: 800, fontSize: tam / 2.6 }}>
      {cooperativa.logo_url ? <img src={cooperativa.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : iniciales(cooperativa.nombre)}
    </span>
  )

  return (
    <aside style={{ position: 'sticky', top: '5.5rem', display: 'grid', gap: '1rem' }}>
      <span className="etiqueta-seccion" style={{ marginBottom: 0 }}>Vista previa en vivo</span>

      {/* Tarjeta de viaje en los resultados de búsqueda */}
      <div className="card" style={{ marginBottom: 0, position: 'relative' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: form.color_primario }} />
        <div className="card-body" style={{ paddingLeft: '1.75rem' }}>
          <div className="texto-suave" style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '.75rem' }}>
            Así te ven los clientes al buscar pasajes
          </div>
          <div className="fila" style={{ flexWrap: 'nowrap', marginBottom: '1rem' }}>
            {logo(42)}
            <div>
              <strong style={{ display: 'block', lineHeight: 1.2 }}>{cooperativa.nombre}</strong>
              <span className="texto-suave" style={{ fontSize: '.82rem' }}>{form.eslogan || 'Tu eslogan aparecerá aquí'}</span>
            </div>
          </div>
          <div className="fila fila--entre">
            <div>
              <strong style={{ fontSize: '1.4rem', display: 'block', lineHeight: 1 }}>08:30</strong>
              <span className="texto-suave" style={{ fontSize: '.85rem' }}>Ambato → Quito</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block', lineHeight: 1 }}>$4.50</strong>
              <span style={{ display: 'inline-block', marginTop: '.5rem', padding: '.45rem .9rem', borderRadius: 10, background: form.color_primario, color: '#fff', fontWeight: 700, fontSize: '.85rem' }}>
                Ver asientos
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Menú del panel del personal */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', minHeight: 190 }}>
          <div style={{ padding: '1rem .8rem', background: `linear-gradient(180deg, color-mix(in srgb, ${form.color_primario} 80%, black), ${form.color_primario})`, color: '#fff' }}>
            <div className="fila" style={{ flexWrap: 'nowrap', gap: '.5rem', marginBottom: '1rem' }}>
              {logo(28, true)}
              <strong style={{ fontSize: '.78rem', lineHeight: 1.2 }}>{cooperativa.nombre}</strong>
            </div>
            {['Buses', 'Frecuencias', 'Hoja semanal'].map((t, i) => (
              <div key={t} style={{ padding: '.4rem .55rem', borderRadius: 7, marginBottom: 3, fontSize: '.75rem', fontWeight: 650,
                background: i === 0 ? '#fff' : 'transparent', color: i === 0 ? form.color_primario : 'rgba(255,255,255,.8)' }}>{t}</div>
            ))}
          </div>
          <div style={{ padding: '1rem' }}>
            <div className="texto-suave" style={{ fontSize: '.72rem', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: '.6rem' }}>Panel de tu personal</div>
            <div style={{ height: 10, width: '70%', borderRadius: 5, background: '#e2e8f0', marginBottom: 8 }} />
            <div style={{ height: 10, width: '45%', borderRadius: 5, background: '#eef2f6', marginBottom: 16 }} />
            <span style={{ display: 'inline-block', padding: '.4rem .8rem', borderRadius: 9, background: form.color_primario, color: '#fff', fontSize: '.78rem', fontWeight: 700 }}>Guardar</span>{' '}
            <span style={{ display: 'inline-block', padding: '.4rem .8rem', borderRadius: 9, background: form.color_acento, color: '#1d1405', fontSize: '.78rem', fontWeight: 700 }}>Destacado</span>
          </div>
        </div>
      </div>

      {form.descripcion && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-body">
            <strong>Sobre {cooperativa.nombre}</strong>
            <p className="texto-suave" style={{ margin: '.5rem 0 0', fontSize: '.9rem' }}>{form.descripcion}</p>
          </div>
        </div>
      )}
    </aside>
  )
}
