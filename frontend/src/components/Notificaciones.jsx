import { useEffect, useRef, useState } from 'react'
import api from '../services/api.js'
import Icono from './Icono.jsx'

// "hace 5 min", "ayer", "12 nov" — fecha relativa fácil de leer
function haceCuanto(fecha) {
  const minutos = Math.round((Date.now() - new Date(fecha).getTime()) / 60000)
  if (minutos < 1) return 'Ahora'
  if (minutos < 60) return `Hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `Hace ${horas} h`
  if (horas < 48) return 'Ayer'
  return new Date(fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })
}

// Campana con las notificaciones del usuario (CC-11, rediseño CC-19). Se actualiza cada 30 segundos.
function Notificaciones() {
  const [datos, setDatos] = useState({ no_leidas: 0, notificaciones: [] })
  const [abierto, setAbierto] = useState(false)
  const caja = useRef(null)

  const cargar = () =>
    api.get('/notificaciones')
      .then(({ data }) => setDatos(data))
      .catch(() => {})

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, 30000)
    return () => clearInterval(intervalo)
  }, [])

  // Cierra el panel al hacer clic fuera
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const marcarLeida = async (notificacion) => {
    if (notificacion.leida) return
    await api.patch(`/notificaciones/${notificacion.id}/leida`).catch(() => {})
    cargar()
  }

  const marcarTodas = async () => {
    await api.patch('/notificaciones/leidas').catch(() => {})
    cargar()
  }

  return (
    <div className="notif" ref={caja}>
      <button type="button" className="notif__boton" onClick={() => setAbierto(!abierto)}
        aria-label={`Notificaciones (${datos.no_leidas} sin leer)`} aria-expanded={abierto}>
        <Icono nombre="campana" />
        {datos.no_leidas > 0 && <span className="notif__globo">{datos.no_leidas > 9 ? '9+' : datos.no_leidas}</span>}
      </button>

      {abierto && (
        <div className="notif__panel">
          <div className="notif__cabecera">
            <strong>Notificaciones</strong>
            {datos.no_leidas > 0 && (
              <button type="button" className="btn btn--fantasma btn--sm" onClick={marcarTodas}>
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="notif__lista">
            {datos.notificaciones.length === 0 && (
              <div className="vacio" style={{ border: 0, borderRadius: 0 }}>
                <span className="vacio__icono"><Icono nombre="campana" /></span>
                <strong>Todo al día</strong>
                <span>Aquí verás avisos de tus compras y viajes.</span>
              </div>
            )}
            {datos.notificaciones.map((n) => (
              <button type="button" key={n.id} className={`notif__item ${n.leida ? '' : 'notif__item--nueva'}`}
                onClick={() => marcarLeida(n)}>
                <span className="notif__punto" />
                <span>
                  <span className="notif__titulo">{n.titulo}</span>
                  <span className="notif__texto">{n.mensaje}</span>
                  <span className="notif__fecha">{haceCuanto(n.creado_en)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Notificaciones
