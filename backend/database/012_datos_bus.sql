-- =====================================================================
-- GC-20 - Ficha completa del bus
--
-- El bus tenía solo disco, placa y marcas. Una cooperativa real también
-- registra: número de chasis (VIN), número de motor, servicios a bordo
-- (los ve el cliente al comprar), fecha en que vence la matrícula y
-- observaciones. Todo es opcional para no romper los buses que ya existen.
--
-- Se puede ejecutar varias veces sin dañar nada.
-- =====================================================================

ALTER TABLE bus ADD COLUMN IF NOT EXISTS numero_chasis   VARCHAR(17);
ALTER TABLE bus ADD COLUMN IF NOT EXISTS numero_motor    VARCHAR(30);
ALTER TABLE bus ADD COLUMN IF NOT EXISTS servicios       TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE bus ADD COLUMN IF NOT EXISTS vence_matricula DATE;
ALTER TABLE bus ADD COLUMN IF NOT EXISTS observaciones   VARCHAR(300);

-- El número de chasis identifica al vehículo: no se puede repetir
CREATE UNIQUE INDEX IF NOT EXISTS bus_numero_chasis_unico ON bus (UPPER(numero_chasis)) WHERE numero_chasis IS NOT NULL;

-- Servicios de los buses de prueba
UPDATE bus SET servicios = ARRAY['wifi', 'bano', 'aire', 'usb', 'reclinables']
 WHERE placa IN ('TBC-5678') AND servicios = '{}';
UPDATE bus SET servicios = ARRAY['bano', 'tv', 'reclinables']
 WHERE placa IN ('TBA-1234', 'TBD-9012') AND servicios = '{}';
