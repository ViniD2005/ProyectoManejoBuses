const { Router } = require('express')
const controlador = require('./usuarios.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Admin: todos los usuarios internos. Cooperativa: sus oficinistas y personal del bus.
rutas.use(autenticar, permitirRoles('admin', 'cooperativa'))

rutas.get('/', controlador.listar)
rutas.post('/', controlador.crear)
rutas.patch('/:id/estado', controlador.cambiarEstado)

module.exports = rutas
