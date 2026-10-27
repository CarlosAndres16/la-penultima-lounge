import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();

router.use(requireAuth((text, params) => pool.query(text, params)));
// HU-20: only Administrador or Cajero can register restocks
router.use(requireRole(['Administrador', 'Cajero']));

const MAX_QUANTITY = 100000; // sanity cap (not in the HU) to avoid numeric overflow
const QUANTITY_ERROR = 'Quantity must be a whole number greater than zero';

const parseQuantity = (value) => {
  if (value === null || value === undefined || typeof value === 'boolean') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// The branch is always taken from the token for Cajero (CA-04: never another branch).
// Administrador must pick one specific branch.
const resolveSedeId = (req) => {
  if (req.user.rol === 'Administrador') {
    const raw = req.body?.id_sede ?? req.query.sedeId;
    const n = Number(raw);
    return raw !== undefined && raw !== 'ALL' && Number.isInteger(n) ? n : null;
  }
  return req.user.id_sede ?? null;
};

/**
 * GET /api/v1/reabastecimientos/formulario
 * Data for the "New Restock" form: active catalog + the single supplier (HU-12).
 * Read fresh on every call so new/inactivated products show up without restarting (HU-19).
 */
router.get('/formulario', async (req, res) => {
  try {
    const proveedorRes = await pool.query(
      'SELECT id_proveedor, nombre_proveedor FROM proveedores ORDER BY id_proveedor ASC LIMIT 1'
    );
    const productosRes = await pool.query(
      `SELECT id_producto, codigo_producto, nombre_producto, tipo_producto, valor_compra
       FROM productos
       WHERE estado = 'Activo'
       ORDER BY nombre_producto ASC`
    );
    res.json({ proveedor: proveedorRes.rows[0] || null, productos: productosRes.rows });
  } catch (error) {
    console.error('Error loading restock form data:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * POST /api/v1/reabastecimientos
 * Body: { id_producto, cantidad, id_sede (Administrador only) }
 * - total = cantidad * valor_compra, computed here (CA-02, never trusted from the client)
 * - supplier = the single configured supplier (CA-03)
 * - stock is increased only in the target branch (CA-04)
 */
router.post('/', async (req, res) => {
  const idProducto = Number(req.body?.id_producto);
  const cantidad = parseQuantity(req.body?.cantidad);

  if (!Number.isInteger(idProducto) || idProducto <= 0) {
    return res.status(400).json({ error: 'Select a product' });
  }
  if (cantidad === null) {
    return res.status(400).json({ error: QUANTITY_ERROR });
  }
  if (cantidad > MAX_QUANTITY) {
    return res.status(400).json({ error: `Quantity cannot exceed ${MAX_QUANTITY}` });
  }

  const idSede = resolveSedeId(req);
  if (!idSede) {
    return res.status(400).json({
      error: req.user.rol === 'Administrador'
        ? 'Select a specific branch to register the restock'
        : 'Your user has no assigned branch'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sedeRes = await client.query(
      'SELECT id_sede, nombre_sede, estado FROM sedes WHERE id_sede = $1',
      [idSede]
    );
    const sede = sedeRes.rows[0];
    if (!sede) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Branch not found' });
    }
    if (sede.estado !== 'Activo') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The branch is inactive' });
    }

    const proveedorRes = await client.query(
      'SELECT id_proveedor, nombre_proveedor FROM proveedores ORDER BY id_proveedor ASC LIMIT 1'
    );
    const proveedor = proveedorRes.rows[0];
    if (!proveedor) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No supplier is registered. One must exist before restocking.' });
    }

    const productoRes = await client.query(
      'SELECT id_producto, codigo_producto, nombre_producto, valor_compra, estado FROM productos WHERE id_producto = $1',
      [idProducto]
    );
    const producto = productoRes.rows[0];
    if (!producto) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }
    if (producto.estado !== 'Activo') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The product is inactive and cannot be restocked' });
    }

    const histRes = await client.query(
      `INSERT INTO historial_reabastecimientos
         (id_sede, id_producto, id_usuario, id_proveedor, cantidad_ingresada, valor_compra_unitario, valor_total)
       VALUES ($1, $2, $3, $4, $5::int, $6::numeric, $5::int * $6::numeric)
       RETURNING id_reabastecimiento, cantidad_ingresada, valor_compra_unitario, valor_total, fecha_reabastecimiento`,
      [idSede, idProducto, req.user.id_usuario, proveedor.id_proveedor, cantidad, producto.valor_compra]
    );

    // Atomic upsert: safe under concurrent restocks and creates the row if the
    // branch had no inventory record for this product yet.
    const invRes = await client.query(
      `INSERT INTO inventario_sede (id_sede, id_producto, cantidad_disponible)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_sede, id_producto)
       DO UPDATE SET cantidad_disponible = inventario_sede.cantidad_disponible + EXCLUDED.cantidad_disponible
       RETURNING cantidad_disponible`,
      [idSede, idProducto, cantidad]
    );

    await client.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [
        req.user.id_usuario,
        'CREATE_RESTOCK',
        `Restock ${histRes.rows[0].id_reabastecimiento}: +${cantidad} of ${producto.codigo_producto} in branch ${sede.nombre_sede} (id ${idSede})`
      ]
    );

    await client.query('COMMIT');

    const h = histRes.rows[0];
    res.status(201).json({
      id_reabastecimiento: h.id_reabastecimiento,
      id_sede: idSede,
      nombre_sede: sede.nombre_sede,
      id_producto: producto.id_producto,
      nombre_producto: producto.nombre_producto,
      cantidad: h.cantidad_ingresada,
      valor_compra: h.valor_compra_unitario,
      valor_total: h.valor_total,
      proveedor: proveedor.nombre_proveedor,
      nueva_existencia: invRes.rows[0].cantidad_disponible,
      fecha: h.fecha_reabastecimiento
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error registering restock:', error);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/reabastecimientos/historico (HU-30)
 * Query params:
 *   - sedeId: id_sede or 'ALL' (Administrador only)
 *   - fechaInicio: 'YYYY-MM-DD' (optional)
 *   - fechaFin: 'YYYY-MM-DD' (optional)
 *   - orden: 'ASC' | 'DESC' (default 'DESC')
 * Returns restock audit list with date, product, quantity, unit cost, total value, branch and responsible user.
 * Note: CA-03: records cannot be edited or deleted (no PUT/DELETE endpoints exist).
 */
router.get('/historico', async (req, res) => {
  try {
    const { sedeId, fechaInicio, fechaFin, orden, busqueda } = req.query;

    const conditions = [];
    const params = [];

    // Branch filter: Cashier is restricted to their branch, Admin can filter by sede or see all
    if (req.user.rol !== 'Administrador') {
      params.push(req.user.id_sede);
      conditions.push(`h.id_sede = $${params.length}`);
    } else if (sedeId && sedeId !== 'ALL') {
      const parsedSede = Number(sedeId);
      if (Number.isInteger(parsedSede)) {
        params.push(parsedSede);
        conditions.push(`h.id_sede = $${params.length}`);
      }
    }

    if (fechaInicio) {
      params.push(`${fechaInicio} 00:00:00`);
      conditions.push(`h.fecha_reabastecimiento >= $${params.length}`);
    }

    if (fechaFin) {
      params.push(`${fechaFin} 23:59:59`);
      conditions.push(`h.fecha_reabastecimiento <= $${params.length}`);
    }

    if (busqueda && busqueda.trim() !== '') {
      params.push(`%${busqueda.trim()}%`);
      conditions.push(`(pr.nombre_producto ILIKE $${params.length} OR pr.codigo_producto ILIKE $${params.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderDirection = String(orden).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT h.id_reabastecimiento,
             h.fecha_reabastecimiento,
             pr.id_producto,
             pr.codigo_producto,
             pr.nombre_producto,
             h.cantidad_ingresada AS cantidad,
             COALESCE(h.valor_compra_unitario, pr.valor_compra)::FLOAT8 AS valor_compra_unitario,
             COALESCE(h.valor_total, h.cantidad_ingresada * pr.valor_compra)::FLOAT8 AS valor_total,
             s.id_sede,
             s.codigo_sede,
             s.nombre_sede,
             u.id_usuario,
             u.nombre_completo AS usuario_responsable,
             pv.nombre_proveedor
      FROM historial_reabastecimientos h
      JOIN productos pr ON pr.id_producto = h.id_producto
      JOIN sedes s ON s.id_sede = h.id_sede
      JOIN usuarios u ON u.id_usuario = h.id_usuario
      LEFT JOIN proveedores pv ON pv.id_proveedor = h.id_proveedor
      ${whereClause}
      ORDER BY h.fecha_reabastecimiento ${orderDirection}, h.id_reabastecimiento ${orderDirection}
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching restock history:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;