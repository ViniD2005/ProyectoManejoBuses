const { Router } = require('express')
const controlador = require('./auth.controller')
const { autenticar } = require('../../middlewares/auth')

const rutas = Router()

rutas.post('/login', controlador.login)
rutas.post('/registro', controlador.registro)
rutas.get('/perfil', autenticar, controlador.perfil)

// GC-12: correo de verificación y recuperación de contraseña (públicas)
rutas.post('/verificar-correo', controlador.verificarCorreo)
rutas.post('/reenviar-verificacion', controlador.reenviarVerificacion)
rutas.post('/olvide-contrasena', controlador.olvideContrasena)
rutas.post('/revisar-enlace', controlador.revisarEnlace)
rutas.post('/restablecer-contrasena', controlador.restablecerContrasena)

module.exports = rutas
