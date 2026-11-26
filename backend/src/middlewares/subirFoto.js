const fs = require('fs')
const path = require('path')
const multer = require('multer')

const CARPETA = path.join(__dirname, '..', '..', 'uploads', 'buses')
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']

// Guarda la foto con un nombre único: bus-<id>-<fecha>.<extensión>
const almacenamiento = multer.diskStorage({
  destination: (req, archivo, cb) => {
    fs.mkdirSync(CARPETA, { recursive: true })
    cb(null, CARPETA)
  },
  filename: (req, archivo, cb) => {
    const extension = path.extname(archivo.originalname).toLowerCase()
    cb(null, `bus-${req.params.id}-${Date.now()}${extension}`)
  },
})

const subir = multer({
  storage: almacenamiento,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (req, archivo, cb) => {
    if (TIPOS_PERMITIDOS.includes(archivo.mimetype)) return cb(null, true)
    const error = new Error('La foto debe ser una imagen JPG, PNG o WEBP')
    error.status = 400
    cb(error)
  },
})

// Middleware para el campo "foto"; convierte los errores de multer en 400 (CC-17)
function subirFotoBus(req, res, next) {
  subir.single('foto')(req, res, (err) => {
    if (err) {
      err.status = 400
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'La foto no puede superar los 3 MB'
    }
    next(err)
  })
}

module.exports = { subirFotoBus }
