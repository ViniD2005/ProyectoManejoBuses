const servicio = require('./hojas-ruta.service')

// GC-19: hoja de ruta por grupo y periodo
const obtener = async (req, res) => res.json(await servicio.obtener(req.usuario.cooperativa_id, req.query))
const generar = async (req, res) => res.json(await servicio.generar(req.usuario.cooperativa_id, req.body))
const guardar = async (req, res) => res.json(await servicio.guardar(req.usuario, req.body))

module.exports = { obtener, generar, guardar }
