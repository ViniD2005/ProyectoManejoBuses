-- GC-41 - Toda cooperativa necesita al menos un tipo de asiento para registrar buses.
-- Las cooperativas nuevas reciben «Normal» (factor 1.00) al crearse; este script
-- se lo agrega a las que ya existen y no tienen ninguno.
-- Se puede ejecutar varias veces sin error.

INSERT INTO tipo_asiento (cooperativa_id, nombre, factor_precio)
SELECT c.id, 'Normal', 1.00
  FROM cooperativa c
 WHERE NOT EXISTS (SELECT 1 FROM tipo_asiento t WHERE t.cooperativa_id = c.id);
