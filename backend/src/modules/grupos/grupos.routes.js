const { Router } = require('express')
const controlador = require('./grupos.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

// GC-19: solo el usuario de cooperativa gestiona los grupos de SU cooperativa
const rutas = Router()
rutas.use(autenticar, permitirRoles('cooperativa'))

rutas.get('/', controlador.listar)
rutas.get('/recursos', controlador.recursos)        // buses y frecuencias con su grupo
rutas.post('/', controlador.crear)                   // { nombre, descripcion }
rutas.put('/:id', controlador.actualizar)
rutas.patch('/:id/estado', controlador.cambiarEstado) // { activo }
rutas.delete('/:id', controlador.eliminar)
rutas.put('/:id/buses', controlador.asignarBuses)            // { buses: [ids] }
rutas.put('/:id/frecuencias', controlador.asignarFrecuencias) // { frecuencias: [ids] }

module.exports = rutas
