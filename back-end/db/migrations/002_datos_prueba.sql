-- =====================================================
-- Datos de prueba (SOLO para desarrollo, nunca en producción)
-- =====================================================

-- pgcrypto permite generar hashes bcrypt desde SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Sedes (los nombres salen del mockup de HU-01; las direcciones son de relleno)
INSERT INTO sedes (nombre_sede, direccion, estado) VALUES
 ('La Penúltima — Zona Rosa', 'Dirección de prueba 1', 'Activo'),
 ('La Penúltima — Chapinero', 'Dirección de prueba 2', 'Activo'),
 ('La Penúltima — Parque 93', 'Dirección de prueba 3', 'Inactivo');

-- Usuarios (contraseña de todos: Lounge2026)
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