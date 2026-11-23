import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { mensajeDeError } from '../../services/api.js'
import { useAuth, INICIO_POR_ROL } from '../../context/AuthContext.jsx'
import { TarjetaCorreo, BotonReenviar, AccesoMailHog } from './PiezasCorreo.jsx'

/*
  GC-12: el cliente llega aquí desde el botón "Confirmar mi correo".
  Se confirma una sola vez por enlace (en desarrollo React ejecuta los
  efectos dos veces, por eso la petición se guarda por token).
*/
const peticiones = new Map()
const confirmar = (token) => {
  if (!peticiones.has(token)) peticiones.set(token, api.post('/auth/verificar-correo', { token }))
  return peticiones.get(token)
}

export default function VerificarCorreo() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token') || ''
  const { usuario } = useAuth()
  const [estado, setEstado] = useState({ fase: token ? 'cargando' : 'error', mensaje: 'El enlace está incompleto. Ábrelo de nuevo desde el correo.' })

  useEffect(() => {
    if (!token) return
    let activo = true
    confirmar(token)
      .then(({ data }) => activo && setEstado({ fase: data.ya_verificado ? 'ya' : 'exito', ...data }))
      .catch((err) => activo && setEstado({
        fase: 'error',
        mensaje: mensajeDeError(err),
        motivo: err.response?.data?.detalles?.motivo,
        email: err.response?.data?.detalles?.email,
      }))
    return () => { activo = false }
  }, [token])

  if (estado.fase === 'cargando') {
    return (
      <TarjetaCorreo icono="correo" titulo="Confirmando tu correo…">
        <p className="correo-tarjeta__texto"><span className="giro" /> Un momento, estamos activando tu cuenta.</p>
      </TarjetaCorreo>
    )
  }

  if (estado.fase === 'exito' || estado.fase === 'ya') {
    const destino = usuario ? INICIO_POR_ROL[usuario.rol] : '/login'
    return (
      <TarjetaCorreo icono="checkCirculo" tono="exito" titulo={estado.fase === 'exito' ? '¡Correo confirmado!' : 'Tu correo ya estaba confirmado'}
        pie="Te enviamos un correo de bienvenida con consejos para tu primer viaje.">
        <p className="correo-tarjeta__texto">
          {estado.fase === 'exito'
            ? 'Tu cuenta quedó activa. Inicia sesión y compra tus pasajes eligiendo el asiento que prefieras.'
            : 'No necesitas hacer nada más. Ya puedes iniciar sesión con tu correo y contraseña.'}
        </p>
        {estado.email && <div className="correo-tarjeta__email">{estado.email}</div>}
        <div className="correo-acciones">
          <Link to={destino} state={{ email: estado.email, verificado: true }} className="btn btn-primary btn--lg btn--bloque">
            {usuario ? 'Ir a mi inicio' : 'Iniciar sesión'}
          </Link>
          <Link to="/viajes" className="btn btn--bloque">Ver viajes disponibles</Link>
        </div>
      </TarjetaCorreo>
    )
  }

  // Enlace vencido, reemplazado o inválido: se ofrece pedir otro
  const puedeReenviar = Boolean(estado.email) && (estado.motivo === 'vencido' || estado.motivo === 'usado')
  return (
    <TarjetaCorreo icono={estado.motivo === 'vencido' ? 'reloj' : 'alerta'} tono="error"
      titulo={estado.motivo === 'vencido' ? 'El enlace venció' : 'No pudimos confirmar tu correo'}
      pie={<>¿Ya confirmaste antes? <Link to="/login">Inicia sesión</Link></>}>
      <p className="correo-tarjeta__texto">{estado.mensaje}</p>
      {puedeReenviar && <div className="correo-tarjeta__email">{estado.email}</div>}
      <div className="correo-acciones">
        {puedeReenviar
          ? <BotonReenviar ruta="/auth/reenviar-verificacion" email={estado.email} esperaInicial={0}
              texto="Enviarme un enlace nuevo" clase="btn btn-primary btn--lg btn--bloque" />
          : <Link to="/login" className="btn btn-primary btn--lg btn--bloque">Ir a iniciar sesión</Link>}
      </div>
      <AccesoMailHog />
    </TarjetaCorreo>
  )
}
