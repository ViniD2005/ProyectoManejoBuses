const { Router } = require('express')
const controlador = require('./cooperativas.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()
const soloAdmin = [autenticar, permitirRoles('admin')]

// Públicas: listado y detalle básico (búsqueda de viajes, formularios)
rutas.get('/', controlador.listar)

// CC-23: gestión del administrador (van antes de /:id)
rutas.get('/gestion', ...soloAdmin, controlador.listarGestion)
rutas.get('/candidatos', ...soloAdmin, controlador.listarCandidatos)   // ?texto=
// GC-11: paso 1 del registro en dos pantallas (solo revisa los datos)
rutas.post('/validar', ...soloAdmin, controlador.validar)

rutas.get('/:id', controlador.obtenerPorId)
rutas.post('/', ...soloAdmin, controlador.crear)
rutas.put('/:id', ...soloAdmin, controlador.actualizar)
rutas.patch('/:id/estado', ...soloAdmin, controlador.cambiarEstado)
rutas.post('/:id/responsables', ...soloAdmin, controlador.asignarResponsable)  // { usuario_id }

module.exports = rutas
