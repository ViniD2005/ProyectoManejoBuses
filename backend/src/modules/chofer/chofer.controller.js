const servicio = require('./chofer.service')

// GC-34: sección del chofer
const viajesDeHoy = async (req, res) => res.json(await servicio.viajesDeHoy(req.usuario))
const detalle = async (req, res) => res.json(await servicio.detalle(req.usuario, req.params.id))
const iniciar = async (req, res) => res.json(await servicio.iniciar(req.usuario, req.params.id))
const finalizar = async (req, res) => res.json(await servicio.finalizar(req.usuario, req.params.id, req.body))
const validarBoleto = async (req, res) => res.json(await servicio.validarBoleto(req.usuario, req.params.id, req.body))
const venderABordo = async (req, res) => res.status(201).json(await servicio.venderABordo(req.usuario, req.params.id, req.body))
const historial = async (req, res) => res.json(await servicio.historial(req.usuario, req.query))

module.exports = { viajesDeHoy, detalle, iniciar, finalizar, validarBoleto, venderABordo, historial }
