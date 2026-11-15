-- =====================================================================
-- 006 - RUC VÁLIDOS EN LOS DATOS DE PRUEBA (CC-23)
-- Desde CC-23 el sistema valida el RUC con el algoritmo oficial del SRI.
-- Los RUC de prueba anteriores no cumplían el dígito verificador, por eso
-- se reemplazan por RUC válidos de sociedades privadas (tercer dígito 9).
-- Ejecutar DESPUÉS de 002_datos_prueba.sql. Se puede ejecutar más de una vez.
-- =====================================================================

UPDATE cooperativa SET ruc = '1890000009001' WHERE ruc = '1890000001001';
UPDATE cooperativa SET ruc = '1790000001001' WHERE ruc = '1790000002001';

-- Desde CC-23 la dirección es obligatoria: se completa en las cooperativas de prueba
UPDATE cooperativa SET direccion = 'Av. Cevallos y Montalvo, Ambato' WHERE id = 1 AND direccion IS NULL;
UPDATE cooperativa SET direccion = 'Terminal Terrestre de Quitumbe, Quito' WHERE id = 2 AND direccion IS NULL;
