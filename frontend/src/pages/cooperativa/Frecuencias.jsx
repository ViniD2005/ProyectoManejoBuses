
import { useEffect, useState } from 'react'
import api from '../../services/api.js'

const FORM_VACIO = {
  ciudad_origen_id: '',
  ciudad_destino_id: '',
  hora_salida: '',
  numero_resolucion: '',
  fecha_resolucion: '',
  duracion_minutos: '',
  precio_total: '',
}

const PARADA_VACIA = {
  ciudad_id: '',
  minutos_desde_salida: '',
  precio_acumulado: ''
}

function mensajeDeError(err) {
  return err.response?.data?.mensaje || 'No se pudo conectar con el servidor'
}

function Frecuencias() {
  const [frecuencias, setFrecuencias] = useState([])
  const [ciudades, setCiudades] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [paradas, setParadas] = useState([])
  const [nuevaParada, setNuevaParada] = useState(PARADA_VACIA)
  const [recorrido, setRecorrido] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargarFrecuencias = () =>
    api.get('/frecuencias')
      .then(({ data }) => setFrecuencias(data))
      .catch((err) => setError(mensajeDeError(err)))

  useEffect(() => {
    cargarFrecuencias()
    api.get('/ciudades')
      .then(({ data }) => setCiudades(data))
      .catch((err) => setError(mensajeDeError(err)))
  }, [])

  const nombreCiudad = (id) =>
    ciudades.find((c) => String(c.id) === String(id))?.nombre || '—'

  const cambiar = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const cambiarParada = (e) =>
    setNuevaParada({ ...nuevaParada, [e.target.name]: e.target.value })

  // Agregar parada intermedia
  const agregarParada = () => {
    if (
      !nuevaParada.ciudad_id ||
      nuevaParada.minutos_desde_salida === '' ||
      nuevaParada.precio_acumulado === ''
    ) {
      setError(
        'Completa la ciudad, los minutos y el precio acumulado de la parada'
      )
      return
    }

    setError('')

    setParadas([...paradas, {
      ciudad_id: Number(nuevaParada.ciudad_id),
      minutos_desde_salida: Number(nuevaParada.minutos_desde_salida),
      precio_acumulado: Number(nuevaParada.precio_acumulado),
    }])

    setNuevaParada(PARADA_VACIA)
  }

  const quitarParada = (indice) =>
    setParadas(paradas.filter((_, i) => i !== indice))

  // Registrar frecuencia mediante la API
  const guardar = async (e) => {
    e.preventDefault()

    setError('')
    setAviso('')
    setErrores({})

    try {
      const { data } = await api.post('/frecuencias', {
        ...form,
        ciudad_origen_id: Number(form.ciudad_origen_id),
        ciudad_destino_id: Number(form.ciudad_destino_id),
        duracion_minutos: Number(form.duracion_minutos),
        precio_total: Number(form.precio_total),
        fecha_resolucion: form.fecha_resolucion || null,
        paradas_intermedias: paradas,
      })

      setAviso(
        `Frecuencia ${data.origen} → ${data.destino} registrada con ${data.paradas.length} paradas`
      )

      setForm(FORM_VACIO)
      setParadas([])
      cargarFrecuencias()

    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    }
  }

  // Activar o desactivar frecuencia
  const alternarEstado = async (frecuencia) => {
    try {
      await api.patch(
        `/frecuencias/${frecuencia.id}/estado`,
        { activa: !frecuencia.activa }
      )

      cargarFrecuencias()

    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  // Consultar recorrido completo
  const verRecorrido = async (frecuencia) => {
    try {
      const { data } = await api.get(
        `/frecuencias/${frecuencia.id}`
      )

      setRecorrido(data)

    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  const selectorCiudad = (name, valor, onChange) => (
    <select
      id={name}
      name={name}
      className="form-control"
      value={valor}
      onChange={onChange}
    >
      <option value="">Elige una ciudad</option>
      {ciudades.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  )

  const mensajeCampo = (campo) =>
    errores[campo] && (
      <small style={{ color: '#b3261e' }}>
        {errores[campo]}
      </small>
    )

  return (
    <main className="container">
      <h1 className="mb-2">
        Gestión de frecuencias
      </h1>

      <p className="text-muted mb-4">
        Frecuencias asignadas por la ANT a tu cooperativa,
        con su recorrido y precios por tramo.
      </p>

      <section className="card">
        <form className="card-body" onSubmit={guardar}>
          <h2 className="h4 mb-3">
            Registrar frecuencia
          </h2>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="ciudad_origen_id"
            >
              Ciudad de origen
            </label>

            {selectorCiudad(
              'ciudad_origen_id',
              form.ciudad_origen_id,
              cambiar
            )}

            {mensajeCampo('ciudad_origen_id')}
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="ciudad_destino_id"
            >
              Ciudad de destino
            </label>

            {selectorCiudad(
              'ciudad_destino_id',
              form.ciudad_destino_id,
              cambiar
            )}

            {mensajeCampo('ciudad_destino_id')}
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="hora_salida"
            >
              Hora de salida
            </label>

            <input
              id="hora_salida"
              name="hora_salida"
              type="time"
              className="form-control"
              value={form.hora_salida}
              onChange={cambiar}
              required
            />

            {mensajeCampo('hora_salida')}
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="numero_resolucion"
            >
              N.º de resolución de la ANT
            </label>

            <input
              id="numero_resolucion"
              name="numero_resolucion"
              className="form-control"
              placeholder="ANT-2025-0200"
              value={form.numero_resolucion}
              onChange={cambiar}
              required
            />

            {mensajeCampo('numero_resolucion')}
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="fecha_resolucion"
            >
              Fecha de la resolución
            </label>

            <input
              id="fecha_resolucion"
              name="fecha_resolucion"
              type="date"
              className="form-control"
              value={form.fecha_resolucion}
              onChange={cambiar}
            />
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="duracion_minutos"
            >
              Duración total del viaje (minutos)
            </label>

            <input
              id="duracion_minutos"
              name="duracion_minutos"
              type="number"
              min="1"
              className="form-control"
              value={form.duracion_minutos}
              onChange={cambiar}
              required
            />

            {mensajeCampo('duracion_minutos')}
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="precio_total"
            >
              Precio de origen a destino, asiento normal ($)
            </label>

            <input
              id="precio_total"
              name="precio_total"
              type="number"
              min="0.01"
              step="0.01"
              className="form-control"
              value={form.precio_total}
              onChange={cambiar}
              required
            />

            {mensajeCampo('precio_total')}
          </div>

          <h3 className="h4 mb-2">
            Paradas intermedias (opcional)
          </h3>

          <p className="text-muted mb-3">
            En orden de recorrido. Los minutos y el precio
            se cuentan desde el origen.
          </p>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="ciudad_id"
            >
              Ciudad de la parada
            </label>

            {selectorCiudad(
              'ciudad_id',
              nuevaParada.ciudad_id,
              cambiarParada
            )}
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="minutos_desde_salida"
            >
              Minutos desde la salida
            </label>

            <input
              id="minutos_desde_salida"
              name="minutos_desde_salida"
              type="number"
              min="1"
              className="form-control"
              value={nuevaParada.minutos_desde_salida}
              onChange={cambiarParada}
            />
          </div>

          <div className="mb-3">
            <label
              className="form-label"
              htmlFor="precio_acumulado"
            >
              Precio desde el origen ($)
            </label>

            <input
              id="precio_acumulado"
              name="precio_acumulado"
              type="number"
              min="0.01"
              step="0.01"
              className="form-control"
              value={nuevaParada.precio_acumulado}
              onChange={cambiarParada}
            />
          </div>

          <button
            type="button"
            className="btn mb-3"
            onClick={agregarParada}
          >
            Agregar parada
          </button>

          {paradas.length > 0 && (
            <ol className="mb-3">
              {paradas.map((p, i) => (
                <li key={`${p.ciudad_id}-${i}`}>
                  {nombreCiudad(p.ciudad_id)}:
                  {' '}
                  {p.minutos_desde_salida} min,
                  {' '}
                  ${p.precio_acumulado.toFixed(2)}
                  {' '}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => quitarParada(i)}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ol>
          )}

          {mensajeCampo('paradas')}

          {error && (
            <p style={{ color: '#b3261e' }}>
              {error}
            </p>
          )}

          {aviso && (
            <p style={{ color: '#1e7a4c' }}>
              {aviso}
            </p>
          )}

          <button className="btn btn-primary">
            Registrar frecuencia
          </button>
        </form>
      </section>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Tipo</th>
              <th>Paradas</th>
              <th>Precio</th>
              <th>Resolución</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {frecuencias.map((f) => (
              <tr key={f.id}>
                <td>{f.hora_salida?.slice(0, 5)}</td>
                <td>{f.origen}</td>
                <td>{f.destino}</td>
                <td>
                  {f.tipo_viaje === 'con_paradas'
                    ? 'Con paradas'
                    : 'Directo'}
                </td>
                <td>{f.total_paradas}</td>
                <td>
                  ${Number(f.precio_total).toFixed(2)}
                </td>
                <td>{f.numero_resolucion}</td>
                <td>{f.activa ? 'Activa' : 'Inactiva'}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => verRecorrido(f)}
                  >
                    Recorrido
                  </button>

                  <button
                    type="button"
                    className="btn"
                    style={{ marginLeft: 6 }}
                    onClick={() => alternarEstado(f)}
                  >
                    {f.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recorrido && (
        <section className="card">
          <div className="card-body">
            <h2 className="h4 mb-2">
              Recorrido {recorrido.origen}
              {' → '}
              {recorrido.destino}
            </h2>

            <ol>
              {recorrido.paradas.map((p) => (
                <li key={p.orden}>
                  {p.ciudad}:
                  {' '}
                  {p.minutos_desde_salida} min desde la salida,
                  {' '}
                  ${Number(p.precio_acumulado).toFixed(2)}
                </li>
              ))}
            </ol>

            <button
              type="button"
              className="btn"
              onClick={() => setRecorrido(null)}
            >
              Cerrar
            </button>
          </div>
        </section>
      )}
    </main>
  )
}

export default Frecuencias
