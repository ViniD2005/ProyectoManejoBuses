const servicio = require('./accesos.service')

const viajesDeHoy = async (req, res) => {
  res.json(await servicio.viajesDeHoy(req.usuario.cooperativa_id))
}

const registrarAbordaje = async (req, res) => {
  res.status(201).json(await servicio.registrarAbordaje(req.usuario, req.body))
}

module.exports = { viajesDeHoy, registrarAbordaje }
