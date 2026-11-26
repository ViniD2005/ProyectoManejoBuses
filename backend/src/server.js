require('dotenv').config({ quiet: true })
const app = require('./app')
const { iniciarVencimientoDeReservas } = require('./utils/vencerReservas')

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}/api`)
  // GC-37: libera cada minuto los asientos de las reservas que no se pagaron a tiempo
  iniciarVencimientoDeReservas()
})