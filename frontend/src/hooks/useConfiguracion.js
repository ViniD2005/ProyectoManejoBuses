import { useEffect, useState } from 'react'
import api from '../services/api.js'

// Valores por defecto mientras carga (o si el backend no responde)
const POR_DEFECTO = {
  nombre_app: 'Pasajes Ecuador',
  logo_url: '',
  color_primario: '#1f4e5f',
  color_acento: '#e8a317',
  soporte_email: '',
  soporte_telefono: '',
  facebook_url: '',
  instagram_url: '',
  cuenta_bancaria: '',
}

// Evento que dispara la pantalla de configuración al guardar, para refrescar la app
export const EVENTO_CONFIGURACION = 'configuracion-actualizada'

/*
  Devuelve la configuración de la app (CC-12) y aplica los colores
  a las variables CSS --color-primario y --color-acento.
*/
export function useConfiguracion() {
  const [configuracion, setConfiguracion] = useState(POR_DEFECTO)

  useEffect(() => {
    const cargar = () =>
      api.get('/configuracion')
        .then(({ data }) => setConfiguracion({ ...POR_DEFECTO, ...data }))
        .catch(() => {})
    cargar()
    window.addEventListener(EVENTO_CONFIGURACION, cargar)
    return () => window.removeEventListener(EVENTO_CONFIGURACION, cargar)
  }, [])

  useEffect(() => {
    const raiz = document.documentElement.style
    if (configuracion.color_primario) raiz.setProperty('--color-primario', configuracion.color_primario)
    if (configuracion.color_acento) raiz.setProperty('--color-acento', configuracion.color_acento)
    document.title = configuracion.nombre_app || POR_DEFECTO.nombre_app
  }, [configuracion])

  return configuracion
}
