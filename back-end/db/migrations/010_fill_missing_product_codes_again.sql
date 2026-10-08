-- =====================================================
-- Fill missing product codes for any products that still have NULL after previous migrations
-- =====================================================

UPDATE productos
SET codigo_producto = ('PRD-' || id_producto)
WHERE codigo_producto IS NULL;
