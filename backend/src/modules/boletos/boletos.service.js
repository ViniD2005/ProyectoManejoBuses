const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')
const { pool } = require('../../config/db')

function errorHttp(mensaje, status) {
  const error = new Error(mensaje)
  error.status = status
  return error
}

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Suma minutos a una hora 'HH:MM' (hora de abordaje en la parada de subida)
function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number)
  const total = (h * 60 + m + Number(minutos)) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/*
  Datos de un boleto para imprimirlo.
  Solo boletos emitidos (pago aprobado) o usados.
  Puede verlo el cliente dueño de la compra o un oficinista de la cooperativa del viaje.
*/
async function obtenerParaImprimir(usuario, codigo) {
  if (!FORMATO_UUID.test(codigo || '')) throw errorHttp('Código de boleto no válido', 400)

  const { rows } = await pool.query(
    `SELECT b.codigo, b.estado, b.pasajero_nombre, b.pasajero_cedula,
            b.precio_base, b.descuento, b.precio_final, td.nombre AS tipo_descuento,
            c.id AS compra_id, c.cliente_id,
            v.fecha::text AS fecha, f.hora_salida::text AS hora_salida, f.cooperativa_id,
            coop.nombre AS cooperativa, bus.numero_disco, bus.placa,
            a.numero AS numero_asiento, ta.nombre AS tipo_asiento,
            cs.nombre AS origen, cb.nombre AS destino, ps.minutos_desde_salida AS minutos_subida
       FROM boleto b
       JOIN compra c ON c.id = b.compra_id
       JOIN viaje v ON v.id = b.viaje_id
       JOIN frecuencia f ON f.id = v.frecuencia_id
       JOIN cooperativa coop ON coop.id = f.cooperativa_id
       JOIN bus ON bus.id = v.bus_id
       JOIN asiento a ON a.id = b.asiento_id
       JOIN tipo_asiento ta ON ta.id = a.tipo_asiento_id
       LEFT JOIN tipo_descuento td ON td.id = b.tipo_descuento_id
       JOIN parada ps ON ps.frecuencia_id = f.id AND ps.orden = b.orden_subida
       JOIN parada pb ON pb.frecuencia_id = f.id AND pb.orden = b.orden_bajada
       JOIN ciudad cs ON cs.id = ps.ciudad_id
       JOIN ciudad cb ON cb.id = pb.ciudad_id
      WHERE b.codigo = $1`,
    [codigo]
  )
  const boleto = rows[0]
  if (!boleto) throw errorHttp('Boleto no encontrado', 404)

  const esDueno = usuario.rol === 'cliente' && boleto.cliente_id === usuario.id
  const esOficinista = usuario.rol === 'oficinista' && boleto.cooperativa_id === usuario.cooperativa_id
  if (!esDueno && !esOficinista) throw errorHttp('No tienes acceso a este boleto', 403)

  if (!['emitido', 'usado'].includes(boleto.estado)) {
    throw errorHttp('El boleto estará disponible cuando el oficinista apruebe el pago', 409)
  }
  return boleto
}

// Genera el PDF del boleto con su código QR y lo escribe en la respuesta
async function generarPdf(boleto, salida) {
  const qr = await QRCode.toBuffer(boleto.codigo, { width: 220, margin: 1 })
  const doc = new PDFDocument({ size: 'A5', margin: 36 })
  doc.pipe(salida)

  doc.fontSize(18).font('Helvetica-Bold').text('Pasajes Ecuador', { align: 'center' })
  doc.fontSize(11).font('Helvetica').text('Boleto de viaje interprovincial', { align: 'center' })
  doc.moveDown()

  doc.fontSize(14).font('Helvetica-Bold').text(`${boleto.origen}  ->  ${boleto.destino}`)
  doc.fontSize(11).font('Helvetica')
  doc.text(`Fecha: ${boleto.fecha}`)
  doc.text(`Hora de abordaje en ${boleto.origen}: ${sumarMinutos(boleto.hora_salida, boleto.minutos_subida)}`)
  doc.text(`Cooperativa: ${boleto.cooperativa}`)
  doc.text(`Bus: ${boleto.numero_disco} (placa ${boleto.placa})`)
  doc.text(`Asiento: ${boleto.numero_asiento} (${boleto.tipo_asiento})`)
  doc.moveDown(0.5)
  doc.text(`Pasajero: ${boleto.pasajero_nombre}`)
  doc.text(`Cédula: ${boleto.pasajero_cedula}`)
  doc.text(`Precio: $${Number(boleto.precio_final).toFixed(2)}` +
    (Number(boleto.descuento) > 0 ? `  (incluye descuento ${boleto.tipo_descuento}: -$${Number(boleto.descuento).toFixed(2)})` : ''))
  doc.text(`Compra N.º ${boleto.compra_id}`)

  doc.moveDown()
  doc.image(qr, { fit: [160, 160], align: 'center' })
  doc.moveDown(0.5)
  doc.fontSize(8).text(`Código: ${boleto.codigo}`, { align: 'center' })
  doc.text('Presente este código QR al personal del bus al momento de abordar.', { align: 'center' })

  doc.end()
}

module.exports = { obtenerParaImprimir, generarPdf }
