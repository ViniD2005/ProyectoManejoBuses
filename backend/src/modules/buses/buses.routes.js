const express = require('express');
const router = express.Router();
const busesController = require('./buses.controller');
// const { verificarToken, verificarRolAdmin } = require('../../middlewares/authMiddleware'); // Ajusta según tus middlewares

router.get('/', busesController.getBuses);
router.post('/', busesController.createBus);
router.put('/:id', busesController.updateBus);
router.patch('/:id/estado', busesController.updateEstadoBus);

module.exports = router;