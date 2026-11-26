const servicio = require('./cuentas-bancarias.service')

// GC-43: cuenta bancaria de cada cooperativa
const bancos = (req, res) => res.json({ bancos: servicio.BANCOS, tipos: servicio.TIPOS })
const mia = async (req, res) => res.json(await servicio.obtener(req.usuario.cooperativa_id))
const guardarMia = async (req, res) => res.json(await servicio.guardar(req.usuario.cooperativa_id, req.body, req.usuario))
const listar = async (req, res) => res.json(await servicio.listar())
const deCooperativa = async (req, res) => res.json(await servicio.obtener(Number(req.params.id)))
const guardarDeCooperativa = async (req, res) => res.json(await servicio.guardar(Number(req.params.id), req.body, req.usuario))

module.exports = { bancos, mia, guardarMia, listar, deCooperativa, guardarDeCooperativa }
