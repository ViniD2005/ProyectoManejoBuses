const { Router } = require('express')
const controlador = require('./buses.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')
const { subirFotoBus } = require('../../middlewares/subirFoto')

const rutas = Router()

// Solo el usuario de cooperativa gestiona los buses de SU cooperativa
rutas.use(autenticar, permitirRoles('cooperativa'))

rutas.get('/', controlador.listar)
rutas.post('/', controlador.crear)
rutas.put('/:id', controlador.actualizar)
rutas.patch('/:id/estado', controlador.cambiarEstado)
rutas.post('/:id/foto', subirFotoBus, controlador.actualizarFoto)  // CC-17, campo "foto"

module.exports = rutas
