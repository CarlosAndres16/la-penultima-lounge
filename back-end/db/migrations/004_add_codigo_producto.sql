-- =====================================================
-- Add codigo_producto column to productos table
-- =====================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_producto VARCHAR(20) NOT NULL UNIQUE;

-- Populate only rows that do not have a code yet (keeps the codes from the test data)
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT id_producto FROM productos WHERE codigo_producto IS NULL LOOP
    UPDATE productos SET codigo_producto = CONCAT('PRD-', rec.id_producto) WHERE id_producto = rec.id_producto;
  END LOOP;
END $$;