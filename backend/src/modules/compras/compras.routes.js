const { Router } = require('express')
const controlador = require('./compras.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Público: métodos de pago y tipos de descuento para el formulario de compra
rutas.get('/catalogos', controlador.catalogos)

// Solo clientes con sesión
rutas.post('/', autenticar, permitirRoles('cliente'), controlador.crear)
rutas.get('/mias', autenticar, permitirRoles('cliente'), controlador.listarMias)

module.exports = rutas
