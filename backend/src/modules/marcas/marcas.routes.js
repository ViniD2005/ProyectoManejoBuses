const { Router } = require('express')
const controlador = require('./marcas.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()
const soloAdmin = [autenticar, permitirRoles('admin')]

// GC-13: marcas de chasis y carrocería
rutas.get('/', autenticar, controlador.listar)            // ?tipo=chasis|carroceria
rutas.get('/gestion', ...soloAdmin, controlador.listarGestion)
rutas.post('/', ...soloAdmin, controlador.crear)
rutas.put('/:id', ...soloAdmin, controlador.actualizar)
rutas.patch('/:id/estado', ...soloAdmin, controlador.cambiarEstado)

module.exports = rutas
