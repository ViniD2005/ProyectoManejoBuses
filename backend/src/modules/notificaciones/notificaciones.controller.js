const servicio = require('./notificaciones.service')

const listar = async (req, res) => {
  res.json(await servicio.listar(req.usuario.id))
}

const marcarLeida = async (req, res) => {
  await servicio.marcarLeida(req.usuario.id, req.params.id)
  res.status(204).end()
}

const marcarTodasLeidas = async (req, res) => {
  await servicio.marcarTodasLeidas(req.usuario.id)
  res.status(204).end()
}

module.exports = { listar, marcarLeida, marcarTodasLeidas }
