-- =====================================================
-- Datos de prueba (SOLO para desarrollo, nunca en producción)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO sedes (nombre_sede, direccion, estado) VALUES
 ('La Penúltima — Zona Rosa', 'Dirección de prueba 1', 'Activo'),
 ('La Penúltima — Chapinero', 'Dirección de prueba 2', 'Activo'),
 ('La Penúltima — Parque 93', 'Dirección de prueba 3', 'Inactivo');

INSERT INTO usuarios (id_rol, id_sede, nombre_completo, username, password_hash, intentos_fallidos, estado) VALUES
 (
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'),
  (SELECT id_sede FROM sedes WHERE nombre_sede = 'La Penúltima — Zona Rosa'),
  'Laura Cruz', 'lcruz', crypt('Lounge2026', gen_salt('bf', 10)), 0, 'Activo'
 ),
 (
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Mesero'),
  (SELECT id_sede FROM sedes WHERE nombre_sede = 'La Penúltima — Zona Rosa'),
  'Mariana Gómez', 'mgomez', crypt('Lounge2026', gen_salt('bf', 10)), 0, 'Activo'
 ),
 (
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Cajero'),
  (SELECT id_sede FROM sedes WHERE nombre_sede = 'La Penúltima — Zona Rosa'),
  'Camila Torres', 'ctorres', crypt('Lounge2026', gen_salt('bf', 10)), 0, 'Activo'
 ),
 (
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Cajero'),
  (SELECT id_sede FROM sedes WHERE nombre_sede = 'La Penúltima — Chapinero'),
  'Juan Pérez', 'jperez', crypt('Lounge2026', gen_salt('bf', 10)), 3, 'Bloqueado'
 );

INSERT INTO sedes (nombre_sede, direccion, estado) VALUES
('Sede Principal - Zona Rosa', 'Calle 85 #11-45', 'Activo'),
('Sede Norte - Usaquén', 'Carrera 7 #118-20', 'Activo')
ON CONFLICT DO NOTHING;

INSERT INTO proveedores (nombre_proveedor, contacto, telefono) VALUES
('Distribuidora de Licores Nivel Nacional', 'Carlos Gómez', '3001234567'),
('Cervecería Artesanal & Co.', 'Mariana López', '3109876543'),
('Bebidas y Suministros Bar', 'Andrés Pérez', '3205551234');

INSERT INTO productos (id_proveedor, nombre_producto, precio_venta, estado) VALUES
(1, 'Aguardiente Antioqueño Tapa Roja 750ml', 85000.00, 'Activo'),
(1, 'Whisky Old Parr 12 Años 750ml', 210000.00, 'Activo'),
(1, 'Ron Medellín Añejo 3 Años 750ml', 75000.00, 'Activo'),
(2, 'Cerveza Club Colombia Dorada 330ml', 9000.00, 'Activo'),
(2, 'Cerveza Artesanal IPA 330ml', 14000.00, 'Activo'),
(2, 'Cerveza Heineken Bottle 330ml', 11000.00, 'Activo'),
(3, 'Tónica Canada Dry 300ml', 6000.00, 'Activo'),
(3, 'Red Bull Energy Drink 250ml', 12000.00, 'Activo'),
(3, 'Agua Mineral Manantial 500ml', 5000.00, 'Activo'),
(1, 'Tequila Don Julio Reposado 750ml', 320000.00, 'Inactivo');

INSERT INTO inventario_sede (id_sede, id_producto, cantidad_disponible)
SELECT s.id_sede, p.id_producto, 
       CASE 
           WHEN p.estado = 'Inactivo' THEN 0 
           ELSE FLOOR(RANDOM() * 45 + 5)::INT
       END
FROM sedes s
CROSS JOIN productos p
ON CONFLICT (id_sede, id_producto) DO UPDATE 
SET cantidad_disponible = EXCLUDED.cantidad_disponible;
