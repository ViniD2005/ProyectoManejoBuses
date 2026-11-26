const servicio = require('./cuenta.service')

// GC-36: Mi cuenta
const obtener = async (req, res) => res.json(await servicio.obtener(req.usuario.id))
const actualizar = async (req, res) => res.json(await servicio.actualizar(req.usuario.id, req.body))
const cambiarContrasena = async (req, res) => res.json(await servicio.cambiarContrasena(req.usuario.id, req.body))

module.exports = { obtener, actualizar, cambiarContrasena }
