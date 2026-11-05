const servicio = require('./tipos-asiento.service')

const listar = async (req, res) => {
  res.json(await servicio.listar(req.usuario.cooperativa_id))
}

const crear = async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario.cooperativa_id, req.body))
}

const actualizar = async (req, res) => {
  res.json(await servicio.actualizar(req.usuario.cooperativa_id, req.params.id, req.body))
}

const eliminar = async (req, res) => {
  await servicio.eliminar(req.usuario.cooperativa_id, req.params.id)
  res.status(204).end()
}

module.exports = { listar, crear, actualizar, eliminar }
