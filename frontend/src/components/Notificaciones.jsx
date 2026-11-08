import { useEffect, useState } from 'react'
import api from '../services/api.js'

const estilos = {
  contenedor: { position: 'relative' },
  boton: { position: 'relative', background: 'transparent', border: '1px solid #fff', color: '#fff', borderRadius: 6, padding: '2px 10px', cursor: 'pointer' },
  globo: { position: 'absolute', top: -8, right: -8, background: '#e8a317', color: '#1f2a33', borderRadius: 10, padding: '0 6px', fontSize: 12, fontWeight: 700 },
  panel: { position: 'absolute', right: 0, top: '120%', width: 340, maxHeight: 420, overflowY: 'auto', background: '#fff', color: '#1f2a33', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 20 },
  cabecera: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #e2e8ec' },
  item: { padding: '10px 12px', borderBottom: '1px solid #eef2f4', cursor: 'pointer' },
  vacio: { padding: 12, color: '#5b6b76' },
}

// Campana con las notificaciones del usuario (CC-11). Se actualiza cada 30 segundos.
function Notificaciones() {
  const [datos, setDatos] = useState({ no_leidas: 0, notificaciones: [] })
  const [abierto, setAbierto] = useState(false)

  const cargar = () =>
    api.get('/notificaciones')
      .then(({ data }) => setDatos(data))
      .catch(() => {})

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, 30000)
    return () => clearInterval(intervalo)
  }, [])

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
    <div style={estilos.contenedor}>
      <button type="button" style={estilos.boton} onClick={() => setAbierto(!abierto)}
        aria-label={`Notificaciones (${datos.no_leidas} sin leer)`}>
        🔔
        {datos.no_leidas > 0 && <span style={estilos.globo}>{datos.no_leidas}</span>}
      </button>

      {abierto && (
        <div style={estilos.panel}>
          <div style={estilos.cabecera}>
            <strong>Notificaciones</strong>
            {datos.no_leidas > 0 && (
              <button type="button" onClick={marcarTodas}>Marcar todas como leídas</button>
            )}
          </div>
          {datos.notificaciones.length === 0 && <p style={estilos.vacio}>No tienes notificaciones.</p>}
          {datos.notificaciones.map((n) => (
            <div key={n.id} style={{ ...estilos.item, background: n.leida ? '#fff' : '#eef6fb' }}
              onClick={() => marcarLeida(n)}>
              <strong>{n.titulo}</strong>
              <p style={{ margin: '4px 0' }}>{n.mensaje}</p>
              <small style={{ color: '#5b6b76' }}>{new Date(n.creado_en).toLocaleString('es-EC')}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Notificaciones
