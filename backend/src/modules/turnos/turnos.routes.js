const { Router } = require('express')
const controlador = require('./turnos.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Solo el usuario de cooperativa gestiona los turnos de SU cooperativa
rutas.use(autenticar, permitirRoles('cooperativa'))

rutas.get('/', controlador.listar)
rutas.post('/', controlador.crear)
rutas.get('/semana', controlador.semana)                  // ?desde=AAAA-MM-DD
rutas.post('/generar-semana', controlador.generarSemana)  // { desde }
rutas.put('/:id', controlador.actualizar)
rutas.delete('/:id', controlador.eliminar)

module.exports = rutas
