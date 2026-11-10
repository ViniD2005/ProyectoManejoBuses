
const { Router } = require('express')
const controlador = require('./hojas-ruta.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Solo el usuario de cooperativa gestiona la hoja de ruta de SU cooperativa
rutas.use(autenticar, permitirRoles('cooperativa'))

rutas.get('/', controlador.obtener)   // ?fecha=AAAA-MM-DD
rutas.post('/', controlador.guardar)  // { fecha, generacion, asignaciones: [{ frecuencia_id, bus_id }] }

module.exports = rutas
