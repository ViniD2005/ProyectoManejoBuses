const { Router } = require('express')
const controlador = require('./provincias.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()
const soloAdmin = [autenticar, permitirRoles('admin')]

// GC-13: provincias del Ecuador
rutas.get('/', controlador.listar)
rutas.get('/gestion', ...soloAdmin, controlador.listarGestion)
rutas.post('/', ...soloAdmin, controlador.crear)
rutas.put('/:id', ...soloAdmin, controlador.actualizar)
rutas.patch('/:id/estado', ...soloAdmin, controlador.cambiarEstado)

module.exports = rutas
