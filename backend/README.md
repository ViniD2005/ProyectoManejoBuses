# Backend pendiente
Se propone una API REST, pero no se elige framework hasta confirmar la tecnología del equipo.
Endpoints sugeridos: `GET /viajes`, `GET /viajes/:id/asientos`, `POST /reservas`, `POST /pagos`, `POST /embarques/validar`, `GET /cooperativas/:id`.
**Nunca** confiar en precio, disponibilidad ni descuentos calculados por el navegador. Usar transacciones y restricciones de unicidad para evitar doble venta.
