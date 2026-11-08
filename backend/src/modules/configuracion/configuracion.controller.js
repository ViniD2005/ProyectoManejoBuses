const servicio = require('./configuracion.service')

const obtener = async (req, res) => {
  res.json(await servicio.obtener())
}

const actualizar = async (req, res) => {
  res.json(await servicio.actualizar(req.body))
}

module.exports = { obtener, actualizar }
