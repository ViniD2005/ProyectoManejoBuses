
const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}))

app.use(express.json())

// Endpoint de salud: confirma que la API está funcionando
app.get('/api/salud', (req, res) => {
  res.json({ estado: 'ok' })
})

// ===================================
// REGISTRO DE MODULOS
// ===================================

// Frente D - Busqueda de viajes y asientos
app.use('/api/viajes', require('./modules/viajes/viajes.routes'));

// Modulo de cooperativas
app.use('/api/cooperativas', require('./modules/cooperativas/cooperativas.routes'));
app.use('/api/buses', require('./modules/buses/buses.routes'));
// Frente B - Flota (Tipos de Asiento)
app.use('/api/tipos-asiento', require('./modules/tipos-asiento/tipos-asiento.routes'));

app.use((req, res) => {
  res.status(404).json({
    mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  })
})

// ========================================
// MANEJADOR DE ERRORES
// ========================================

app.use((err, req, res, next) => {
  console.error(err)

  res.status(err.status || 500).json({
    mensaje: err.status
      ? err.message
      : 'Error interno del servidor'
  })
})

module.exports = app
