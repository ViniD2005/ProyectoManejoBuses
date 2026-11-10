const { Router } = require('express')
const controlador = require('./configuracion.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Pública: la app la lee para mostrar nombre, logo, colores, redes y soporte
rutas.get('/', controlador.obtener)

// Solo el administrador la modifica
rutas.put('/', autenticar, permitirRoles('admin'), controlador.actualizar)

module.exports = rutas
