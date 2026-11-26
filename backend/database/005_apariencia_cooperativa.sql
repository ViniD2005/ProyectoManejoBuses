-- =====================================================================
-- 005 - APARIENCIA DE CADA COOPERATIVA (CC-24)
-- Cada cooperativa personaliza cómo la ven sus clientes y su personal:
-- colores, eslogan, descripción, redes sociales y WhatsApp (el logo ya existe).
-- Ejecutar DESPUÉS de 002_datos_prueba.sql. Se puede ejecutar más de una vez.
-- =====================================================================

ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS color_primario VARCHAR(7) NOT NULL DEFAULT '#1f4e5f';
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS color_acento   VARCHAR(7) NOT NULL DEFAULT '#e8a317';
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS eslogan        VARCHAR(120);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS descripcion    VARCHAR(500);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS facebook_url   VARCHAR(300);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS instagram_url  VARCHAR(300);
ALTER TABLE cooperativa ADD COLUMN IF NOT EXISTS whatsapp       VARCHAR(10);

-- Apariencia de prueba para que se note la diferencia entre cooperativas
UPDATE cooperativa
   SET color_primario = '#0f5b46', color_acento = '#f2b134',
       eslogan = 'Viaja seguro por la Sierra y el Austro'
 WHERE id = 1 AND eslogan IS NULL;

UPDATE cooperativa
   SET color_primario = '#7a1f2b', color_acento = '#f0a43a',
       eslogan = 'Conectamos los valles del Ecuador'
 WHERE id = 2 AND eslogan IS NULL;
