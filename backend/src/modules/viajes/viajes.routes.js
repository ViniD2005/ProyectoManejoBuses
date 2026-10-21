
const { Router } = require('express')
const controlador = require('./viajes.controller')

const rutas = Router()

rutas.get('/buscar', controlador.buscar)

rutas.get('/:id/asientos', controlador.asientos)

rutas.get('/:id', controlador.detalle)

module.exports = rutas
