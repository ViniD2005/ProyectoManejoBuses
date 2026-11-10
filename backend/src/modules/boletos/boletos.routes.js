const { Router } = require('express')
const controlador = require('./boletos.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// El cliente dueño del boleto o un oficinista de la cooperativa del viaje
rutas.get('/:codigo/pdf', autenticar, permitirRoles('cliente', 'oficinista'), controlador.descargarPdf)

module.exports = rutas
