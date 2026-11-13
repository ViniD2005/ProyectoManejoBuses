const { Router } = require('express')
const controlador = require('./accesos.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Solo el personal del bus (chofer o ayudante) registra el abordaje
rutas.use(autenticar, permitirRoles('personal_bus'))

rutas.get('/viajes-hoy', controlador.viajesDeHoy)
rutas.post('/', controlador.registrarAbordaje)  // { codigo, viaje_id (opcional) }

module.exports = rutas
