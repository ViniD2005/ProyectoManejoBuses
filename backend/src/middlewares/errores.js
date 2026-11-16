/*
  Manejador central de errores (CC-21).
  Convierte cualquier error en una respuesta clara para el usuario final:
  { mensaje, detalles } — nunca muestra textos técnicos de PostgreSQL o de Node.
*/

// Registros duplicados: nombre de la restricción -> campo y mensaje
const DUPLICADOS = {
  usuario_cedula_key: ['cedula', 'Ya existe una cuenta registrada con esta cédula'],
  usuario_email_key: ['email', 'Este correo electrónico ya está registrado'],
  cooperativa_nombre_key: ['nombre', 'Ya existe una cooperativa con este nombre'],
  cooperativa_ruc_key: ['ruc', 'Ya existe una cooperativa registrada con este RUC'],
  bus_placa_key: ['placa', 'Ya existe un bus registrado con esta placa'],
  bus_cooperativa_id_numero_disco_key: ['numero_disco', 'Ya tienes un bus con este número de disco'],
  ciudad_nombre_key: ['nombre', 'Esta ciudad ya está registrada'],
  tipo_asiento_cooperativa_id_nombre_key: ['nombre', 'Ya tienes un tipo de asiento con este nombre'],
  turno_cooperativa_id_nombre_key: ['nombre', 'Ya tienes un turno con este nombre'],
  frecuencia_cooperativa_id_ciudad_origen_id_ciudad_destino_i_key: [
    'hora_salida', 'Ya tienes una frecuencia con el mismo origen, destino y hora de salida',
  ],
  viaje_frecuencia_id_fecha_key: ['fecha', 'Esa frecuencia ya tiene un viaje programado en esa fecha'],
}

function respuestaBaseDeDatos(err) {
  switch (err.code) {
    case '23505': { // valor repetido
      const duplicado = DUPLICADOS[err.constraint]
      if (duplicado) {
        const [campo, mensaje] = duplicado
        return [409, mensaje, { [campo]: mensaje }]
      }
      return [409, 'Ya existe un registro con esos datos. Revisa la información e inténtalo de nuevo.']
    }
    case '23503': // registro relacionado
      return [409, 'No se puede completar la acción porque este registro se está usando en otra parte del sistema.']
    case '23P01': // asiento vendido en un tramo que se cruza
      return [409, 'Uno de los asientos elegidos acaba de ser vendido en ese tramo. Elige otro asiento.']
    case '23514': // regla CHECK de la base
      return [400, 'Algunos datos no cumplen las reglas del sistema. Revisa la información.']
    case '23502': // campo obligatorio vacío
      return [400, 'Falta completar un dato obligatorio.']
    case '22P02': // formato inválido (por ejemplo, letras donde va un número)
    case '22007': // fecha inválida
    case '22008':
      return [400, 'Alguno de los datos no tiene el formato correcto.']
    case '22001': // texto demasiado largo
      return [400, 'Alguno de los textos es demasiado largo.']
    case '22003': // número fuera de rango
      return [400, 'Alguno de los números está fuera del rango permitido.']
    default:
      return null
  }
}

// eslint-disable-next-line no-unused-vars
function manejarErrores(err, req, res, next) {
  // JSON mal formado en el cuerpo de la petición
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ mensaje: 'La información enviada no tiene un formato válido.' })
  }
  // Cuerpo demasiado grande
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ mensaje: 'La información enviada es demasiado grande.' })
  }

  const deBaseDeDatos = respuestaBaseDeDatos(err)
  if (deBaseDeDatos) {
    const [status, mensaje, detalles] = deBaseDeDatos
    return res.status(status).json({ mensaje, detalles })
  }

  // Errores previstos por los servicios (errorHttp con status)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ mensaje: err.message, detalles: err.detalles })
  }

  // Error inesperado: se registra para el equipo y se responde con un mensaje amable
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err)
  res.status(500).json({
    mensaje: 'Ocurrió un problema inesperado. Inténtalo de nuevo en unos minutos.',
  })
}

module.exports = manejarErrores
