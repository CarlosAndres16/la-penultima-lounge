import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const meseroOnly = requireRole(['Mesero', 'Administrador']);
const meseroOrCajero = requireRole(['Mesero', 'Cajero', 'Administrador']);
const cajeroOrAdmin = requireRole(['Cajero', 'Administrador']); // HU-28: the Cajero and the Administrador close orders
const DEFAULT_CUSTOMER = 'Consumidor Final'; // HU-27 CA-02

router.use(authMiddleware);

// Error that carries an HTTP status; thrown inside handlers and mapped to a response by sendError
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const sendError = (res, error, label) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message, ...error.extra });
  }
  console.error(`Error ${label}:`, error);
  res.status(500).json({ error: 'Internal error' });
};

// Orders can only be handled by users of the same branch as the table (HU-25: branches are independent)
const assertSameSede = (user, idSede) => {
  // The Administrador works on any branch (the table or order decides which one)
  if (user.rol !== 'Administrador' && idSede !== user.id_sede) {
    throw new HttpError(403, 'You do not have permission to access this branch information.');
  }
};

// Runs `work` inside a transaction. `work` returns { status, body } and may throw HttpError.
const runInTransaction = async (res, label, work) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { status, body } = await work(client);
    await client.query('COMMIT');
    res.status(status).json(body);
  } catch (error) {
    await client.query('ROLLBACK');
    // Unique index uq_pedido_abierto_por_mesa: two simultaneous requests tried to open the same table
    if (error.code === '23505') {
      return res.status(409).json({ error: 'The table already has an open order' });
    }
    sendError(res, error, label);
  } finally {
    client.release();
  }
};

// Order header + lines + accumulated total (HU-21 CA-03, HU-24 CA-05)
const getPedidoDetalle = async (db, idPedido) => {
  const cabecera = await db.query(
    `SELECT p.id_pedido, p.id_mesa, m.numero_mesa, m.id_sede, p.estado, p.fecha_apertura,
            u.nombre_completo AS nombre_mesero
     FROM pedidos p
     JOIN mesas m ON m.id_mesa = p.id_mesa
     JOIN usuarios u ON u.id_usuario = p.id_usuario_mesero
     WHERE p.id_pedido = $1`,
    [idPedido]
  );
  if (cabecera.rows.length === 0) {
    return null;
  }

  const lineas = await db.query(
    `SELECT d.id_detalle_pedido, d.id_producto, pr.codigo_producto, pr.nombre_producto,
            d.cantidad, d.precio_unitario::FLOAT8 AS precio_unitario, d.subtotal::FLOAT8 AS subtotal
     FROM detalle_pedido d
     JOIN productos pr ON pr.id_producto = d.id_producto
     WHERE d.id_pedido = $1
     ORDER BY d.id_detalle_pedido`,
    [idPedido]
  );

  const total = lineas.rows.reduce((acc, linea) => acc + linea.subtotal, 0);
  return { ...cabecera.rows[0], lineas: lineas.rows, total: Math.round(total * 100) / 100 };
};

// Locks the order row (serializes concurrent changes on the same order) and checks branch and status
const lockPedidoAbierto = async (client, idPedido, user) => {
  const result = await client.query(
    `SELECT p.id_pedido, p.estado, m.id_sede
     FROM pedidos p
     JOIN mesas m ON m.id_mesa = p.id_mesa
     WHERE p.id_pedido = $1
     FOR UPDATE OF p`,
    [idPedido]
  );
  const pedido = result.rows[0];

  if (!pedido) {
    throw new HttpError(404, 'Order not found');
  }
  assertSameSede(user, pedido.id_sede);
  if (pedido.estado !== 'Abierto') {
    throw new HttpError(409, 'The order is not open');
  }
  return pedido;
};

