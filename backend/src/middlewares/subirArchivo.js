const fs = require('fs')
const path = require('path')
const multer = require('multer')

const CARPETA = path.join(__dirname, '..', '..', 'uploads', 'comprobantes')
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf']

// Guarda el archivo con un nombre único: compra-<id>-<fecha>.<extensión>
const almacenamiento = multer.diskStorage({
  destination: (req, archivo, cb) => {
    fs.mkdirSync(CARPETA, { recursive: true })
    cb(null, CARPETA)
  },
  filename: (req, archivo, cb) => {
    const extension = path.extname(archivo.originalname).toLowerCase()
    cb(null, `compra-${req.params.id}-${Date.now()}${extension}`)
  },
})

const subir = multer({
  storage: almacenamiento,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, archivo, cb) => {
    if (TIPOS_PERMITIDOS.includes(archivo.mimetype)) return cb(null, true)
    const error = new Error('El comprobante debe ser una imagen JPG o PNG, o un PDF')
    error.status = 400
    cb(error)
  },
})

// Middleware para el campo "comprobante"; convierte los errores de multer en 400
function subirComprobante(req, res, next) {
  subir.single('comprobante')(req, res, (err) => {
    if (err) {
      err.status = 400
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'El comprobante no puede superar los 5 MB'
    }
    next(err)
  })
}

module.exports = { subirComprobante }
