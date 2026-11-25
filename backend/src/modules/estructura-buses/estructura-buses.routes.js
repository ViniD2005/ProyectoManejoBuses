const { Router } = require('express')
const controlador = require('./estructura-buses.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

// GC-18: solo el usuario de cooperativa arma la estructura de SUS buses
const rutas = Router()
rutas.use(autenticar, permitirRoles('cooperativa'))

rutas.get('/', controlador.listar)
rutas.get('/:id', controlador.obtener)
rutas.put('/:id', controlador.guardar)   // { pisos: [{ filas, izquierda, derecha, asientos: [{ fila, columna, tipo_asiento_id }] }] }

module.exports = rutas
