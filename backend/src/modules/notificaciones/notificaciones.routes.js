const { Router } = require('express')
const controlador = require('./notificaciones.controller')
const { autenticar } = require('../../middlewares/auth')

const rutas = Router()

// Cada usuario con sesión ve y marca solo SUS notificaciones
rutas.use(autenticar)

rutas.get('/', controlador.listar)
rutas.patch('/leidas', controlador.marcarTodasLeidas)
rutas.patch('/:id/leida', controlador.marcarLeida)

module.exports = rutas
