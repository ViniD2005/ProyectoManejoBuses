const { Router } = require('express')
const controlador = require('./boletos.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// El cliente dueño del boleto o un oficinista de la cooperativa del viaje
// GC-15: todos los boletos de una compra (cliente dueño)
// GC-22: también el oficinista que vende en ventanilla (imprimir todos)
rutas.get('/compra/:compraId/pdf', autenticar, permitirRoles('cliente', 'oficinista'), controlador.descargarPdfCompra)
rutas.get('/:codigo/pdf', autenticar, permitirRoles('cliente', 'oficinista'), controlador.descargarPdf)

module.exports = rutas
