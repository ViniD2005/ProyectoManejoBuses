const comprasService = require('./compras.service')

async function crearCompra(req, res, next) {
  try {
    const usuarioId = req.usuario.id // Obtenido del token JWT
    const { frecuenciaId, asientos, metodoPago } = req.body

    if (!frecuenciaId || !asientos || !Array.isArray(asientos) || asientos.length === 0) {
      return res.status(400).json({ mensaje: 'Datos de compra incompletos o invalidos' })
    }

    const compra = await comprasService.crearCompra({
      usuarioId,
      frecuenciaId,
      asientos,
      metodoPago: metodoPago || 'tarjeta'
    })

    return res.status(201).json({
      mensaje: 'Compra realizada exitosamente',
      compra
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  crearCompra
}