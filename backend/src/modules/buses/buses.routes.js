const express = require('express');
const router = express.Router();
const busesController = require('./buses.controller');
const { verificarToken, verificarRol } = require('../../middlewares/authMiddleware');

// Todas las rutas exigen autenticación y rol de cooperativa
router.use(verificarToken, verificarRol(['cooperativa', 'admin']));

router.get('/', busesController.obtenerBuses);
router.post('/', busesController.crearBus);
router.put('/:id', busesController.actualizarBus);
router.patch('/:id/estado', busesController.cambiarEstadoBus);

module.exports = router;