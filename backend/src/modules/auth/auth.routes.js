const { Router } = require('express')
const controlador = require('./auth.controller')
const { autenticar } = require('../../middlewares/auth')

const rutas = Router()

rutas.post('/login', controlador.login)
rutas.post('/registro', controlador.registro)
rutas.get('/perfil', autenticar, controlador.perfil)

module.exports = rutas
