const servicio = require('./destacadas.service')

// GC-35: rutas destacadas
const listarPlanes = async (req, res) => res.json(await servicio.listarPlanes())
const guardarPlan = async (req, res) => res.json(await servicio.guardarPlan(Number(req.params.id), req.body))
const miPlan = async (req, res) => res.json(await servicio.plan(req.usuario.cooperativa_id))
const marcar = async (req, res) => res.json(await servicio.marcar(req.usuario.cooperativa_id, Number(req.params.id), req.body))

module.exports = { listarPlanes, guardarPlan, miPlan, marcar }
