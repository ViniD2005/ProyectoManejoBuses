const servicio = require('./apariencia.service')

// Pública: perfil de una cooperativa para los clientes
const obtenerPublica = async (req, res) => res.json(await servicio.obtener(req.params.id))

// La cooperativa del usuario que inició sesión (cooperativa, oficinista o personal del bus)
const obtenerMia = async (req, res) => res.json(await servicio.obtener(req.usuario.cooperativa_id))
const actualizarMia = async (req, res) => res.json(await servicio.actualizar(req.usuario.cooperativa_id, req.body))
// GC-16: datos de contacto de la cooperativa (nombre, RUC, teléfono, correo, dirección)
const actualizarDatosMia = async (req, res) => res.json(await servicio.actualizarDatos(req.usuario.cooperativa_id, req.body))
const subirLogo = async (req, res) => res.json(await servicio.actualizarLogo(req.usuario.cooperativa_id, req.file))
const quitarLogo = async (req, res) => res.json(await servicio.quitarLogo(req.usuario.cooperativa_id))

module.exports = { obtenerPublica, obtenerMia, actualizarMia, actualizarDatosMia, subirLogo, quitarLogo }
