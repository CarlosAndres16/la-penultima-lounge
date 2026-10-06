-- =====================================================
-- Esquema inicial (borrador del DDL de la arquitectura)
-- =====================================================

CREATE TABLE sedes (
 id_sede SERIAL PRIMARY KEY,
 codigo_sede VARCHAR(20) NOT NULL UNIQUE,
 nombre_sede VARCHAR(100) NOT NULL,
 direccion VARCHAR(255) NOT NULL,
 estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE roles (
 id_rol SERIAL PRIMARY KEY,
 nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE proveedores (
 id_proveedor SERIAL PRIMARY KEY,
 nombre_proveedor VARCHAR(100) NOT NULL,
 identificacion VARCHAR(50),
 contacto VARCHAR(100),
 telefono VARCHAR(20),
 correo VARCHAR(100)
);

CREATE TABLE medios_pago (
 id_medio_pago SERIAL PRIMARY KEY,
 nombre_metodo VARCHAR(50) NOT NULL,
 estado VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE usuarios (
 id_usuario SERIAL PRIMARY KEY,
 codigo_usuario VARCHAR(20) NOT NULL UNIQUE,
 id_rol INT NOT NULL,
 id_sede INT,
 nombre_completo VARCHAR(150) NOT NULL,
 username VARCHAR(50) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 intentos_fallidos INT DEFAULT 0,
 estado VARCHAR(20) DEFAULT 'Activo',
 token_sesion_activa VARCHAR(255),
 CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol) REFERENCES roles(id_rol),
 CONSTRAINT fk_usuario_sede FOREIGN KEY (id_sede) REFERENCES sedes(id_sede)
);

CREATE TABLE productos (
 id_producto SERIAL PRIMARY KEY,
 codigo_producto VARCHAR(20) NOT NULL UNIQUE,
 id_proveedor INT NOT NULL,
 nombre_producto VARCHAR(150) NOT NULL,
 tipo_producto VARCHAR(50) NOT NULL,
 valor_compra NUMERIC(10, 2) NOT NULL,
 precio_venta NUMERIC(10, 2) NOT NULL,
 estado VARCHAR(20) DEFAULT 'Activo',
 CONSTRAINT fk_producto_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
);

CREATE TABLE mesas (
 id_mesa SERIAL PRIMARY KEY,
 id_sede INT NOT NULL,
 numero_mesa VARCHAR(20) NOT NULL,
 estado_actual VARCHAR(20) DEFAULT 'Disponible',
 CONSTRAINT fk_mesa_sede FOREIGN KEY (id_sede) REFERENCES sedes(id_sede)
);

CREATE TABLE inventario_sede (
 id_inventario SERIAL PRIMARY KEY,
 id_sede INT NOT NULL,
 id_producto INT NOT NULL,
 cantidad_disponible INT DEFAULT 0,
 CONSTRAINT fk_inventario_sede FOREIGN KEY (id_sede) REFERENCES sedes(id_sede),
 CONSTRAINT fk_inventario_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
 CONSTRAINT unique_sede_producto UNIQUE (id_sede, id_producto)
);

CREATE TABLE historial_reabastecimientos (
 id_reabastecimiento SERIAL PRIMARY KEY,
 id_sede INT NOT NULL,
 id_producto INT NOT NULL,
 id_usuario INT NOT NULL,
 cantidad_ingresada INT NOT NULL,
 fecha_reabastecimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_historial_sede FOREIGN KEY (id_sede) REFERENCES sedes(id_sede),
 CONSTRAINT fk_historial_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto),
 CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

CREATE TABLE pedidos (
 id_pedido SERIAL PRIMARY KEY,
 id_mesa INT NOT NULL,
 id_usuario_mesero INT NOT NULL,
 fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 fecha_cierre TIMESTAMP,
 estado VARCHAR(20) DEFAULT 'Abierto',
 CONSTRAINT fk_pedido_mesa FOREIGN KEY (id_mesa) REFERENCES mesas(id_mesa),
 CONSTRAINT fk_pedido_usuario FOREIGN KEY (id_usuario_mesero) REFERENCES usuarios(id_usuario)
);

CREATE TABLE detalle_pedido (
 id_detalle_pedido SERIAL PRIMARY KEY,
 id_pedido INT NOT NULL,
 id_producto INT NOT NULL,
 cantidad INT NOT NULL,
 precio_unitario NUMERIC(10, 2) NOT NULL,
 subtotal NUMERIC(10, 2) NOT NULL,
 CONSTRAINT fk_detalle_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
 CONSTRAINT fk_detalle_producto FOREIGN KEY (id_producto) REFERENCES productos(id_producto)
);

CREATE TABLE facturas (
 id_factura SERIAL PRIMARY KEY,
 id_pedido INT NOT NULL UNIQUE,
 id_medio_pago INT NOT NULL,
 nombre_cliente VARCHAR(100),
 total_venta NUMERIC(10, 2) NOT NULL,
 fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_factura_pedido FOREIGN KEY (id_pedido) REFERENCES pedidos(id_pedido),
 CONSTRAINT fk_factura_medio_pago FOREIGN KEY (id_medio_pago) REFERENCES medios_pago(id_medio_pago)
);

CREATE TABLE audit_logs (
 id_log SERIAL PRIMARY KEY,
 usuario_id INT NOT NULL,
 tipo_operacion VARCHAR(50) NOT NULL,
 detalles TEXT,
 fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_audit_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id_usuario)
);

-- =====================================================
-- Datos iniciales (valores documentados en la Propuesta y las HU)
-- =====================================================

INSERT INTO roles (nombre_rol) VALUES ('Mesero'), ('Cajero'), ('Administrador');

INSERT INTO medios_pago (nombre_metodo) VALUES ('Efectivo'), ('Tarjeta Débito'), ('Tarjeta Crédito');