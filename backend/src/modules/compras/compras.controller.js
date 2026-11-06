const servicio = require('./compras.service')

const catalogos = async (req, res) => {
  res.json(await servicio.obtenerCatalogos())
}

const crear = async (req, res) => {
  res.status(201).json(await servicio.crear(req.usuario.id, req.body))
}

const listarMias = async (req, res) => {
  res.json(await servicio.listarMias(req.usuario.id))
}

const subirComprobante = async (req, res) => {
  res.json(await servicio.subirComprobante(req.usuario.id, req.params.id, req.file, req.body.referencia))
}

module.exports = { catalogos, crear, listarMias, subirComprobante }
