-- =====================================================
-- Add valor_compra column to productos table (default 0)
-- =====================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS valor_compra NUMERIC(10,2) NOT NULL DEFAULT 0;
 