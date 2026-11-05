const express = require('express');
const router = express.Router();
const controlador = require('./cooperativas.controller');
const { autenticar, permitirRoles } = require('../../middlewares/auth');

// GET /api/cooperativas
router.get('/', controlador.listar);

// GET /api/cooperativas/:id
router.get('/:id', controlador.obtenerPorId);

// POST /api/cooperativas
router.post('/', autenticar, permitirRoles('admin'), controlador.crear);

// PUT /api/cooperativas/:id
router.put('/:id', autenticar, permitirRoles('admin'), controlador.actualizar);

// PATCH /api/cooperativas/:id/estado
router.patch('/:id/estado', autenticar, permitirRoles('admin'), controlador.cambiarEstado);

module.exports = router;