import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import { useDialogo } from '../../hooks/useDialogo.jsx'
import './Chofer.css'

/*
  GC-34 - Viajes de hoy del chofer.
  El chofer ve las salidas de hoy de su cooperativa e inicia la suya
  (desde 60 minutos antes de la hora de salida). Solo puede tener un viaje en curso.
*/
const ESTADO = {
  programado: ['Programado', 'insignia--info'],
  en_curso: ['En curso', 'insignia--exito'],
  finalizado: ['Finalizado', ''],
  cancelado: ['Cancelado', 'insignia--error'],
}

function cuandoSale(minutos) {
  if (minutos <= 0) return 'Hora de salida cumplida'
  if (minutos < 60) return `Sale en ${minutos} min`
  return `Sale en ${Math.floor(minutos / 60)} h ${minutos % 60} min`
}

export default function ViajesHoy() {
  const navegar = useNavigate()
  const [viajes, setViajes] = useState(null)
  const [error, setError] = useState('')
  const [iniciando, setIniciando] = useState(null)
  const [dialogo, preguntar] = useDialogo()

  const cargar = () => api.get('/chofer/viajes')
    .then(({ data }) => setViajes(data))
    .catch((err) => setError(mensajeDeError(err)))

  useEffect(() => {
    cargar()
    // Se actualiza cada minuto: el botón «Iniciar» aparece 60 minutos antes de la salida
    const reloj = setInterval(cargar, 60000)
    return () => clearInterval(reloj)
  }, [])

  const miViaje = viajes?.find((v) => v.estado === 'en_curso' && v.es_mio)

  const iniciar = async (v) => {
    const ok = await preguntar({
      titulo: `¿Iniciar el viaje ${v.origen} → ${v.destino}?`,
      mensaje: `Bus ${v.numero_disco} (${v.placa}), salida ${v.hora_salida.slice(0, 5)}. Desde ahora el viaje queda a tu nombre y ya no se vende en línea ni en ventanilla; tú validas los boletos y vendes a bordo.`,
      textoConfirmar: 'Iniciar viaje',
      tono: 'exito',
    })
    if (!ok) return
    setError('')
    setIniciando(v.id)
    try {
      await api.post(`/chofer/viajes/${v.id}/iniciar`)
      navegar(`/chofer/viaje/${v.id}`)
    } catch (err) {
      setError(mensajeDeError(err))
      cargar()
    } finally {
      setIniciando(null)
    }
  }

  return (
    <div className="container">
      {dialogo}
      <div className="pagina-encabezado">
        <div>
          <span className="etiqueta-seccion">Chofer</span>
          <h1>Viajes de hoy</h1>
          <p>Inicia tu viaje desde 60 minutos antes de la salida. Mientras esté en curso podrás validar boletos y vender a bordo.</p>
        </div>
        <div className="pagina-encabezado__acciones">
          <button type="button" className="btn" onClick={() => navegar('/chofer/historial')}><Icono nombre="documento" /> Mi historial</button>
        </div>
      </div>

      {error && <div className="alerta alerta--error" role="alert"><Icono nombre="alerta" /> {error}</div>}

      {miViaje && (
        <div className="alerta alerta--exito">
          <Icono nombre="bus" />
          <div>
            <b>Tienes un viaje en curso: {miViaje.origen} → {miViaje.destino}</b>
            <div>Iniciado a las {new Date(miViaje.iniciado_en).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}. {miViaje.abordados} de {miViaje.boletos} pasajeros a bordo.</div>
            <button type="button" className="btn btn-success btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => navegar(`/chofer/viaje/${miViaje.id}`)}>Continuar el viaje</button>
          </div>
        </div>
      )}

      {!viajes && !error && <div className="cargando"><span className="giro" /> Cargando los viajes de hoy…</div>}
      {viajes?.length === 0 && (
        <div className="vacio">
          <span className="vacio__icono"><Icono nombre="calendario" tam={26} /></span>
          <h3>Hoy no hay viajes</h3>
          <p>La cooperativa todavía no generó la hoja de ruta de hoy.</p>
        </div>
      )}

      <div className="chofer__viajes">
        {viajes?.map((v) => {
          const [texto, clase] = ESTADO[v.estado] || [v.estado, '']
          return (
            <article key={v.id} className={`chofer__viaje ${v.es_mio && v.estado === 'en_curso' ? 'chofer__viaje--mio' : ''}`}>
              <div className="fila fila--entre">
                <span className="chofer__hora">{v.hora_salida.slice(0, 5)}</span>
                <span className={`insignia ${clase}`}>{texto}</span>
              </div>
              <div className="chofer__ruta">{v.origen} → {v.destino}</div>
              <div className="chofer__dato">
                Bus {v.numero_disco} · {v.placa} · {v.tipo_viaje === 'con_paradas' ? 'Con paradas' : 'Directo'}
                {v.chofer && <> · Chofer: {v.es_mio ? 'tú' : v.chofer}</>}
              </div>
              <div className="chofer__cifras">
                <span><b>{v.boletos}</b>/{v.capacidad} vendidos</span>
                <span><b>{v.abordados}</b> a bordo</span>
                {v.estado === 'programado' && <span>{cuandoSale(v.minutos_para_salir)}</span>}
              </div>
              {v.estado === 'programado' && (
                <button type="button" className="btn btn-primary btn--bloque" disabled={!v.puede_iniciar || Boolean(miViaje) || iniciando === v.id}
                  title={!v.puede_iniciar ? 'Disponible 60 minutos antes de la salida' : miViaje ? 'Finaliza primero tu viaje en curso' : ''}
                  onClick={() => iniciar(v)}>
                  {iniciando === v.id ? 'Iniciando…' : 'Iniciar viaje'}
                </button>
              )}
              {v.estado === 'en_curso' && v.es_mio && (
                <button type="button" className="btn btn-success btn--bloque" onClick={() => navegar(`/chofer/viaje/${v.id}`)}>Abrir viaje en curso</button>
              )}
              {v.estado === 'finalizado' && v.es_mio && (
                <button type="button" className="btn btn--bloque" onClick={() => navegar(`/chofer/viaje/${v.id}`)}>Ver resumen</button>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
