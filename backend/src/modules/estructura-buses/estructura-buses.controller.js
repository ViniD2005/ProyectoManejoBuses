const servicio = require('./estructura-buses.service')

// GC-18: estructura de asientos de los buses de la cooperativa
const listar = async (req, res) => res.json(await servicio.listar(req.usuario.cooperativa_id))
const obtener = async (req, res) => res.json(await servicio.obtener(req.usuario.cooperativa_id, req.params.id))
const guardar = async (req, res) => res.json(await servicio.guardar(req.usuario.cooperativa_id, req.params.id, req.body))

module.exports = { listar, obtener, guardar }
