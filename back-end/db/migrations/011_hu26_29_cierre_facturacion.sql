-- =====================================================
-- HU-26 / HU-27 / HU-28 / HU-29: close order, payment method and invoice
-- Idempotent: safe to run on an existing database.
-- =====================================================

-- HU-28 CA-03: the closed order keeps the cashier who closed it and the payment method used
-- (fecha_cierre already exists in the table)
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS id_usuario_cajero INT REFERENCES usuarios(id_usuario),
  ADD COLUMN IF NOT EXISTS id_medio_pago INT REFERENCES medios_pago(id_medio_pago);