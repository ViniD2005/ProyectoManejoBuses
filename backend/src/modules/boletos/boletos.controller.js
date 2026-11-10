const servicio = require('./boletos.service')

// Devuelve el boleto en PDF (se abre o descarga en el navegador)
const descargarPdf = async (req, res) => {
  const boleto = await servicio.obtenerParaImprimir(req.usuario, req.params.codigo)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="boleto-${boleto.codigo.slice(0, 8)}.pdf"`)
  await servicio.generarPdf(boleto, res)
}

module.exports = { descargarPdf }
