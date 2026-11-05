const { Router } = require('express')
const controlador = require('./tipos-asiento.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Solo el usuario de cooperativa gestiona los tipos de asiento de SU cooperativa
rutas.use(autenticar, permitirRoles('cooperativa'))

rutas.get('/', controlador.listar)
rutas.post('/', controlador.crear)
rutas.put('/:id', controlador.actualizar)
rutas.delete('/:id', controlador.eliminar)

module.exports = rutas
