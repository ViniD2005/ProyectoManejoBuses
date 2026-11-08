
const servicio = require('./hojas-ruta.service')

const obtener = async (req, res) => {
  res.json(await servicio.obtener(req.usuario.cooperativa_id, req.query.fecha))
}

const guardar = async (req, res) => {
  res.json(await servicio.guardar(req.usuario, req.body))
}

module.exports = { obtener, guardar }
