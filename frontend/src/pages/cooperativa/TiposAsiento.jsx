import { useState, useEffect } from 'react'
import api from '../../services/api'

const VACIO = { nombre: '', factor_precio: '1.00' }

// Ejemplo del precio de un pasaje de $10 con este factor
const ejemplo = (factor) => `$${(10 * (Number(factor) || 0)).toFixed(2)}`

// Tipos de asiento de la cooperativa y su factor de precio (rediseño CC-20)
export default function TiposAsiento() {
  const [tipos, setTipos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [idEditar, setIdEditar] = useState(null)
  const [porEliminar, setPorEliminar] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const cargarTipos = () =>
    api.get('/tipos-asiento')
      .then((respuesta) => setTipos(respuesta.data))
      .catch((err) => setError(err.response?.data?.mensaje || 'No pudimos cargar los tipos de asiento'))
      .finally(() => setCargando(false))

  useEffect(() => {
    cargarTipos()
  }, [])

  const limpiarFormulario = () => {
    setForm(VACIO)
    setErrores({})
    setIdEditar(null)
  }

  const cambiar = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrores({ ...errores, [e.target.name]: '' })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setMensaje('')
    const locales = {}
    if (form.nombre.trim().length < 3) locales.nombre = 'Escribe un nombre de al menos 3 caracteres, por ejemplo "VIP"'
    const factor = Number(form.factor_precio)
    if (!factor || factor < 0.5 || factor > 3) locales.factor_precio = 'El factor debe estar entre 0.50 y 3.00'
    if (Object.keys(locales).length) return setErrores(locales)

    setGuardando(true)
    try {
      const datos = { nombre: form.nombre.trim(), factor_precio: factor }
      if (idEditar) {
        await api.put(`/tipos-asiento/${idEditar}`, datos)
        setMensaje(`El tipo "${datos.nombre}" se actualizó correctamente`)
      } else {
        await api.post('/tipos-asiento', datos)
        setMensaje(`El tipo "${datos.nombre}" se registró correctamente`)
      }
      limpiarFormulario()
      cargarTipos()
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No pudimos guardar el tipo de asiento')
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setGuardando(false)
    }
  }

  const editar = (tipo) => {
    setIdEditar(tipo.id)
    setForm({ nombre: tipo.nombre, factor_precio: Number(tipo.factor_precio).toFixed(2) })
    setErrores({})
    setMensaje('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const eliminar = async () => {
    const tipo = porEliminar
    setPorEliminar(null)
    try {
      setError('')
      setMensaje('')
      await api.delete(`/tipos-asiento/${tipo.id}`)
      setMensaje(`El tipo "${tipo.nombre}" se eliminó`)
      cargarTipos()
    } catch (err) {
      setError(err.response?.data?.mensaje || 'No pudimos eliminar el tipo de asiento')
    }
  }

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Flota</span>
          <h1>Tipos de asiento</h1>
          <p>Define las categorías de asientos de tus buses. El factor multiplica el precio del tramo.</p>
        </div>
      </div>

      {error && <div className="alerta alerta--error" role="alert">{error}</div>}
      {mensaje && <div className="alerta alerta--exito" role="status">{mensaje}</div>}

      <div className="rejilla-2" style={{ alignItems: 'start' }}>
        <form onSubmit={guardar} className="card" noValidate style={{ marginBottom: 0 }}>
          <div className="card-body">
            <h2>{idEditar ? 'Editar tipo de asiento' : 'Nuevo tipo de asiento'}</h2>
            <div className={`campo ${errores.nombre ? 'campo--error' : ''}`}>
              <label className="campo__etiqueta" htmlFor="nombre">Nombre</label>
              <input id="nombre" name="nombre" value={form.nombre} onChange={cambiar} placeholder="Ej. Normal, VIP, Semicama" maxLength={40} />
              {errores.nombre && <span className="campo__error">{errores.nombre}</span>}
            </div>
            <div className={`campo ${errores.factor_precio ? 'campo--error' : ''}`}>
              <label className="campo__etiqueta" htmlFor="factor_precio">Factor de precio</label>
              <input id="factor_precio" name="factor_precio" type="number" step="0.05" min="0.5" max="3"
                value={form.factor_precio} onChange={cambiar} />
              {errores.factor_precio
                ? <span className="campo__error">{errores.factor_precio}</span>
                : <span className="campo__ayuda">Un pasaje de $10.00 costará <strong>{ejemplo(form.factor_precio)}</strong> en este tipo de asiento.</span>}
            </div>
            <div className="fila">
              <button type="submit" className="btn btn-primary" disabled={guardando}>
                {guardando ? 'Guardando…' : idEditar ? 'Guardar cambios' : 'Agregar tipo'}
              </button>
              {idEditar && <button type="button" className="btn" onClick={limpiarFormulario}>Cancelar</button>}
            </div>
          </div>
        </form>

        <div>
          {cargando && <div className="cargando"><span className="giro" /> Cargando tipos de asiento…</div>}
          {!cargando && tipos.length === 0 && (
            <div className="vacio">
              <h3>Aún no tienes tipos de asiento</h3>
              <span>Crea al menos uno (por ejemplo "Normal") antes de registrar tus buses.</span>
            </div>
          )}
          <div style={{ display: 'grid', gap: '1rem' }}>
            {tipos.map((tipo) => (
              <article key={tipo.id} className="card" style={{ marginBottom: 0, outline: idEditar === tipo.id ? '2px solid var(--marca, var(--color-primario))' : 'none' }}>
                <div className="card-body fila fila--entre">
                  <div>
                    <h3 style={{ margin: 0 }}>{tipo.nombre}</h3>
                    <span className="texto-suave" style={{ fontSize: '.86rem' }}>
                      {Number(tipo.factor_precio) === 1 ? 'Precio base' : `${Math.round((Number(tipo.factor_precio) - 1) * 100)} % ${Number(tipo.factor_precio) > 1 ? 'más' : 'menos'} que el precio base`}
                    </span>
                  </div>
                  <strong style={{ fontSize: '1.6rem', letterSpacing: '-.02em' }}>×{Number(tipo.factor_precio).toFixed(2)}</strong>
                  <div className="fila" style={{ width: '100%' }}>
                    <button type="button" className="btn btn-sm" onClick={() => editar(tipo)}>Editar</button>
                    {porEliminar?.id === tipo.id ? (
                      <>
                        <span className="texto-suave" style={{ fontSize: '.86rem' }}>¿Eliminar este tipo?</span>
                        <button type="button" className="btn btn-sm btn-danger" onClick={eliminar}>Sí, eliminar</button>
                        <button type="button" className="btn btn-sm" onClick={() => setPorEliminar(null)}>No</button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setPorEliminar(tipo)}>Eliminar</button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
