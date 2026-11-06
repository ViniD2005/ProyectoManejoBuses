const { Router } = require('express')
const controlador = require('./pagos.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Solo el oficinista valida los pagos de los viajes de SU cooperativa
rutas.use(autenticar, permitirRoles('oficinista'))

rutas.get('/', controlador.listar)               // ?estado=en_revision (por defecto)
rutas.patch('/:id/validar', controlador.validar) // { aprobado: true } o { aprobado: false, motivo }

module.exports = rutas
