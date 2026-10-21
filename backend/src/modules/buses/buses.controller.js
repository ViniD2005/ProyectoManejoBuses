const busesService = require('./buses.service');

const getBuses = async (req, res) => {
  try {
    const buses = await busesService.listarBuses();
    res.json(buses);
  } catch (error) {
    console.error('Error al listar buses:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const createBus = async (req, res) => {
  try {
    const nuevoBus = await busesService.crearBus(req.body);
    res.status(201).json(nuevoBus);
  } catch (error) {
    console.error('Error al crear bus:', error);
    res.status(500).json({ error: 'Error al registrar el bus' });
  }
};

const updateBus = async (req, res) => {
  try {
    const { id } = req.params;
    const busActualizado = await busesService.actualizarBus(id, req.body);
    res.json(busActualizado);
  } catch (error) {
    console.error('Error al actualizar bus:', error);
    res.status(500).json({ error: 'Error al actualizar el bus' });
  }
};

const updateEstadoBus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activa } = req.body;
    const busModificado = await busesService.cambiarEstadoBus(id, activa);
    res.json(busModificado);
  } catch (error) {
    console.error('Error al cambiar estado del bus:', error);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

module.exports = {
  getBuses,
  createBus,
  updateBus,
  updateEstadoBus
};
