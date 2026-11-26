-- GC-33 - Validaciones del personal de las cooperativas
-- Personal del bus: cargo (chofer o ayudante). El chofer registra su licencia
-- profesional (tipo D o E) y la fecha en que vence.
-- Se puede ejecutar varias veces sin error.

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS cargo VARCHAR(10);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS licencia_tipo CHAR(1);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS licencia_vence DATE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuario_cargo_valido') THEN
    ALTER TABLE usuario ADD CONSTRAINT usuario_cargo_valido CHECK (cargo IS NULL OR cargo IN ('chofer', 'ayudante'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usuario_licencia_valida') THEN
    ALTER TABLE usuario ADD CONSTRAINT usuario_licencia_valida CHECK (licencia_tipo IS NULL OR licencia_tipo IN ('D', 'E'));
  END IF;
END $$;

-- El personal del bus que ya existe queda como chofer, con una licencia de prueba vigente
UPDATE usuario u SET cargo = 'chofer', licencia_tipo = 'D', licencia_vence = CURRENT_DATE + INTERVAL '2 years'
  FROM rol r
 WHERE r.id = u.rol_id AND r.nombre = 'personal_bus' AND u.cargo IS NULL;
