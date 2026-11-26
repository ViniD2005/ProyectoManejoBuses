const { Router } = require('express')
const controlador = require('./cuentas-bancarias.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

// GC-43: cuenta bancaria de cada cooperativa
const rutas = Router()
rutas.use(autenticar)

rutas.get('/bancos', permitirRoles('admin', 'cooperativa'), controlador.bancos)

// La cooperativa gestiona la suya
rutas.get('/mia', permitirRoles('cooperativa'), controlador.mia)
rutas.put('/mia', permitirRoles('cooperativa'), controlador.guardarMia)           // { banco, tipo, numero, titular, identificacion }

// El administrador gestiona la de cualquier cooperativa
rutas.get('/', permitirRoles('admin'), controlador.listar)
rutas.get('/:id', permitirRoles('admin'), controlador.deCooperativa)
rutas.put('/:id', permitirRoles('admin'), controlador.guardarDeCooperativa)

module.exports = rutas
