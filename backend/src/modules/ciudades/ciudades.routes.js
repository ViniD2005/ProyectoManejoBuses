const { Router } = require('express')
const controlador = require('./ciudades.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()
const soloAdmin = [autenticar, permitirRoles('admin')]

// Lectura pública: el buscador de viajes necesita los cantones sin iniciar sesión
rutas.get('/', controlador.listar)                       // ?texto=&provincia_id=
// GC-13: lista completa para administrar (antes de /:id)
rutas.get('/gestion', ...soloAdmin, controlador.listarGestion)
rutas.get('/:id', controlador.obtener)

// Escritura solo para el administrador
rutas.post('/', ...soloAdmin, controlador.crear)
rutas.put('/:id', ...soloAdmin, controlador.actualizar)
rutas.patch('/:id/estado', ...soloAdmin, controlador.cambiarEstado)
rutas.delete('/:id', ...soloAdmin, controlador.eliminar)

module.exports = rutas
