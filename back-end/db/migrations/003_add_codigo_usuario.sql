-- =====================================================
-- Add codigo_usuario column to usuarios table
-- =====================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_usuario VARCHAR(20);