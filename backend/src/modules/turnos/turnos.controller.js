const servicio = require('./turnos.service')

const listar = async (req, res) => res.json(await servicio.listar(req.usuario.cooperativa_id))
const crear = async (req, res) => res.status(201).json(await servicio.crear(req.usuario.cooperativa_id, req.body))
const actualizar = async (req, res) => res.json(await servicio.actualizar(req.usuario.cooperativa_id, req.params.id, req.body))
const eliminar = async (req, res) => res.json(await servicio.eliminar(req.usuario.cooperativa_id, req.params.id))
const generarSemana = async (req, res) => res.json(await servicio.generarSemana(req.usuario, req.body.desde))
const semana = async (req, res) => res.json(await servicio.semana(req.usuario.cooperativa_id, req.query.desde))

module.exports = { listar, crear, actualizar, eliminar, generarSemana, semana }
