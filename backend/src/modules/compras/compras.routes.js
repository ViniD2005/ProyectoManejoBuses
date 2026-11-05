const { Router } = require('express')
const comprasController = require('./compras.controller')
const authMiddleware = require('../../middlewares/auth')

const router = Router()

router.use(authMiddleware)

router.post('/', comprasController.crearCompra)

router.get('/mis-compras', comprasController.obtenerMisCompras)

router.get('/:id', comprasController.obtenerDetalleCompra)

router.delete('/:id', comprasController.cancelarCompra)

module.exports = router