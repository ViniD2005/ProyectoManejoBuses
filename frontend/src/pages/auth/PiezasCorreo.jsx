import { useEffect, useState } from 'react'
import api, { mensajeDeError } from '../../services/api.js'
import Icono from '../../components/Icono.jsx'
import './Correo.css'

/*
  GC-12 - Piezas que comparten las pantallas de correo:
    TarjetaCorreo   tarjeta centrada con ilustración, título y texto
    BotonReenviar   pide otro correo y espera 60 s antes de dejar pedir de nuevo
    AccesoMailHog   (solo en desarrollo) abre la bandeja de MailHog
*/

export function TarjetaCorreo({ icono = 'correo', tono, insignia, titulo, children, pie }) {
  return (
    <div className="correo-pagina">
      <section className="correo-tarjeta" aria-live="polite">
        <div className="correo-tarjeta__cuerpo">
          <div className={`correo-ilustracion ${tono ? `correo-ilustracion--${tono}` : ''}`}>
            <Icono nombre={icono} tam={46} />
            {insignia && <span className="correo-ilustracion__insignia">{insignia}</span>}
          </div>
          <h1>{titulo}</h1>
          {children}
        </div>
        {pie && <div className="correo-tarjeta__pie">{pie}</div>}
      </section>
    </div>
  )
}

/*
  ruta: '/auth/reenviar-verificacion' o '/auth/olvide-contrasena'
  esperaInicial: segundos de espera al mostrarse (60 si se acaba de enviar)
*/
export function BotonReenviar({ ruta, email, esperaInicial = 60, texto = 'Reenviar el correo', clase = 'btn btn--bloque' }) {
  const [espera, setEspera] = useState(esperaInicial)
  const [estado, setEstado] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (espera <= 0) return
    const id = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [espera])

  const reenviar = async () => {
    setEnviando(true)
    setEstado(null)
    try {
      const { data } = await api.post(ruta, { email })
      setEstado({ tipo: 'exito', texto: 'Listo, te enviamos un correo nuevo. El enlace anterior ya no sirve.' })
      setEspera(data.espera || 60)
    } catch (err) {
      setEstado({ tipo: 'error', texto: mensajeDeError(err) })
      if (err.response?.data?.detalles?.espera) setEspera(err.response.data.detalles.espera)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {estado && <div className={`alerta alerta--${estado.tipo}`} role="status" style={{ textAlign: 'left', marginBottom: 0 }}>{estado.texto}</div>}
      <button type="button" className={`${clase} correo-reenviar`} onClick={reenviar} disabled={enviando || espera > 0 || !email}>
        <Icono nombre="correo" tam={18} />
        {enviando ? 'Enviando…' : espera > 0
          ? <>Podrás reenviarlo en <span className="correo-reenviar__tiempo">{Math.floor(espera / 60)}:{String(espera % 60).padStart(2, '0')}</span></>
          : texto}
      </button>
    </>
  )
}

// Atajo para el equipo: los correos de desarrollo se ven en MailHog (no llegan a Gmail)
export function AccesoMailHog() {
  if (!import.meta.env.DEV) return null
  const url = import.meta.env.VITE_MAILHOG_URL || 'http://localhost:8025'
  return (
    <a className="correo-mailhog" href={url} target="_blank" rel="noreferrer">
      <Icono nombre="correo" tam={16} /> Abrir la bandeja de MailHog <small>(solo en desarrollo)</small>
    </a>
  )
}
