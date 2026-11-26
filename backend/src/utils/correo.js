const nodemailer = require('nodemailer')
const { pool } = require('../config/db')

/*
  GC-12 - Envío de correos.

  En desarrollo los correos NO salen a internet: llegan a MailHog, que los
  atrapa y los muestra en http://localhost:8025.
    - Con Docker:  SMTP_HOST=mailhog   SMTP_PORT=1025 (ya está en docker-compose.yml)
    - Sin Docker:  SMTP_HOST=localhost SMTP_PORT=1025 (MailHog instalado en tu PC)

  Si el servidor de correo no responde, el sistema NO se cae: escribe el enlace
  en la consola del backend para que puedas seguir probando.
*/

const transporte = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
  ignoreTLS: !process.env.SMTP_USER, // MailHog no usa TLS ni usuario
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  connectionTimeout: 4000,
  greetingTimeout: 4000,
})

const REMITENTE = process.env.SMTP_FROM || 'no-responder@pasajes.ec'
const URL_APP = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')

// Escapa el texto que viene de la base o del usuario antes de ponerlo en el HTML
const escapar = (texto = '') => String(texto)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Nombre, color y contacto de soporte que el administrador definió en Configuración
async function marca() {
  const porDefecto = { nombre_app: 'Pasajes Ecuador', color_primario: '#1f4e5f', color_acento: '#e8a317', soporte_email: '', soporte_telefono: '' }
  try {
    const { rows } = await pool.query(
      `SELECT clave, valor FROM configuracion_app
        WHERE clave IN ('nombre_app', 'color_primario', 'color_acento', 'soporte_email', 'soporte_telefono')`
    )
    for (const { clave, valor } of rows) if (valor) porDefecto[clave] = valor
  } catch {
    // Sin configuración se usan los valores por defecto
  }
  return porDefecto
}

