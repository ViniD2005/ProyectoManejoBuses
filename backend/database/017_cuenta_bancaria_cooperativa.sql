-- GC-43 - Cuenta bancaria de cada cooperativa
-- El cliente paga por transferencia o depósito directamente a la cooperativa que
-- opera el viaje (no a la aplicación). La cuenta la registra la propia cooperativa
-- o el administrador. Sin cuenta registrada, la cooperativa no recibe pagos por
-- transferencia en línea (sí vende en ventanilla y a bordo).
-- Se puede ejecutar varias veces sin error.

ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS cuenta_banco          VARCHAR(60);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS cuenta_tipo           VARCHAR(10);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS cuenta_numero         VARCHAR(20);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS cuenta_titular        VARCHAR(100);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS cuenta_identificacion VARCHAR(13);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS cuenta_actualizada_en TIMESTAMP;
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS cuenta_actualizada_por INT REFERENCES usuario(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cooperativa_cuenta_tipo_valido') THEN
    ALTER TABLE cooperativa ADD CONSTRAINT cooperativa_cuenta_tipo_valido CHECK (cuenta_tipo IS NULL OR cuenta_tipo IN ('ahorros', 'corriente'));
  END IF;
END $$;

-- Datos de PRUEBA: las cooperativas que ya existen reciben una cuenta ficticia
-- a nombre de la cooperativa (cada una debe reemplazarla por la real).
UPDATE cooperativa
   SET cuenta_banco = 'Banco Pichincha', cuenta_tipo = 'corriente',
       cuenta_numero = LPAD((2200000000 + id)::text, 10, '0'),
       cuenta_titular = nombre, cuenta_identificacion = ruc,
       cuenta_actualizada_en = NOW()
 WHERE cuenta_numero IS NULL;
