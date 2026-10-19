const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// Endpoint de salud: confirma que la API está funcionando
app.get('/api/salud', (req, res) => {
  res.json({ estado: 'ok' })
})

// Aquí se registrarán los módulos: app.use('/api/ciudades', require('./modules/ciudades/ciudades.routes'))

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` })
})

// Manejador de errores (Express 5 también captura los errores de funciones async)
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ mensaje: err.status ? err.message : 'Error interno del servidor' })
})

module.exports = app