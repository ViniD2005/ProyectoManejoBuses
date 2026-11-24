import { useEffect, useRef, useState } from 'react'
import Icono from './Icono.jsx'
import './Dialogo.css'

/*
  GC-16: ventana de confirmación propia del sistema.
  Reemplaza a window.confirm y window.prompt, que se ven distintos en cada
  navegador, no siguen los colores de la cooperativa y no validan nada.

  Se usa con el hook useDialogo (hooks/useDialogo.jsx):
    const [dialogo, preguntar] = useDialogo()
    ...
    const ok = await preguntar({ titulo: '¿Eliminar?', mensaje: '…', textoConfirmar: 'Eliminar', tono: 'peligro' })
    if (!ok) return
    // con motivo (en lugar de prompt): devuelve el texto escrito o null si cancela
    const motivo = await preguntar({ titulo: 'Rechazar pago', pedirMotivo: true, minimo: 10 })
    ...
    return <>{dialogo} … </>
*/

const ICONO_TONO = { normal: 'info', exito: 'checkCirculo', peligro: 'alerta' }
const BOTON_TONO = { normal: 'btn-primary', exito: 'btn-success', peligro: 'btn-danger' }

function Dialogo({ opciones, alResponder }) {
  const {
    titulo,
    mensaje,
    detalle,
    textoConfirmar = 'Aceptar',
    textoCancelar = 'Cancelar',
    tono = 'normal',
    pedirMotivo = false,
    etiquetaMotivo = 'Motivo',
    placeholderMotivo = '',
    minimo = 5,
    maximo = 300,
  } = opciones
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const campo = useRef(null)
  const botonConfirmar = useRef(null)

  // Enfoca el campo (o el botón) al abrir y cierra con Escape
  useEffect(() => {
    ;(pedirMotivo ? campo : botonConfirmar).current?.focus()
    const alTeclear = (e) => { if (e.key === 'Escape') alResponder(pedirMotivo ? null : false) }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [pedirMotivo, alResponder])

  const confirmar = (e) => {
    e.preventDefault()
    if (!pedirMotivo) return alResponder(true)
    const texto = motivo.trim().replace(/\s+/g, ' ')
    if (texto.length < minimo) return setError(`Escribe al menos ${minimo} caracteres para que el cliente entienda el motivo`)
    alResponder(texto)
  }

  return (
    <div className="capa capa--centro" role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) alResponder(pedirMotivo ? null : false) }}>
      <form className="modal dialogo" role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo" onSubmit={confirmar} noValidate>
        <div className="dialogo__cuerpo">
          <span className={`dialogo__icono dialogo__icono--${tono}`}><Icono nombre={ICONO_TONO[tono] || 'info'} tam={24} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="dialogo-titulo">{titulo}</h2>
            {mensaje && <p>{mensaje}</p>}
            {detalle && <div className="dialogo__detalle">{detalle}</div>}
            {pedirMotivo && (
              <div className={`campo ${error ? 'campo--error' : ''}`} style={{ marginTop: '1rem', marginBottom: 0 }}>
                <label className="campo__etiqueta" htmlFor="dialogo-motivo">{etiquetaMotivo}</label>
                <textarea id="dialogo-motivo" ref={campo} rows={3} maxLength={maximo} value={motivo} placeholder={placeholderMotivo}
                  onChange={(e) => { setMotivo(e.target.value); setError('') }} aria-invalid={!!error} />
                {error
                  ? <span className="campo__error">{error}</span>
                  : <span className="campo__ayuda">{motivo.trim().length}/{maximo}</span>}
              </div>
            )}
          </div>
        </div>
        <div className="dialogo__pie">
          <button type="button" className="btn" onClick={() => alResponder(pedirMotivo ? null : false)}>{textoCancelar}</button>
          <button ref={botonConfirmar} className={`btn ${BOTON_TONO[tono] || 'btn-primary'}`}>{textoConfirmar}</button>
        </div>
      </form>
    </div>
  )
}

export default Dialogo
