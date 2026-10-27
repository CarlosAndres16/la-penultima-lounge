import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();

router.use(requireAuth((text, params) => pool.query(text, params)));

/**
 * GET /api/v1/reportes/ventas (HU-32)
 * Mandatory query params: fechaInicio ('YYYY-MM-DD'), fechaFin ('YYYY-MM-DD')
 * Optional query param: sedeId (id_sede or 'ALL' - only for Administrador, CA-01/CA-04)
 * Filter is strictly based on fecha_apertura (CA-03).
 * Returns:
 *   - agrupado: list by product with fecha, codigo_producto, nombre_producto, cantidad_vendida, valor_compra, valor_venta, ganancia (CA-02)
 *   - resumenDiario: list grouped by date with fecha, pedidos, ventas, ticket_promedio (mockup)
 *   - totales: { total_pedidos, total_ventas, ganancia_total, ticket_promedio }
 */
router.get('/ventas', requireRole(['Administrador', 'Cajero']), async (req, res) => {
  try {
    const { fechaInicio, fechaFin, sedeId } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const conditions = ["p.estado = 'Cerrado'"];
    const params = [];

    // Branch restriction (CA-04: Cashier cannot see or filter other branches)
    if (req.user.rol !== 'Administrador') {
      params.push(req.user.id_sede);
      conditions.push(`m.id_sede = $${params.length}`);
    } else if (sedeId && sedeId !== 'ALL') {
      const parsedSede = Number(sedeId);
      if (Number.isInteger(parsedSede)) {
        params.push(parsedSede);
        conditions.push(`m.id_sede = $${params.length}`);
      }
    }

    // CA-03: Filter strictly by order opening date (fecha_apertura)
    params.push(`${fechaInicio} 00:00:00`);
    conditions.push(`p.fecha_apertura >= $${params.length}`);

    params.push(`${fechaFin} 23:59:59`);
    conditions.push(`p.fecha_apertura <= $${params.length}`);

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query 1: Product-level details (CA-02)
    const productQuery = `
      SELECT TO_CHAR(p.fecha_apertura, 'YYYY-MM-DD') AS fecha,
             s.nombre_sede,
             s.codigo_sede,
             pr.id_producto,
             pr.codigo_producto,
             pr.nombre_producto,
             pr.tipo_producto,
             SUM(d.cantidad)::INT AS cantidad_vendida,
             pr.valor_compra::FLOAT8 AS valor_compra,
             d.precio_unitario::FLOAT8 AS valor_venta,
             SUM(d.subtotal)::FLOAT8 AS total_venta,
             SUM((d.precio_unitario - pr.valor_compra) * d.cantidad)::FLOAT8 AS ganancia
      FROM pedidos p
      JOIN mesas m ON m.id_mesa = p.id_mesa
      JOIN sedes s ON s.id_sede = m.id_sede
      JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
      JOIN productos pr ON pr.id_producto = d.id_producto
      ${whereClause}
      GROUP BY TO_CHAR(p.fecha_apertura, 'YYYY-MM-DD'), s.nombre_sede, s.codigo_sede, pr.id_producto, pr.codigo_producto, pr.nombre_producto, pr.tipo_producto, pr.valor_compra, d.precio_unitario
      ORDER BY fecha DESC, s.nombre_sede ASC, pr.nombre_producto ASC
    `;

    // Query 2: Daily summary matching mockup (fecha, pedidos, ventas, ticket_promedio)
    const dailyQuery = `
      SELECT TO_CHAR(p.fecha_apertura, 'YYYY-MM-DD') AS fecha,
             COUNT(DISTINCT p.id_pedido)::INT AS pedidos,
             COALESCE(SUM(d.subtotal), 0)::FLOAT8 AS ventas,
             ROUND(COALESCE(SUM(d.subtotal) / NULLIF(COUNT(DISTINCT p.id_pedido), 0), 0)::NUMERIC, 2)::FLOAT8 AS ticket_promedio,
             COALESCE(SUM((d.precio_unitario - pr.valor_compra) * d.cantidad), 0)::FLOAT8 AS ganancia
      FROM pedidos p
      JOIN mesas m ON m.id_mesa = p.id_mesa
      JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
      JOIN productos pr ON pr.id_producto = d.id_producto
      ${whereClause}
      GROUP BY TO_CHAR(p.fecha_apertura, 'YYYY-MM-DD')
      ORDER BY fecha DESC
    `;

    // Sede info if specific sede queried
    let nombreSedeConsultada = 'Todas las sedes';
    if (req.user.rol !== 'Administrador') {
      const sRes = await pool.query('SELECT nombre_sede FROM sedes WHERE id_sede = $1', [req.user.id_sede]);
      nombreSedeConsultada = sRes.rows[0]?.nombre_sede || 'Sede Asignada';
    } else if (sedeId && sedeId !== 'ALL') {
      const sRes = await pool.query('SELECT nombre_sede FROM sedes WHERE id_sede = $1', [Number(sedeId)]);
      nombreSedeConsultada = sRes.rows[0]?.nombre_sede || `Sede ${sedeId}`;
    }

    const [productRes, dailyRes] = await Promise.all([
      pool.query(productQuery, params),
      pool.query(dailyQuery, params)
    ]);

    const totalPedidos = dailyRes.rows.reduce((sum, r) => sum + r.pedidos, 0);
    const totalVentas = dailyRes.rows.reduce((sum, r) => sum + r.ventas, 0);
    const totalGanancia = dailyRes.rows.reduce((sum, r) => sum + r.ganancia, 0);
    const ticketPromedio = totalPedidos > 0 ? Math.round((totalVentas / totalPedidos) * 100) / 100 : 0;

    res.json({
      sedeConsultada: nombreSedeConsultada,
      fechaInicio,
      fechaFin,
      productos: productRes.rows,
      resumenDiario: dailyRes.rows,
      totales: {
        pedidos: totalPedidos,
        ventas: Math.round(totalVentas * 100) / 100,
        ganancia: Math.round(totalGanancia * 100) / 100,
        ticket_promedio: ticketPromedio
      }
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * GET /api/v1/reportes/consolidado (HU-34)
 * Exclusive for Administrador (CA-03).
 * Query params: fechaInicio ('YYYY-MM-DD', optional), fechaFin ('YYYY-MM-DD', optional)
 * Returns table comparing all branches with:
 *   - Sede
 *   - Pedidos
 *   - Ventas
 *   - Ganancia (CA-02: desempeño comparativo: total vendido y ganancia por sede)
 *   - Inventario Valorizado (mockup)
 *   - Totales generales (CA-01)
 */
router.get('/consolidado', requireRole(['Administrador']), async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    const conditions = ["p.estado = 'Cerrado'"];
    const params = [];

    if (fechaInicio) {
      params.push(`${fechaInicio} 00:00:00`);
      conditions.push(`p.fecha_apertura >= $${params.length}`);
    }
    if (fechaFin) {
      params.push(`${fechaFin} 23:59:59`);
      conditions.push(`p.fecha_apertura <= $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query sales by branch in period
    const salesQuery = `
      SELECT s.id_sede,
             s.codigo_sede,
             s.nombre_sede,
             COUNT(DISTINCT p.id_pedido)::INT AS pedidos,
             COALESCE(SUM(d.subtotal), 0)::FLOAT8 AS ventas,
             COALESCE(SUM((d.precio_unitario - pr.valor_compra) * d.cantidad), 0)::FLOAT8 AS ganancia
      FROM sedes s
      LEFT JOIN mesas m ON m.id_sede = s.id_sede
      LEFT JOIN pedidos p ON p.id_mesa = m.id_mesa
      LEFT JOIN detalle_pedido d ON d.id_pedido = p.id_pedido
      LEFT JOIN productos pr ON pr.id_producto = d.id_producto
      ${whereClause}
      GROUP BY s.id_sede, s.codigo_sede, s.nombre_sede
      ORDER BY s.id_sede ASC
    `;

    // Query inventory valuation by branch (sum of available quantity * unit purchase cost)
    const inventoryQuery = `
      SELECT s.id_sede,
             COALESCE(SUM(inv.cantidad_disponible * pr.valor_compra), 0)::FLOAT8 AS inventario_valorizado
      FROM sedes s
      LEFT JOIN inventario_sede inv ON inv.id_sede = s.id_sede
      LEFT JOIN productos pr ON pr.id_producto = inv.id_producto
      GROUP BY s.id_sede
    `;

    // List all branches so even branches with 0 orders show up (as in mockup)
    const sedesQuery = `SELECT id_sede, codigo_sede, nombre_sede, estado FROM sedes ORDER BY id_sede ASC`;

    const [sedesRes, salesRes, invRes] = await Promise.all([
      pool.query(sedesQuery),
      pool.query(salesQuery, params),
      pool.query(inventoryQuery)
    ]);

    const salesMap = new Map(salesRes.rows.map(r => [r.id_sede, r]));
    const invMap = new Map(invRes.rows.map(r => [r.id_sede, r.inventario_valorizado]));

    const consolidado = sedesRes.rows.map(sede => {
      const sale = salesMap.get(sede.id_sede) || { pedidos: 0, ventas: 0, ganancia: 0 };
      const inventario = invMap.get(sede.id_sede) || 0;
      return {
        id_sede: sede.id_sede,
        codigo_sede: sede.codigo_sede,
        nombre_sede: sede.nombre_sede,
        pedidos: sale.pedidos,
        ventas: Math.round(sale.ventas * 100) / 100,
        ganancia: Math.round(sale.ganancia * 100) / 100,
        inventario_valorizado: Math.round(inventario * 100) / 100
      };
    });

    const totalGeneral = {
      pedidos: consolidado.reduce((acc, s) => acc + s.pedidos, 0),
      ventas: Math.round(consolidado.reduce((acc, s) => acc + s.ventas, 0) * 100) / 100,
      ganancia: Math.round(consolidado.reduce((acc, s) => acc + s.ganancia, 0) * 100) / 100,
      inventario_valorizado: Math.round(consolidado.reduce((acc, s) => acc + s.inventario_valorizado, 0) * 100) / 100
    };

    res.json({
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      sedes: consolidado,
      totalGeneral
    });
  } catch (error) {
    console.error('Error generating consolidated report:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;

