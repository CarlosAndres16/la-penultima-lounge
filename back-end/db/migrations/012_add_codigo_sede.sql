-- 012_add_codigo_sede.sql
ALTER TABLE sedes ADD COLUMN IF NOT EXISTS codigo_sede VARCHAR(20) UNIQUE;
UPDATE sedes SET codigo_sede = 'SED-0' || id_sede WHERE codigo_sede IS NULL;

