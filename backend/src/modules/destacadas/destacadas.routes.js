const { Router } = require('express')
const controlador = require('./destacadas.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

// GC-35: rutas destacadas
const rutas = Router()
rutas.use(autenticar)

// Administrador: plan de cada cooperativa (el pago se registra por fuera del sistema)
rutas.get('/planes', permitirRoles('admin'), controlador.listarPlanes)
rutas.put('/planes/:id', permitirRoles('admin'), controlador.guardarPlan)          // { cantidad, hasta }

// Cooperativa: su cupo y marcar/desmarcar una frecuencia
rutas.get('/mi-plan', permitirRoles('cooperativa'), controlador.miPlan)
rutas.patch('/frecuencias/:id', permitirRoles('cooperativa'), controlador.marcar)  // { destacada: true|false }

module.exports = rutas
