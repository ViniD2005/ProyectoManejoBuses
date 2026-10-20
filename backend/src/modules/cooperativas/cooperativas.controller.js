const servicio = require('./cooperativas.service');

const listar = async (req, res) => {
  const cooperativas = await servicio.listarCooperativas();
  res.json(cooperativas);
};

const obtenerPorId = async (req, res) => {
  const { id } = req.params;
  const cooperativa = await servicio.obtenerCooperativaPorId(id);
  if (!cooperativa) {
    return res.status(404).json({ mensaje: 'Cooperativa no encontrada' });
  }
  res.json(cooperativa);
};

const crear = async (req, res) => {
  const nueva = await servicio.crearCooperativa(req.body);
  res.status(201).json(nueva);
};

const actualizar = async (req, res) => {
  const { id } = req.params;
  const actualizada = await servicio.actualizarCooperativa(id, req.body);
  if (!actualizada) {
    return res.status(404).json({ mensaje: 'Cooperativa no encontrada para actualizar' });
  }
  res.json(actualizada);
};

const cambiarEstado = async (req, res) => {
  const { id } = req.params;
  const { activa } = req.body;
  const modificada = await servicio.cambiarEstadoCooperativa(id, activa);
  if (!modificada) {
    return res.status(404).json({ mensaje: 'Cooperativa no encontrada' });
  }
  res.json(modificada);
};

module.exports = {
  listar,
  obtenerPorId,
  crear,
  actualizar,
  cambiarEstado,
};