-- =====================================================
-- Fill missing product codes for existing rows
-- =====================================================

-- Generate a code based on the product's primary key if it's null
UPDATE productos
SET codigo_producto = ('PRD-' || id_producto)
WHERE codigo_producto IS NULL;
