const servicio = require('./buses.service')

const listar = async (req, res) => {
  res.json(await servicio.listar(req.usuario.cooperativa_id))
}

const crear = async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario.cooperativa_id, req.body))
}

const actualizar = async (req, res) => {
  res.json(await servicio.actualizar(req.usuario.cooperativa_id, req.params.id, req.body))
}

const cambiarEstado = async (req, res) => {
  res.json(await servicio.cambiarEstado(req.usuario.cooperativa_id, req.params.id, req.body.activo))
}

// CC-17: subir la foto del bus
const actualizarFoto = async (req, res) => {
  res.json(await servicio.actualizarFoto(req.usuario.cooperativa_id, req.params.id, req.file))
}

module.exports = { listar, crear, actualizar, cambiarEstado, actualizarFoto }
