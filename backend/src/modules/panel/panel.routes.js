const { Router } = require('express')
const controlador = require('./panel.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// GC-9: panel de inicio del personal de la cooperativa
rutas.get('/', autenticar, permitirRoles('cooperativa', 'oficinista', 'personal_bus'), controlador.resumen)

module.exports = rutas
