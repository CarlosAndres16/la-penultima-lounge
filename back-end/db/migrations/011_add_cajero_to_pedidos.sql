-- 011_add_cajero_to_pedidos.sql
-- Añade la columna id_usuario_cajero a la tabla pedidos para registrar quién cierra la orden
-- La columna permite NULL mientras el pedido está abierto y se rellena al cerrarse.

ALTER TABLE pedidos
  ADD COLUMN id_usuario_cajero INT DEFAULT NULL;

-- Añade la restricción de clave foránea que apunta a la tabla usuarios
ALTER TABLE pedidos
  ADD CONSTRAINT fk_pedido_cajero FOREIGN KEY (id_usuario_cajero) REFERENCES usuarios(id_usuario);

