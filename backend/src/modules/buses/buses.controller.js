const busesService = require('./buses.service');

exports.obtenerBuses = async (req, res) => {
    try {
        const cooperativaId = req.usuario.cooperativa_id;
        const buses = await busesService.obtenerBusesPorCooperativa(cooperativaId);
        res.json(buses);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener los buses', detalle: error.message });
    }
};

exports.crearBus = async (req, res) => {
    try {
        const cooperativaId = req.usuario.cooperativa_id;
        const datosBus = { ...req.body, cooperativa_id };
        const nuevoBus = await busesService.crearBus(datosBus);
        res.status(201).json(nuevoBus);
    } catch (error) {
        if (error.code === '23505' || error.message.includes('duplicada')) {
            return res.status(409).json({ error: 'Ya existe un registro con esos datos (placa o disco duplicado)' });
        }
        res.status(400).json({ error: error.message });
    }
};

exports.actualizarBus = async (req, res) => {
    try {
        const { id } = req.params;
        const cooperativaId = req.usuario.cooperativa_id;
        const busActualizado = await busesService.actualizarBus(id, cooperativaId, req.body);
        res.json(busActualizado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.cambiarEstadoBus = async (req, res) => {
    try {
        const { id } = req.params;
        const cooperativaId = req.usuario.cooperativa_id;
        const { activo } = req.body;
        const bus = await busesService.cambiarEstado(id, cooperativaId, activo);
        res.json(bus);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};