// GET /api/v1/pedidos/mesa/:idMesa - Summary of the open order of a table (HU-21 CA-03)
router.get('/mesa/:idMesa', meseroOrCajero, async (req, res) => {
  const idMesa = Number(req.params.idMesa);

  if (!Number.isInteger(idMesa)) {
    return res.status(400).json({ error: 'Invalid table id' });
  }

  try {
    const mesaRes = await pool.query('SELECT id_mesa, id_sede FROM mesas WHERE id_mesa = $1', [idMesa]);
    const mesa = mesaRes.rows[0];

    if (!mesa) {
      throw new HttpError(404, 'Table not found');
    }
    assertSameSede(req.user, mesa.id_sede);

    const pedidoRes = await pool.query(
      `SELECT id_pedido FROM pedidos WHERE id_mesa = $1 AND estado = 'Abierto' LIMIT 1`,
      [idMesa]
    );
    if (pedidoRes.rows.length === 0) {
      throw new HttpError(404, 'The table has no open order');
    }

    res.json(await getPedidoDetalle(pool, pedidoRes.rows[0].id_pedido));
  } catch (error) {
    sendError(res, error, 'getting open order');
  }
});

// POST /api/v1/pedidos - Start an order on a free table (HU-22 CA-01, CA-02, CA-03, CA-04)
// Body: { id_mesa }. The order is linked only to the table, never to a customer (CA-04).
router.post('/', meseroOnly, async (req, res) => {
  const idMesa = Number(req.body.id_mesa);

  if (!Number.isInteger(idMesa)) {
    return res.status(400).json({ error: 'Table id is required' });
  }

  await runInTransaction(res, 'opening order', async (client) => {
    // Lock the table row so two waiters cannot open the same table at the same time
    const mesaRes = await client.query(
      'SELECT id_mesa, id_sede, numero_mesa, estado_actual FROM mesas WHERE id_mesa = $1 FOR UPDATE',
      [idMesa]
    );
    const mesa = mesaRes.rows[0];

    if (!mesa) {
      throw new HttpError(404, 'Table not found');
    }
    assertSameSede(req.user, mesa.id_sede);

    if (mesa.estado_actual === 'Ocupada') {
      throw new HttpError(409, 'The table already has an open order');
    }
    if (mesa.estado_actual !== 'Libre') {
      throw new HttpError(400, 'Only free tables can start a new order');
    }

    // Branch, table, waiter and opening date/time are recorded (CA-02): the branch comes from the table
    const pedidoRes = await client.query(
      'INSERT INTO pedidos (id_mesa, id_usuario_mesero, estado) VALUES ($1, $2, $3) RETURNING id_pedido',
      [idMesa, req.user.id_usuario, 'Abierto']
    );
    await client.query(`UPDATE mesas SET estado_actual = 'Ocupada' WHERE id_mesa = $1`, [idMesa]);

    await client.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_ORDER', `Opened order ${pedidoRes.rows[0].id_pedido} on table ${mesa.numero_mesa} (branch id ${mesa.id_sede})`]
    );

    return { status: 201, body: await getPedidoDetalle(client, pedidoRes.rows[0].id_pedido) };
  });
});

