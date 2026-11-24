const { Router } = require('express')
const controlador = require('./compras.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')
const { subirComprobante } = require('../../middlewares/subirArchivo')

const rutas = Router()

// Público: métodos de pago y tipos de descuento para el formulario de compra
rutas.get('/catalogos', controlador.catalogos)

// Solo clientes con sesión
rutas.post('/', autenticar, permitirRoles('cliente'), controlador.crear)
rutas.get('/mias', autenticar, permitirRoles('cliente'), controlador.listarMias)
// GC-15: datos de un pasajero registrado (?cedula=) para precargarlos
rutas.get('/pasajero', autenticar, permitirRoles('cliente', 'oficinista'), controlador.buscarPasajero)

// Subir comprobante de pago (campo "comprobante" del formulario)
rutas.post('/:id/comprobante', autenticar, permitirRoles('cliente'), subirComprobante, controlador.subirComprobante)

// CC-14: venta en ventanilla, pago en efectivo (solo oficinista)
rutas.post('/ventanilla', autenticar, permitirRoles('oficinista'), controlador.venderEnVentanilla)

module.exports = rutas
