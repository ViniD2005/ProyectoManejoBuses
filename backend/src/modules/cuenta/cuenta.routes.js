const { Router } = require('express')
const controlador = require('./cuenta.controller')
const { autenticar } = require('../../middlewares/auth')

// GC-36: cualquier usuario con sesión gestiona SU propia cuenta
const rutas = Router()
rutas.use(autenticar)

rutas.get('/', controlador.obtener)
rutas.put('/', controlador.actualizar)                  // { telefono, fecha_nacimiento }
rutas.put('/contrasena', controlador.cambiarContrasena) // { actual, nueva, confirmar }

module.exports = rutas
