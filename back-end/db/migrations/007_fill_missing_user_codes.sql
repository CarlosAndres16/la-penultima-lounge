-- =====================================================
-- Fill missing user codes (auto‑generated)
-- =====================================================

UPDATE usuarios
SET codigo_usuario = 'USR-' || id_usuario
WHERE codigo_usuario IS NULL OR trim(codigo_usuario) = '';
