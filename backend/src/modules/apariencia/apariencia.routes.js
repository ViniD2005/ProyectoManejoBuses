const { Router } = require('express')
const controlador = require('./apariencia.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')
const { subirLogoCooperativa } = require('../../middlewares/subirLogo')

const rutas = Router()

// CC-24: apariencia de la cooperativa del usuario (va antes de /:id)
rutas.get('/mia', autenticar, permitirRoles('cooperativa', 'oficinista', 'personal_bus'), controlador.obtenerMia)
rutas.put('/mia', autenticar, permitirRoles('cooperativa'), controlador.actualizarMia)
rutas.post('/mia/logo', autenticar, permitirRoles('cooperativa'), subirLogoCooperativa, controlador.subirLogo)
rutas.delete('/mia/logo', autenticar, permitirRoles('cooperativa'), controlador.quitarLogo)

// Pública: perfil de una cooperativa (logo, colores, eslogan, contacto)
rutas.get('/:id', controlador.obtenerPublica)

module.exports = rutas
