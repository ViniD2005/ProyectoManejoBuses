import { useEffect, useState } from 'react'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'

/*
  GC-13: marcas de chasis y de carrocería.
  Las cooperativas solo las eligen de una lista al registrar un bus, así una
  marca nunca queda escrita de dos formas ("Mercedes-Benz" y "Mercedes Benz")
  y los reportes por marca salen correctos.
*/
const TIPOS = [
  { valor: 'chasis', texto: 'Chasis', ejemplo: 'Ej. Scania, Volvo, Mercedes-Benz' },
  { valor: 'carroceria', texto: 'Carrocería', ejemplo: 'Ej. Miral, Carrocerías Olímpica, Varma' },
]

export default function Marcas() {
  const [marcas, setMarcas] = useState([])
  const [tipo, setTipo] = useState('chasis')
  const [nombre, setNombre] = useState('')
  const [editando, setEditando] = useState(null)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = () =>
    api.get('/marcas/gestion')
      .then(({ data }) => setMarcas(data))
      .catch((err) => setError(mensajeDeError(err)))

  useEffect(() => {
    cargar()
  }, [])

  const visibles = marcas.filter((m) => m.tipo === tipo)
  const tipoActual = TIPOS.find((t) => t.valor === tipo)

  const limpiar = () => {
    setNombre('')
    setEditando(null)
    setErrores({})
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')
    setEnviando(true)
    try {
      if (editando) {
        await api.put(`/marcas/${editando.id}`, { nombre })
        setAviso(editando.buses > 0
          ? `Se corrigió la marca a ${nombre.trim()} y se actualizaron los ${editando.buses} buses que la usan.`
          : `Se corrigió la marca a ${nombre.trim()}.`)
      } else {
        await api.post('/marcas', { tipo, nombre })
        setAviso(`Se agregó la marca ${nombre.trim()}. Las cooperativas ya pueden elegirla.`)
      }
      limpiar()
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
      setErrores(err.response?.data?.detalles || {})
    } finally {
      setEnviando(false)
    }
  }

  const cambiarEstado = async (marca) => {
    setError('')
    setAviso('')
    try {
      await api.patch(`/marcas/${marca.id}/estado`, { activa: !marca.activa })
      setAviso(marca.activa
        ? `${marca.nombre} ya no aparecerá al registrar buses. Los buses que la tienen la conservan.`
        : `${marca.nombre} está disponible nuevamente.`)
      cargar()
    } catch (err) {
      setError(mensajeDeError(err))
    }
  }

  return (
    <div className="container">
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Administración</span>
          <h1>Marcas de buses</h1>
          <p>Las cooperativas eligen de esta lista la marca del chasis y de la carrocería de cada bus.</p>
        </div>
      </div>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}
      {aviso && <div className="alerta alerta--exito" role="status"><Icono nombre="checkCirculo" /> {aviso}</div>}

      <div className="pestanas" role="tablist">
        {TIPOS.map((t) => (
          <button key={t.valor} type="button" role="tab" aria-selected={tipo === t.valor} onClick={() => { setTipo(t.valor); limpiar() }}>
            {t.texto} ({marcas.filter((m) => m.tipo === t.valor).length})
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', alignItems: 'start' }}>
        <form className="card" onSubmit={guardar} noValidate style={{ marginBottom: 0 }}>
          <div className="card-body">
            <h2>{editando ? `Corregir "${editando.nombre}"` : `Nueva marca de ${tipoActual.texto.toLowerCase()}`}</h2>
            <div className={`campo ${errores.nombre ? 'campo--error' : ''}`}>
              <label className="campo__etiqueta" htmlFor="marca-nombre">Nombre de la marca</label>
              <input id="marca-nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setErrores({}) }} placeholder={tipoActual.ejemplo} maxLength={40} />
              {errores.nombre
                ? <span className="campo__error">{errores.nombre}</span>
                : <span className="campo__ayuda">Escríbela tal como debe aparecer en los reportes.</span>}
            </div>
            {editando?.buses > 0 && (
              <div className="alerta alerta--info">Esta marca la usan {editando.buses} buses: también se corregirá en ellos.</div>
            )}
            <div className="fila">
              <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Guardando…' : editando ? 'Guardar corrección' : 'Agregar marca'}</button>
              {editando && <button type="button" className="btn" onClick={limpiar}>Cancelar</button>}
            </div>
          </div>
        </form>

        <section className="card" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Marca</th><th>Buses que la usan</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {visibles.map((m) => (
                  <tr key={m.id}>
                    <td><strong>{m.nombre}</strong></td>
                    <td>{m.buses}</td>
                    <td><span className={`insignia ${m.activa ? 'insignia--exito' : 'insignia--error'}`}>{m.activa ? 'Disponible' : 'Desactivada'}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="btn btn-sm" onClick={() => { setEditando(m); setNombre(m.nombre); setErrores({}) }}>Corregir</button>
                      <button type="button" className={`btn btn-sm ${m.activa ? 'btn-outline-danger' : 'btn-outline-success'}`} onClick={() => cambiarEstado(m)}>
                        {m.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr><td colSpan={4} className="text-center texto-suave" style={{ padding: '2rem' }}>Todavía no hay marcas de este tipo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
