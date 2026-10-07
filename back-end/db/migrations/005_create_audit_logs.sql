-- =====================================================
-- Create audit_logs table (if missing)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id_log SERIAL PRIMARY KEY,
  usuario_id INT NOT NULL,
  tipo_operacion VARCHAR(50) NOT NULL,
  detalles TEXT,
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id_usuario)
);
