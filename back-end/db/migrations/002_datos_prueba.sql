-- =====================================================
-- Test data (FOR DEVELOPMENT ONLY, never in production)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO sedes (codigo_sede, nombre_sede, direccion, estado) VALUES
 ('SED-01', 'La Penúltima — Zona Rosa', 'Test address 1', 'Activo'),
 ('SED-02', 'La Penúltima — Chapinero', 'Test address 2', 'Activo'),
 ('SED-03', 'La Penúltima — Parque 93', 'Test address 3', 'Inactivo');

INSERT INTO usuarios (codigo_usuario, id_rol, id_sede, nombre_completo, username, password_hash, intentos_fallidos, estado) VALUES
 (
  'USR-001',
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'),
  (SELECT id_sede FROM sedes WHERE codigo_sede = 'SED-01'),
  'Laura Cruz', 'lcruz', crypt('Lounge2026', gen_salt('bf', 10)), 0, 'Activo'
 ),
 (
  'USR-002',
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Mesero'),
  (SELECT id_sede FROM sedes WHERE codigo_sede = 'SED-01'),
  'Mariana Gómez', 'mgomez', crypt('Lounge2026', gen_salt('bf', 10)), 0, 'Activo'
 ),
 (
  'USR-003',
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Cajero'),
  (SELECT id_sede FROM sedes WHERE codigo_sede = 'SED-01'),
  'Camila Torres', 'ctorres', crypt('Lounge2026', gen_salt('bf', 10)), 0, 'Activo'
 ),
 (
  'USR-004',
  (SELECT id_rol FROM roles WHERE nombre_rol = 'Cajero'),
  (SELECT id_sede FROM sedes WHERE codigo_sede = 'SED-02'),
  'Juan Pérez', 'jperez', crypt('Lounge2026', gen_salt('bf', 10)), 0, 'Activo'
 );

-- Single supplier (HU-12 CA-02: only one active supplier at a time)
INSERT INTO proveedores (nombre_proveedor, identificacion, contacto, telefono, correo) VALUES
 ('Distribuidora Andina de Licores S.A.S.', 'NIT 900.123.456-7', 'Carlos Gómez', '(601) 745 2200', 'compras@distribuidoraandina.com');

INSERT INTO productos (codigo_producto, id_proveedor, nombre_producto, tipo_producto, valor_compra, precio_venta, estado) VALUES
 ('PRD-101', 1, 'Classic Mojito', 'Cocktail', 14000.00, 28000.00, 'Activo'),
 ('PRD-118', 1, 'Penúltima Old Fashioned', 'Signature cocktail', 14000.00, 35000.00, 'Activo'),
 ('PRD-204', 1, 'Craft IPA Beer', 'Beer', 8000.00, 18000.00, 'Activo'),
 ('PRD-205', 1, 'Club Colombia Golden Beer 330ml', 'Beer', 4500.00, 9000.00, 'Activo'),
 ('PRD-301', 1, 'Manantial Mineral Water 500ml', 'Non-alcoholic', 2500.00, 5000.00, 'Activo'),
 ('PRD-999', 1, 'Don Julio Reposado Tequila 750ml', 'Liquor', 160000.00, 320000.00, 'Inactivo');

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

-- Test tables (SED-01: 10 tables, SED-02: 6 tables)
INSERT INTO mesas (id_sede, numero_mesa, estado_actual)
SELECT s.id_sede, LPAD(n::TEXT, 2, '0'),
       CASE WHEN n IN (2, 6) THEN 'Ocupada'
            WHEN n IN (4, 9) THEN 'Reservada'
            ELSE 'Libre' END
FROM sedes s
CROSS JOIN generate_series(1, 10) AS n
WHERE s.codigo_sede = 'SED-01';

INSERT INTO mesas (id_sede, numero_mesa, estado_actual)
SELECT s.id_sede, LPAD(n::TEXT, 2, '0'), 'Libre'
FROM sedes s
CROSS JOIN generate_series(1, 6) AS n
WHERE s.codigo_sede = 'SED-02';

-- =====================================================
-- Open orders for the tables seeded as 'Ocupada' (SED-01: tables 02 and 06)
-- Keeps the table map (HU-21) consistent with orders and stock.
-- =====================================================
INSERT INTO pedidos (id_mesa, id_usuario_mesero, fecha_apertura, estado)
SELECT m.id_mesa,
       (SELECT id_usuario FROM usuarios WHERE username = 'mgomez'),
       CURRENT_TIMESTAMP - CASE m.numero_mesa WHEN '02' THEN INTERVAL '40 minutes' ELSE INTERVAL '15 minutes' END,
       'Abierto'
FROM mesas m
JOIN sedes s ON s.id_sede = m.id_sede
WHERE s.codigo_sede = 'SED-01'
  AND m.estado_actual = 'Ocupada';

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
SELECT ped.id_pedido, p.id_producto, l.cantidad, p.precio_venta, l.cantidad * p.precio_venta
FROM (VALUES
       ('02', 'PRD-118', 2),
       ('02', 'PRD-204', 3),
       ('06', 'PRD-101', 1),
       ('06', 'PRD-205', 2)
     ) AS l(numero_mesa, codigo_producto, cantidad)
JOIN sedes s ON s.codigo_sede = 'SED-01'
JOIN mesas m ON m.id_sede = s.id_sede AND m.numero_mesa = l.numero_mesa
JOIN pedidos ped ON ped.id_mesa = m.id_mesa AND ped.estado = 'Abierto'
JOIN productos p ON p.codigo_producto = l.codigo_producto;

-- Products already placed in open orders are discounted from that branch's stock
UPDATE inventario_sede i
SET cantidad_disponible = i.cantidad_disponible - c.total
FROM (
  SELECT m.id_sede, d.id_producto, SUM(d.cantidad)::INT AS total
  FROM detalle_pedido d
  JOIN pedidos ped ON ped.id_pedido = d.id_pedido
  JOIN mesas m ON m.id_mesa = ped.id_mesa
  WHERE ped.estado = 'Abierto'
  GROUP BY m.id_sede, d.id_producto
) c
WHERE i.id_sede = c.id_sede AND i.id_producto = c.id_producto;