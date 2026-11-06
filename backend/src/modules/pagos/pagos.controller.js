const servicio = require('./pagos.service')

const listar = async (req, res) => {
  res.json(await servicio.listar(req.usuario.cooperativa_id, req.query.estado))
}

const validar = async (req, res) => {
  res.json(await servicio.validar(req.usuario, req.params.id, req.body))
}

module.exports = { listar, validar }
