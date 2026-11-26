import { useCallback, useRef, useState } from 'react'
import Dialogo from '../components/Dialogo.jsx'

/*
  GC-16: abre la ventana de confirmación del sistema y espera la respuesta.
  Devuelve [elemento para dibujar en la página, preguntar(opciones) => Promise].
    - Confirmación: la promesa devuelve true (acepta) o false (cancela).
    - Con pedirMotivo: devuelve el texto escrito o null (cancela).
*/
export function useDialogo() {
  const [actual, setActual] = useState(null)
  const resolver = useRef(null)

  const preguntar = useCallback((opciones) => new Promise((resolve) => {
    resolver.current = resolve
    setActual(opciones)
  }), [])

  const responder = useCallback((respuesta) => {
    resolver.current?.(respuesta)
    resolver.current = null
    setActual(null)
  }, [])

  const elemento = actual ? <Dialogo opciones={actual} alResponder={responder} /> : null
  return [elemento, preguntar]
}

