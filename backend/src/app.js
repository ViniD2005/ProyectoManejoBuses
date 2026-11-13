
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}))

app.use(express.json())

// Archivos subidos (comprobantes de pago)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// ========================================
// ENDPOINT DE SALUD
// ========================================

// Confirma que la API esta funcionando
app.get('/api/salud', (req, res) => {
  res.json({ estado: 'ok' })
})

// ========================================
// REGISTRO DE MODULOS
// ========================================

// Tarea 0 - Autenticacion
app.use('/api/auth', require('./modules/auth/auth.routes'))

// Tarea 0 - Ciudades
app.use('/api/ciudades', require('./modules/ciudades/ciudades.routes'))
// CC-11 - Notificaciones dentro de la aplicacion
app.use('/api/notificaciones', require('./modules/notificaciones/notificaciones.routes'));

// Frente D - Busqueda de viajes y asientos
app.use('/api/viajes', require('./modules/viajes/viajes.routes'))

// Modulo de cooperativas
app.use('/api/cooperativas', require('./modules/cooperativas/cooperativas.routes'))

// Frente B - Modulo de buses
app.use('/api/buses', require('./modules/buses/buses.routes'))
// CC-12 - Configuracion de la aplicacion
app.use('/api/configuracion', require('./modules/configuracion/configuracion.routes'))

// Frente B - Tipos de asiento
app.use('/api/tipos-asiento', require('./modules/tipos-asiento/tipos-asiento.routes'))

// ========================================
// FRENTE C - FERNANDO
// FRECUENCIAS Y PARADAS
// ========================================

// Registrar rutas del modulo de frecuencias
app.use(
  '/api/frecuencias',
  require('./modules/frecuencias/frecuencias.routes')
)

// ========================================
// FRENTE C - FERNANDO
// HOJAS DE RUTA
// ========================================

// Registrar rutas del modulo de hojas de ruta
app.use(
  '/api/hojas-ruta',
  require('./modules/hojas-ruta/hojas-ruta.routes')
)

// ========================================
// MODULO DE COMPRAS
// ========================================

app.use('/api/compras', require('./modules/compras/compras.routes'))

// Frente E - Validacion de pagos (oficinista)
app.use('/api/pagos', require('./modules/pagos/pagos.routes'))

// CC-13 - Turnos y hoja de ruta semanal
app.use('/api/turnos', require('./modules/turnos/turnos.routes'))

// CC-6 - Boletos en PDF con codigo QR
app.use('/api/boletos', require('./modules/boletos/boletos.routes'))

// ========================================
// RUTAS NO ENCONTRADAS
// ========================================

app.use((req, res) => {
  res.status(404).json({
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  })
})

// ========================================
// MANEJADOR DE ERRORES
// ========================================

app.use((err, req, res, next) => {

  // Registro duplicado en PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({
      mensaje: 'Ya existe un registro con esos datos'
    })
  }

  // Error de clave foranea
  if (err.code === '23503') {
    return res.status(409).json({
      mensaje: 'El registro está relacionado con otros datos'
    })
  }

  // Conflicto de asiento vendido
  if (err.code === '23P01') {
    return res.status(409).json({
      mensaje: 'El asiento ya está vendido en ese tramo'
    })
  }

  // Registrar errores inesperados
  if (!err.status) {
    console.error(err)
  }

  // Respuesta de error
  res.status(err.status || 500).json({
    mensaje: err.status
      ? err.message
      : 'Error interno del servidor',
    detalles: err.detalles
  })
})

// ========================================
// EXPORTAR APLICACION
// ========================================

module.exports = app
