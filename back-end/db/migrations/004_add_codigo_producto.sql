-- =====================================================
-- Add codigo_producto column to productos table
-- =====================================================

ALTER TABLE productos ADD COLUMN codigo_producto VARCHAR(20) NOT NULL UNIQUE;

-- Populate existing rows with generated codes
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT id_producto FROM productos LOOP
    UPDATE productos SET codigo_producto = CONCAT('PRD-', rec.id_producto) WHERE id_producto = rec.id_producto;
  END LOOP;
END $$;
