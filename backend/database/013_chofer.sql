-- =====================================================================
-- GC-34 - Sección del chofer: inicio y fin del viaje, venta a bordo
--
-- * viaje.chofer_id / iniciado_en / finalizado_en: quién manejó el viaje y
--   cuándo empezó y terminó (para el historial del chofer).
-- * compra.a_bordo: la venta la hizo el chofer dentro del bus (efectivo).
--
-- Se puede ejecutar varias veces sin dañar nada.
-- =====================================================================

ALTER TABLE viaje ADD COLUMN IF NOT EXISTS chofer_id      INT REFERENCES usuario(id);
ALTER TABLE viaje ADD COLUMN IF NOT EXISTS iniciado_en    TIMESTAMP;
ALTER TABLE viaje ADD COLUMN IF NOT EXISTS finalizado_en  TIMESTAMP;
ALTER TABLE viaje ADD COLUMN IF NOT EXISTS observaciones  VARCHAR(300);

ALTER TABLE compra ADD COLUMN IF NOT EXISTS a_bordo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_viaje_chofer ON viaje (chofer_id, fecha DESC);

-- Un chofer no puede tener dos viajes en curso al mismo tiempo
CREATE UNIQUE INDEX IF NOT EXISTS viaje_un_curso_por_chofer ON viaje (chofer_id) WHERE estado = 'en_curso';
