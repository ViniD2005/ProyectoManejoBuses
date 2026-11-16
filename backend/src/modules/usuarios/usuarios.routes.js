const { Router } = require('express')
const controlador = require('./usuarios.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Admin: todos los usuarios internos. Cooperativa: sus oficinistas y personal del bus.
rutas.use(autenticar, permitirRoles('admin', 'cooperativa'))

rutas.get('/', controlador.listar)
rutas.post('/', controlador.crear)
rutas.patch('/:id/estado', controlador.cambiarEstado)

// CC-22: solo el administrador busca usuarios registrados y les asigna un rol
rutas.get('/buscar', permitirRoles('admin'), controlador.buscar)          // ?texto=
rutas.patch('/:id/rol', permitirRoles('admin'), controlador.asignarRol)   // { rol, cooperativa_id }

module.exports = rutas
