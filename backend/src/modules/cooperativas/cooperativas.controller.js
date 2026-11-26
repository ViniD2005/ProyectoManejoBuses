const servicio = require('./cooperativas.service')

const listar = async (req, res) => {
  res.json(await servicio.listarCooperativas())
}

const obtenerPorId = async (req, res) => {
  const cooperativa = await servicio.obtenerCooperativaPorId(req.params.id)
  if (!cooperativa) return res.status(404).json({ mensaje: 'Cooperativa no encontrada' })
  res.json(cooperativa)
}

// CC-23: listado con responsables y búsqueda de candidatos (solo admin)
const listarGestion = async (req, res) => {
  res.json(await servicio.listarParaGestion())
}

const listarCandidatos = async (req, res) => {
  res.json(await servicio.listarCandidatos(req.query.texto))
}

// GC-11: paso 1 del registro (solo revisa, no guarda nada)
const validar = async (req, res) => {
  res.json(await servicio.validarDatosCooperativa(req.body))
}

const crear = async (req, res) => {
  res.status(201).json(await servicio.crearCooperativa(req.body))
}

const actualizar = async (req, res) => {
  const actualizada = await servicio.actualizarCooperativa(req.params.id, req.body)
  if (!actualizada) return res.status(404).json({ mensaje: 'Cooperativa no encontrada' })
  res.json(actualizada)
}

const cambiarEstado = async (req, res) => {
  const modificada = await servicio.cambiarEstadoCooperativa(req.params.id, req.body.activa)
  if (!modificada) return res.status(404).json({ mensaje: 'Cooperativa no encontrada' })
  res.json(modificada)
}

const asignarResponsable = async (req, res) => {
  res.json(await servicio.asignarResponsable(req.params.id, req.body.usuario_id))
}

module.exports = {
  listar,
  obtenerPorId,
  listarGestion,
  listarCandidatos,
  validar,
  crear,
  actualizar,
  cambiarEstado,
  asignarResponsable,
}
