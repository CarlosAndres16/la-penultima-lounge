-- =====================================================
-- HU-20: restock history keeps supplier, unit cost and total
-- Idempotent: safe to run on an existing database.
-- =====================================================

ALTER TABLE historial_reabastecimientos
  ADD COLUMN IF NOT EXISTS id_proveedor INT REFERENCES proveedores(id_proveedor),
  ADD COLUMN IF NOT EXISTS valor_compra_unitario NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS valor_total NUMERIC(14, 2);

-- Guard at DB level: quantity must be a positive integer (HU-20 CA-05)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reabastecimiento_cantidad_positiva'
  ) THEN
    ALTER TABLE historial_reabastecimientos
      ADD CONSTRAINT chk_reabastecimiento_cantidad_positiva CHECK (cantidad_ingresada > 0);
  END IF;
END $$;