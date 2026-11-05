# Módulo de Compras y Pasajes

Este módulo gestiona la reserva, compra, consulta y cancelación de pasajes de autobús.

## Endpoints Disponibles

- `POST /api/compras`: Registra una nueva compra de pasajes en transacción SQL.
- `GET /api/compras/mis-compras`: Obtiene el historial de compras del usuario autenticado.
- `GET /api/compras/:id`: Obtiene los detalles y boletos asociados a una compra.
- `DELETE /api/compras/:id`: Cancela una compra y libera los asientos reservados.