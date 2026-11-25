const { Router } = require('express')
const controlador = require('./hojas-ruta.controller')
const { autenticar, permitirRoles } = require('../../middlewares/auth')

const rutas = Router()

// Solo el usuario de cooperativa gestiona la hoja de ruta de SU cooperativa
rutas.use(autenticar, permitirRoles('cooperativa'))

// GC-19: hoja de ruta por grupo
rutas.get('/', controlador.obtener)            // ?grupo_id=&desde=AAAA-MM-DD&dias=7  (lo guardado)
rutas.post('/generar', controlador.generar)    // { grupo_id, desde, dias }  → propuesta, no guarda
rutas.put('/', controlador.guardar)            // { grupo_id, desde, dias, generacion, filas }

module.exports = rutas
