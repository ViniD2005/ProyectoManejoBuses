const fs = require('fs')
const path = require('path')
const multer = require('multer')

const CARPETA = path.join(__dirname, '..', '..', 'uploads', 'cooperativas')
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

// Guarda el logo con un nombre único: coop-<id>-<fecha>.<extensión>
const almacenamiento = multer.diskStorage({
  destination: (req, archivo, cb) => {
    fs.mkdirSync(CARPETA, { recursive: true })
    cb(null, CARPETA)
  },
  filename: (req, archivo, cb) => {
    const extension = path.extname(archivo.originalname).toLowerCase()
    cb(null, `coop-${req.usuario.cooperativa_id}-${Date.now()}${extension}`)
  },
})

const subir = multer({
  storage: almacenamiento,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, archivo, cb) => {
    if (TIPOS_PERMITIDOS.includes(archivo.mimetype)) return cb(null, true)
    const error = new Error('El logo debe ser una imagen JPG, PNG, WEBP o SVG')
    error.status = 400
    cb(error)
  },
})

// Middleware para el campo "logo" (CC-24); convierte los errores de multer en 400
function subirLogoCooperativa(req, res, next) {
  subir.single('logo')(req, res, (err) => {
    if (err) {
      err.status = 400
      if (err.code === 'LIMIT_FILE_SIZE') err.message = 'El logo no puede superar los 2 MB'
    }
    next(err)
  })
}

module.exports = { subirLogoCooperativa }
