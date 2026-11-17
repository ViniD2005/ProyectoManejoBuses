const servicio = require('./panel.service')

// GC-9: resumen del día de la cooperativa del usuario
const resumen = async (req, res) => {
  res.json(await servicio.resumen(req.usuario.cooperativa_id))
}

module.exports = { resumen }
