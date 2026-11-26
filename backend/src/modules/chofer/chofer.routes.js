const { Router } = require('express')
const controlador = require('./chofer.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

// GC-34: solo el personal del bus (chofer)
const rutas = Router()
rutas.use(autenticar, permitirRoles('personal_bus'))

rutas.get('/viajes', controlador.viajesDeHoy)                    // viajes de hoy de la cooperativa
rutas.get('/historial', controlador.historial)                   // ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
rutas.get('/viajes/:id', controlador.detalle)                    // detalle + pasajeros + paradas
rutas.post('/viajes/:id/iniciar', controlador.iniciar)
rutas.post('/viajes/:id/finalizar', controlador.finalizar)       // { observaciones }
rutas.post('/viajes/:id/validar', controlador.validarBoleto)     // { codigo }
rutas.post('/viajes/:id/vender', controlador.venderABordo)       // { subida, bajada, pasajeros: [...] }

module.exports = rutas