/*
  Plantilla única para todos los correos (tablas y estilos en línea para que
  se vea bien en Gmail, Outlook y MailHog).
    titulo, saludo, parrafos[], boton { texto, url }, datos [[etiqueta, valor]],
    aviso (recuadro amarillo), pie (texto pequeño final)
*/
function plantilla(m, { previo, icono, titulo, saludo, parrafos = [], boton, datos = [], aviso, pie }) {
  const c = /^#[0-9a-f]{6}$/i.test(m.color_primario) ? m.color_primario : '#1f4e5f'
  const acento = /^#[0-9a-f]{6}$/i.test(m.color_acento) ? m.color_acento : '#e8a317'
  const fuente = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  const anio = new Date().getFullYear()

  const filasDatos = datos.length ? `
      <tr><td style="padding:0 40px 8px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f8fb;border:1px solid #e3e8ef;border-radius:12px">
          ${datos.map(([etiqueta, valor], i) => `
          <tr>
            <td style="${fuente};padding:12px 18px;font-size:13px;color:#64748b;${i ? 'border-top:1px solid #e3e8ef;' : ''}">${escapar(etiqueta)}</td>
            <td align="right" style="${fuente};padding:12px 18px;font-size:14px;font-weight:700;color:#0f172a;${i ? 'border-top:1px solid #e3e8ef;' : ''}">${escapar(valor)}</td>
          </tr>`).join('')}
        </table>
      </td></tr>` : ''

  const bloqueBoton = boton ? `
      <tr><td align="center" style="padding:16px 40px 8px">
        <table role="presentation" cellspacing="0" cellpadding="0"><tr>
          <td style="border-radius:12px;background:${c};box-shadow:0 8px 20px -8px ${c}">
            <a href="${escapar(boton.url)}" target="_blank"
               style="${fuente};display:inline-block;padding:15px 34px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">
              ${escapar(boton.texto)} &rarr;
            </a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="${fuente};padding:14px 40px 4px;font-size:12.5px;line-height:1.6;color:#64748b;text-align:center">
        ¿El botón no funciona? Copia este enlace en tu navegador:<br>
        <a href="${escapar(boton.url)}" style="color:${c};word-break:break-all">${escapar(boton.url)}</a>
      </td></tr>` : ''

  const bloqueAviso = aviso ? `
      <tr><td style="padding:18px 40px 0">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8e6;border-left:4px solid ${acento};border-radius:8px">
          <tr><td style="${fuente};padding:12px 16px;font-size:13.5px;line-height:1.55;color:#6b4e00">${aviso}</td></tr>
        </table>
      </td></tr>` : ''

  const contacto = [m.soporte_email && escapar(m.soporte_email), m.soporte_telefono && escapar(m.soporte_telefono)].filter(Boolean).join(' &nbsp;·&nbsp; ')

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#eef2f6">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapar(previo || titulo)}</span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f6;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px">
        <!-- Marca -->
        <tr><td style="padding:0 8px 18px">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td style="width:40px;height:40px;border-radius:12px;background:${c};text-align:center;font-size:21px;line-height:40px">🚌</td>
            <td style="${fuente};padding-left:12px;font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-.01em">${escapar(m.nombre_app)}</td>
          </tr></table>
        </td></tr>

        <!-- Tarjeta -->
        <tr><td style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 40px -24px rgba(15,23,42,.35)">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td style="height:6px;background:${c};background:linear-gradient(90deg,${c},${acento});font-size:0;line-height:0">&nbsp;</td></tr>
            <tr><td align="center" style="padding:38px 40px 6px">
              <div style="width:72px;height:72px;border-radius:50%;background:${c}14;font-size:34px;line-height:72px;text-align:center">${icono || '✉️'}</div>
            </td></tr>
            <tr><td style="${fuente};padding:14px 40px 4px;font-size:25px;line-height:1.25;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-.02em">
              ${escapar(titulo)}
            </td></tr>
            ${saludo ? `<tr><td style="${fuente};padding:16px 40px 0;font-size:16px;font-weight:600;color:#0f172a">${escapar(saludo)}</td></tr>` : ''}
            ${parrafos.map((p) => `<tr><td style="${fuente};padding:10px 40px 0;font-size:15px;line-height:1.65;color:#334155">${p}</td></tr>`).join('')}
            <tr><td style="height:14px"></td></tr>
            ${filasDatos}
            ${bloqueBoton}
            ${bloqueAviso}
            <tr><td style="${fuente};padding:26px 40px 34px;font-size:13px;line-height:1.6;color:#94a3b8">
              ${pie || 'Si no reconoces esta acción, puedes ignorar este correo con tranquilidad: tu cuenta sigue segura.'}
            </td></tr>
          </table>
        </td></tr>

        <!-- Pie -->
        <tr><td style="${fuente};padding:22px 16px 0;font-size:12px;line-height:1.7;color:#94a3b8;text-align:center">
          ${contacto ? `¿Necesitas ayuda? ${contacto}<br>` : ''}
          Este es un correo automático, por favor no lo respondas.<br>
          © ${anio} ${escapar(m.nombre_app)} · Pasajes interprovinciales del Ecuador
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

// Versión en texto plano (algunos clientes de correo solo muestran texto)
function textoPlano({ titulo, saludo, parrafos = [], boton, datos = [] }) {
  const limpio = (t) => String(t).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  return [
    titulo, '', saludo, ...parrafos.map(limpio), '',
    ...datos.map(([e, v]) => `${e}: ${v}`),
    boton ? `\n${boton.texto}: ${boton.url}` : '',
  ].filter((l) => l !== undefined).join('\n')
}

async function enviar(para, asunto, contenido) {
  const m = await marca()
  try {
    const info = await transporte.sendMail({
      from: `"${m.nombre_app}" <${REMITENTE}>`,
      to: para,
      subject: asunto,
      html: plantilla(m, contenido),
      text: textoPlano(contenido),
    })
    console.log(`[correo] "${asunto}" enviado a ${para} (${info.messageId})`)
    return true
  } catch (error) {
    // El registro o la recuperación no fallan por el correo: se deja el enlace en la consola
    console.warn(`[correo] No se pudo enviar "${asunto}" a ${para}: ${error.message}`)
    if (contenido.boton) console.warn(`[correo] Enlace para probar sin MailHog: ${contenido.boton.url}`)
    return false
  }
}

const primerNombre = (usuario) => String(usuario.nombres || '').trim().split(/\s+/)[0] || ''

// ── Correos del sistema ────────────────────────────────────────────────

function enviarVerificacion(usuario, token, horas) {
  return enviar(usuario.email, 'Confirma tu correo para activar tu cuenta', {
    previo: 'Un clic y tu cuenta queda lista para comprar pasajes.',
    icono: '✉️',
    titulo: 'Confirma tu correo electrónico',
    saludo: `¡Hola, ${primerNombre(usuario)}!`,
    parrafos: [
      'Gracias por crear tu cuenta. Para proteger tus compras necesitamos confirmar que este correo es tuyo.',
      'Presiona el botón y tu cuenta quedará activa al instante.',
    ],
    datos: [['Cuenta', usuario.email], ['El enlace vence en', `${horas} horas`]],
    boton: { texto: 'Confirmar mi correo', url: `${URL_APP()}/verificar-correo?token=${token}` },
    pie: 'Si tú no creaste esta cuenta, ignora este correo: sin la confirmación nadie podrá usarla.',
  })
}

function enviarBienvenida(usuario) {
  return enviar(usuario.email, '¡Tu cuenta está activa! Ya puedes comprar pasajes', {
    previo: 'Tu correo quedó confirmado. Busca tu próximo viaje.',
    icono: '🎉',
    titulo: '¡Bienvenido a bordo!',
    saludo: `${primerNombre(usuario)}, tu cuenta ya está activa.`,
    parrafos: [
      'Ahora puedes buscar viajes entre cantones de todo el país, elegir tu asiento en el mapa del bus y llevar tu boleto con código QR en el celular.',
      '<strong>Consejo:</strong> registra tu fecha de nacimiento correcta; con ella el sistema aplica los descuentos de ley para niños y adultos mayores.',
    ],
    boton: { texto: 'Buscar mi próximo viaje', url: `${URL_APP()}/viajes` },
    pie: 'Recibiste este correo porque acabas de confirmar tu cuenta.',
  })
}

function enviarRecuperacion(usuario, token, minutos, solicitud = {}) {
  const datos = [['Cuenta', usuario.email], ['El enlace vence en', `${minutos} minutos`]]
  if (solicitud.fecha) datos.push(['Solicitado el', solicitud.fecha])
  return enviar(usuario.email, 'Restablece tu contraseña', {
    previo: 'Recibimos una solicitud para cambiar tu contraseña.',
    icono: '🔑',
    titulo: 'Restablece tu contraseña',
    saludo: `Hola, ${primerNombre(usuario)}:`,
    parrafos: ['Recibimos una solicitud para restablecer la contraseña de tu cuenta. Presiona el botón para crear una nueva.'],
    datos,
    boton: { texto: 'Crear nueva contraseña', url: `${URL_APP()}/restablecer-contrasena?token=${token}` },
    aviso: '<strong>¿No fuiste tú?</strong> Ignora este correo. Tu contraseña actual seguirá funcionando y el enlace dejará de servir solo.',
    pie: 'Por seguridad, el enlace sirve una sola vez. Nunca te pediremos tu contraseña por correo ni por teléfono.',
  })
}

function enviarAvisoCambioClave(usuario, fecha) {
  return enviar(usuario.email, 'Tu contraseña fue cambiada', {
    previo: 'La contraseña de tu cuenta se cambió correctamente.',
    icono: '🛡️',
    titulo: 'Tu contraseña fue cambiada',
    saludo: `Hola, ${primerNombre(usuario)}:`,
    parrafos: ['Te confirmamos que la contraseña de tu cuenta se cambió correctamente. Desde ahora inicia sesión con la nueva.'],
    datos: [['Cuenta', usuario.email], ['Fecha del cambio', fecha]],
    boton: { texto: 'Iniciar sesión', url: `${URL_APP()}/login` },
    aviso: '<strong>¿No fuiste tú?</strong> Restablece tu contraseña de inmediato desde «¿Olvidaste tu contraseña?» y comunícate con soporte.',
    pie: 'Te enviamos este aviso para mantener tu cuenta protegida.',
  })
}

module.exports = { enviar, enviarVerificacion, enviarBienvenida, enviarRecuperacion, enviarAvisoCambioClave }
