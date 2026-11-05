const { Router } = require('express')
const controlador = require('./ciudades.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Lectura pública: el buscador de viajes necesita las ciudades sin iniciar sesión
rutas.get('/', controlador.listar)
rutas.get('/:id', controlador.obtener)

// Escritura solo para el administrador
rutas.post('/', autenticar, permitirRoles('admin'), controlador.crear)
rutas.put('/:id', autenticar, permitirRoles('admin'), controlador.actualizar)
rutas.delete('/:id', autenticar, permitirRoles('admin'), controlador.eliminar)

module.exports = rutas
