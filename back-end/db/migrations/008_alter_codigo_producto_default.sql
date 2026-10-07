-- =====================================================
-- Alter codigo_producto column to auto-generate code
-- =====================================================

-- Ensure default casts sequence to text
ALTER TABLE productos ALTER COLUMN codigo_producto SET DEFAULT ('PRD-' || nextval('productos_id_producto_seq')::text);

-- Ensure existing rows have a code (if any null)
UPDATE productos SET codigo_producto = ('PRD-' || id_producto) WHERE codigo_producto IS NULL;