// POST /api/v1/pedidos/:idPedido/items - Add a product to an open order (HU-23, HU-24 CA-01, CA-02, CA-03)
// Body: { id_producto, cantidad }
router.post('/:idPedido/items', meseroOnly, async (req, res) => {
  const idPedido = Number(req.params.idPedido);
  const idProducto = Number(req.body.id_producto);
  const cantidad = Number(req.body.cantidad);

  if (!Number.isInteger(idPedido)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  if (!Number.isInteger(idProducto)) {
    return res.status(400).json({ error: 'Product id is required' });
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return res.status(400).json({ error: 'Quantity must be a whole number greater than zero' });
  }

  await runInTransaction(res, 'adding product to order', async (client) => {
    const pedido = await lockPedidoAbierto(client, idPedido, req.user);

    const productoRes = await client.query(
      'SELECT id_producto, estado FROM productos WHERE id_producto = $1',
      [idProducto]
    );
    const producto = productoRes.rows[0];

    if (!producto || producto.estado !== 'Activo') {
      throw new HttpError(400, 'Product not found or inactive');
    }

    // Real-time stock check and discount in ONE atomic statement (HU-23 CA-01, CA-03, HU-24 CA-03).
    // If two waiters ask for the same product at once, the row lock makes the second request wait
    // and be evaluated against the already-updated stock, so the one that exceeds it is rejected.
    const stockRes = await client.query(
      `UPDATE inventario_sede
       SET cantidad_disponible = cantidad_disponible - $1
       WHERE id_sede = $2 AND id_producto = $3 AND cantidad_disponible >= $1
       RETURNING cantidad_disponible`,
      [cantidad, pedido.id_sede, idProducto]
    );

    if (stockRes.rowCount === 0) {
      const disponibleRes = await client.query(
        'SELECT cantidad_disponible FROM inventario_sede WHERE id_sede = $1 AND id_producto = $2',
        [pedido.id_sede, idProducto]
      );
      const disponible = disponibleRes.rows[0]?.cantidad_disponible ?? 0;
      throw new HttpError(409, `Insufficient stock. Available: ${disponible}`, { disponible });
    }

    // One line per product: if it is already in the order, increase its quantity
    const lineaRes = await client.query(
      'SELECT id_detalle_pedido FROM detalle_pedido WHERE id_pedido = $1 AND id_producto = $2',
      [idPedido, idProducto]
    );

    if (lineaRes.rows.length > 0) {
      await client.query(
        `UPDATE detalle_pedido
         SET cantidad = cantidad + $1::INT, subtotal = (cantidad + $1::INT) * precio_unitario
         WHERE id_detalle_pedido = $2`,
        [cantidad, lineaRes.rows[0].id_detalle_pedido]
      );
    } else {
      await client.query(
        `INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario, subtotal)
         SELECT $1::INT, id_producto, $2::INT, precio_venta, $2::INT * precio_venta
         FROM productos
         WHERE id_producto = $3`,
        [idPedido, cantidad, idProducto]
      );
    }

    return { status: 201, body: await getPedidoDetalle(client, idPedido) };
  });
});

// DELETE /api/v1/pedidos/:idPedido/items/:idDetalle - Remove a line from an open order (HU-24 CA-04)
// The quantity goes back to the stock of the branch.
router.delete('/:idPedido/items/:idDetalle', meseroOnly, async (req, res) => {
  const idPedido = Number(req.params.idPedido);
  const idDetalle = Number(req.params.idDetalle);

  if (!Number.isInteger(idPedido) || !Number.isInteger(idDetalle)) {
    return res.status(400).json({ error: 'Invalid order or line id' });
  }

  await runInTransaction(res, 'removing product from order', async (client) => {
    const pedido = await lockPedidoAbierto(client, idPedido, req.user);

    const lineaRes = await client.query(
      'DELETE FROM detalle_pedido WHERE id_detalle_pedido = $1 AND id_pedido = $2 RETURNING id_producto, cantidad',
      [idDetalle, idPedido]
    );
    const linea = lineaRes.rows[0];

    if (!linea) {
      throw new HttpError(404, 'Order line not found');
    }

    await client.query(
      `UPDATE inventario_sede
       SET cantidad_disponible = cantidad_disponible + $1
       WHERE id_sede = $2 AND id_producto = $3`,
      [linea.cantidad, pedido.id_sede, linea.id_producto]
    );

    return { status: 200, body: await getPedidoDetalle(client, idPedido) };
  });
});

// POST /api/v1/pedidos/:idPedido/cancelar - Cancel an open order that has no products and free the table
// Used when the customers change their mind before ordering anything. Orders with products cannot be
// cancelled (their stock was already discounted); they must be closed instead.
router.post('/:idPedido/cancelar', meseroOnly, async (req, res) => {
  const idPedido = Number(req.params.idPedido);

  if (!Number.isInteger(idPedido)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  await runInTransaction(res, 'cancelling order', async (client) => {
    // Locks the order: a product cannot be added while it is being cancelled
    const pedido = await lockPedidoAbierto(client, idPedido, req.user);

    const lineasRes = await client.query(
      'SELECT COUNT(*)::INT AS lineas FROM detalle_pedido WHERE id_pedido = $1',
      [idPedido]
    );
    if (lineasRes.rows[0].lineas > 0) {
      throw new HttpError(409, 'The order already has products and cannot be cancelled');
    }

    const pedidoRes = await client.query('DELETE FROM pedidos WHERE id_pedido = $1 RETURNING id_mesa', [idPedido]);
    await client.query(`UPDATE mesas SET estado_actual = 'Libre' WHERE id_mesa = $1`, [pedidoRes.rows[0].id_mesa]);

    await client.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CANCEL_ORDER', `Cancelled empty order ${idPedido} (table id ${pedidoRes.rows[0].id_mesa}, branch id ${pedido.id_sede})`]
    );

    return { status: 200, body: { message: 'Order cancelled and table freed', id_pedido: idPedido } };
  });
});

// POST /api/v1/pedidos/:idPedido/cerrar - Close an open order, free the table and issue the invoice
// (HU-26 payment method, HU-27 customer name, HU-28 close and free table, HU-29 invoice)
// Body: { id_medio_pago, nombre_cliente (optional) }
router.post('/:idPedido/cerrar', cajeroOrAdmin, async (req, res) => {
  const idPedido = Number(req.params.idPedido);
  const idMedioPago = Number(req.body?.id_medio_pago);
  const nombreCliente = String(req.body?.nombre_cliente ?? '').trim();

  if (!Number.isInteger(idPedido)) {
    return res.status(400).json({ error: 'Invalid order id' });
  }
  if (!Number.isInteger(idMedioPago)) {
    return res.status(400).json({ error: 'Select a payment method' });
  }
  if (nombreCliente.length > 100) {
    return res.status(400).json({ error: 'Customer name must be 100 characters or fewer' });
  }

  await runInTransaction(res, 'closing order', async (client) => {
    // Locks the order: two cashiers cannot close it twice (HU-28 CA-01)
    const pedido = await lockPedidoAbierto(client, idPedido, req.user);

    // Only the enabled payment methods are valid (HU-26 CA-01, CA-03)
    const medioRes = await client.query(
      `SELECT id_medio_pago FROM medios_pago WHERE id_medio_pago = $1 AND estado = 'Activo'`,
      [idMedioPago]
    );
    if (medioRes.rows.length === 0) {
      throw new HttpError(400, 'Select a valid payment method');
    }

    const lineasRes = await client.query(
      'SELECT COUNT(*)::INT AS lineas FROM detalle_pedido WHERE id_pedido = $1',
      [idPedido]
    );
    if (lineasRes.rows[0].lineas === 0) {
      throw new HttpError(400, 'The order has no products. Add at least one product before closing it');
    }

    // Order -> Cerrado with cashier, closing date/time and payment method (HU-28 CA-01, CA-03)
    const pedidoRes = await client.query(
      `UPDATE pedidos
       SET estado = 'Cerrado', fecha_cierre = CURRENT_TIMESTAMP, id_usuario_cajero = $1, id_medio_pago = $2
       WHERE id_pedido = $3
       RETURNING id_mesa`,
      [req.user.id_usuario, idMedioPago, idPedido]
    );
    await client.query(`UPDATE mesas SET estado_actual = 'Libre' WHERE id_mesa = $1`, [pedidoRes.rows[0].id_mesa]);

    // Invoice: the total is calculated here from the order lines, never trusted from the client.
    // No tip is calculated (HU-29 CA-02). The consecutive number is the unique id_factura (HU-29 CA-01).
    const facturaRes = await client.query(
      `INSERT INTO facturas (id_pedido, id_medio_pago, nombre_cliente, total_venta)
       SELECT $1::INT, $2::INT, $3::TEXT, COALESCE(SUM(subtotal), 0)
       FROM detalle_pedido
       WHERE id_pedido = $1::INT
       RETURNING id_factura, total_venta::FLOAT8 AS total_venta`,
      [idPedido, idMedioPago, nombreCliente || DEFAULT_CUSTOMER]
    );
    const factura = facturaRes.rows[0];

    await client.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CLOSE_ORDER', `Closed order ${idPedido} (branch id ${pedido.id_sede}), invoice ${factura.id_factura}, total ${factura.total_venta}`]
    );

    return {
      status: 201,
      body: { id_factura: factura.id_factura, id_pedido: idPedido, total: factura.total_venta },
    };
  });
});

export default router;