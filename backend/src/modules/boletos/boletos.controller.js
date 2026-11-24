const servicio = require('./boletos.service')

// Devuelve el boleto en PDF (se abre o descarga en el navegador)
const descargarPdf = async (req, res) => {
  const boleto = await servicio.obtenerParaImprimir(req.usuario, req.params.codigo)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="boleto-${boleto.codigo.slice(0, 8)}.pdf"`)
  await servicio.generarPdf(boleto, res)
}

// GC-15: todos los boletos de una compra en un solo PDF
const descargarPdfCompra = async (req, res) => {
  const boletos = await servicio.obtenerDeCompra(req.usuario, req.params.compraId)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="boletos-compra-${req.params.compraId}.pdf"`)
  await servicio.generarPdfCompra(boletos, res)
}

module.exports = { descargarPdf, descargarPdfCompra }
