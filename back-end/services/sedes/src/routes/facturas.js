import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, requireSameSede } from '@lounge/common';

const router = express.Router();

router.use(requireAuth((text, params) => pool.query(text, params)));
router.use(requireRole(['Cajero', 'Administrador']));

// Invoices are read-only: there is no route to edit or delete them (HU-29 CA-04)

// GET /api/v1/facturas?sedeId= - Closed orders with their invoice (HU-29 CA-03)
// The Cajero only sees the invoices of their own branch (requireSameSede forces it).
router.get('/', requireSameSede, async (req, res) => {
  const { sedeId } = req.query;
  const params = [];
  let where = '';

  if (sedeId && sedeId !== 'ALL') {
    if (!Number.isInteger(Number(sedeId))) {
      return res.status(400).json({ error: 'Invalid branch id' });
    }
    params.push(Number(sedeId));
    where = 'WHERE s.id_sede = $1';
  }

  try {
    const result = await pool.query(
      `SELECT f.id_factura, f.fecha_emision, f.nombre_cliente, f.total_venta::FLOAT8 AS total_venta,
              mp.nombre_metodo, m.numero_mesa, s.id_sede, s.nombre_sede
       FROM facturas f
       JOIN pedidos p ON p.id_pedido = f.id_pedido
       JOIN mesas m ON m.id_mesa = p.id_mesa
       JOIN sedes s ON s.id_sede = m.id_sede
       JOIN medios_pago mp ON mp.id_medio_pago = f.id_medio_pago
       ${where}
       ORDER BY f.id_factura DESC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing invoices:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/v1/facturas/:idFactura - Full invoice to view, print or download (HU-29 CA-01, CA-03)
router.get('/:idFactura', async (req, res) => {
  const idFactura = Number(req.params.idFactura);

  if (!Number.isInteger(idFactura)) {
    return res.status(400).json({ error: 'Invalid invoice id' });
  }

  try {
    const cabecera = await pool.query(
  `SELECT f.id_factura, f.id_pedido, f.fecha_emision, f.nombre_cliente,
          f.total_venta::FLOAT8 AS total_venta, mp.nombre_metodo,
          m.numero_mesa, s.id_sede, s.codigo_sede, s.nombre_sede
   FROM facturas f
   JOIN pedidos p ON p.id_pedido = f.id_pedido
   JOIN mesas m ON m.id_mesa = p.id_mesa
   JOIN sedes s ON s.id_sede = m.id_sede
   JOIN medios_pago mp ON mp.id_medio_pago = f.id_medio_pago
   WHERE f.id_factura = $1`,
  [idFactura]
    );
    const factura = cabecera.rows[0];

    if (!factura) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (req.user.rol !== 'Administrador' && factura.id_sede !== req.user.id_sede) {
      return res.status(403).json({ error: 'You do not have permission to access this branch information.' });
    }

    const lineas = await pool.query(
      `SELECT d.id_detalle_pedido, pr.nombre_producto, d.cantidad,
              d.precio_unitario::FLOAT8 AS precio_unitario, d.subtotal::FLOAT8 AS subtotal
       FROM detalle_pedido d
       JOIN productos pr ON pr.id_producto = d.id_producto
       WHERE d.id_pedido = $1
       ORDER BY d.id_detalle_pedido`,
      [factura.id_pedido]
    );

    res.json({ ...factura, lineas: lineas.rows });
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;