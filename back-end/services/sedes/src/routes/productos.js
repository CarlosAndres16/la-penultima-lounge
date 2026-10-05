import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { sedeId, search, estado } = req.query;

  try {
    const params = [];
    const whereClauses = [];
    // Base SELECT
    let query = `
      SELECT p.id_producto, p.nombre_producto, p.precio_venta, p.estado,
             COALESCE(pr.nombre_proveedor, 'Sin proveedor') AS nombre_proveedor,
             COALESCE(SUM(i.cantidad_disponible), 0)::INT AS stock_total
      FROM productos p
      LEFT JOIN proveedores pr ON p.id_proveedor = pr.id_proveedor
      LEFT JOIN inventario_sede i ON p.id_producto = i.id_producto
    `;

    if (estado) {
      params.push(estado);
      whereClauses.push(`p.estado = $${params.length}`);
    }
    if (search && search.trim() !== '') {
      params.push(`%${search}%`);
      whereClauses.push(`(p.nombre_producto ILIKE $${params.length} OR p.id_producto::text ILIKE $${params.length})`);
    }
    if (sedeId && sedeId !== 'ALL') {
      params.push(sedeId);
      whereClauses.push(`i.id_sede = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += `
      GROUP BY p.id_producto, p.nombre_producto, p.precio_venta, p.estado, pr.nombre_proveedor
      ORDER BY p.id_producto DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listando productos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { id_proveedor, nombre_producto, precio_venta } = req.body;
  
  try {
    await pool.query('BEGIN');
    
    // 1. Insertar el producto
    const result = await pool.query(
      'INSERT INTO productos (id_proveedor, nombre_producto, precio_venta, estado) VALUES ($1, $2, $3, $4) RETURNING *',
      [id_proveedor, nombre_producto, precio_venta, 'Activo']
    );
    const newProduct = result.rows[0];

    // 2. HU-13: "existencia inicial en cero (0) para todas las sedes"
    const sedesRes = await pool.query('SELECT id_sede FROM sedes');
    for (let sede of sedesRes.rows) {
      await pool.query(
        'INSERT INTO inventario_sede (id_sede, id_producto, cantidad_disponible) VALUES ($1, $2, 0)',
        [sede.id_sede, newProduct.id_producto]
      );
    }

    // 3. Auditoría (HU-14 indica llevar audit, lo agregamos aquí también)
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_PRODUCT', `Creado producto ${nombre_producto}`]
    ).catch(() => {}); // catch por si audit_logs no existe

    await pool.query('COMMIT');
    res.status(201).json(newProduct);
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { id_proveedor, nombre_producto, precio_venta } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE productos SET id_proveedor = $1, nombre_producto = $2, precio_venta = $3 WHERE id_producto = $4 RETURNING *',
      [id_proveedor, nombre_producto, precio_venta, id]
    );

    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'UPDATE_PRODUCT', `Editado producto ${id}`]
    ).catch(() => {});

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error editando producto:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.patch('/:id/status', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // 'Activo' o 'Inactivo'

  try {
    await pool.query('UPDATE productos SET estado = $1 WHERE id_producto = $2', [estado, id]);
    res.json({ message: `Producto marcado como ${estado}` });
  } catch (error) {
    console.error('Error cambiando estado producto:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;

