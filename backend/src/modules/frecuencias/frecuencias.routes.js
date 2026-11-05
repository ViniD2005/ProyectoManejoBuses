
const { Router } = require('express')
const controlador = require('./frecuencias.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Solo el usuario de cooperativa gestiona las
// frecuencias de su propia cooperativa
rutas.use(autenticar, permitirRoles('cooperativa'))

// GET: listar frecuencias
rutas.get('/', controlador.listar)

// GET: obtener frecuencia por ID
rutas.get('/:id', controlador.obtener)

// POST: crear frecuencia con paradas
rutas.post('/', controlador.crear)

// PATCH: activar o desactivar frecuencia
rutas.patch('/:id/estado', controlador.cambiarEstado)

module.exports = rutas
