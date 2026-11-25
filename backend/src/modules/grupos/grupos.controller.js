const servicio = require('./grupos.service')

const coop = (req) => req.usuario.cooperativa_id

const listar = async (req, res) => res.json(await servicio.listar(coop(req)))
const recursos = async (req, res) => res.json(await servicio.recursos(coop(req)))
const crear = async (req, res) => res.status(201).json(await servicio.crear(coop(req), req.body))
const actualizar = async (req, res) => res.json(await servicio.actualizar(coop(req), req.params.id, req.body))
const cambiarEstado = async (req, res) => res.json(await servicio.cambiarEstado(coop(req), req.params.id, req.body.activo))
const eliminar = async (req, res) => res.json(await servicio.eliminar(coop(req), req.params.id))
const asignarBuses = async (req, res) => res.json(await servicio.asignarBuses(coop(req), req.params.id, req.body.buses))
const asignarFrecuencias = async (req, res) => res.json(await servicio.asignarFrecuencias(coop(req), req.params.id, req.body.frecuencias))

module.exports = { listar, recursos, crear, actualizar, cambiarEstado, eliminar, asignarBuses, asignarFrecuencias }
