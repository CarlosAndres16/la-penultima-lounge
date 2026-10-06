import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, requireSameSede } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);

router.use(authMiddleware);

router.get('/', requireSameSede, async (req, res) => {
  const { sedeId, search, estado, tipo } = req.query;

  try {
    const params = [];
    const whereClauses = [];
    let query = `
      SELECT p.id_producto, p.codigo_producto, p.nombre_producto, p.tipo_producto,
             p.valor_compra, p.precio_venta, p.estado,
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
    if (tipo) {
      params.push(tipo);
      whereClauses.push(`p.tipo_producto = $${params.length}`);
    }
    if (search && search.trim() !== '') {
      params.push(`%${search}%`);
      whereClauses.push(`(p.nombre_producto ILIKE $${params.length} OR p.codigo_producto ILIKE $${params.length})`);
    }
    if (sedeId && sedeId !== 'ALL') {
      params.push(sedeId);
      whereClauses.push(`i.id_sede = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += `
      GROUP BY p.id_producto, p.codigo_producto, p.nombre_producto, p.tipo_producto, p.valor_compra, p.precio_venta, p.estado, pr.nombre_proveedor
      ORDER BY p.id_producto DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listando productos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { codigo_producto, id_proveedor, nombre_producto, tipo_producto, valor_compra, precio_venta, confirmar } = req.body;

  if (!codigo_producto || !id_proveedor || !nombre_producto || !tipo_producto || valor_compra == null || precio_venta == null) {
    return res.status(400).json({ error: 'Este campo es obligatorio' });
  }

  if (Number(precio_venta) <= Number(valor_compra) && !confirmar) {
    return res.status(409).json({
      warning: true,
      error: 'El valor de venta es menor o igual al valor de compra. ¿Desea continuar?'
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO productos (codigo_producto, id_proveedor, nombre_producto, tipo_producto, valor_compra, precio_venta, estado) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [codigo_producto, id_proveedor, nombre_producto, tipo_producto, valor_compra, precio_venta, 'Activo']
    );
    const newProduct = result.rows[0];

    const sedesRes = await client.query('SELECT id_sede FROM sedes');
    for (const sede of sedesRes.rows) {
      await client.query(
        'INSERT INTO inventario_sede (id_sede, id_producto, cantidad_disponible) VALUES ($1, $2, 0)',
        [sede.id_sede, newProduct.id_producto]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_PRODUCT', `Creado producto ${nombre_producto} (${codigo_producto})`]
    );

    await client.query('COMMIT');
    res.status(201).json(newProduct);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El código de producto ya existe' });
    }
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error interno' });
  } finally {
    client.release();
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { id_proveedor, nombre_producto, tipo_producto, valor_compra, precio_venta } = req.body;

  if (!id_proveedor || !nombre_producto || !tipo_producto || valor_compra == null || precio_venta == null) {
    return res.status(400).json({ error: 'Este campo es obligatorio' });
  }

  try {
    const actualRes = await pool.query('SELECT * FROM productos WHERE id_producto = $1', [id]);
    const actual = actualRes.rows[0];

    if (!actual) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const result = await pool.query(
      'UPDATE productos SET id_proveedor = $1, nombre_producto = $2, tipo_producto = $3, valor_compra = $4, precio_venta = $5 WHERE id_producto = $6 RETURNING *',
      [id_proveedor, nombre_producto, tipo_producto, valor_compra, precio_venta, id]
    );

    const cambios = [];
    if (Number(actual.valor_compra) !== Number(valor_compra)) {
      cambios.push(`valor de compra: $${actual.valor_compra} -> $${valor_compra}`);
    }
    if (Number(actual.precio_venta) !== Number(precio_venta)) {
      cambios.push(`valor de venta: $${actual.precio_venta} -> $${precio_venta}`);
    }
    if (actual.id_proveedor !== id_proveedor) {
      cambios.push('proveedor actualizado');
    }
    if (actual.nombre_producto !== nombre_producto) {
      cambios.push(`nombre: ${actual.nombre_producto} -> ${nombre_producto}`);
    }

    if (cambios.length > 0) {
      await pool.query(
        `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
        [req.user.id_usuario, 'UPDATE_PRODUCT', `Producto ${id}: ${cambios.join(', ')}`]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error editando producto:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.patch('/:id/status', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    await pool.query('UPDATE productos SET estado = $1 WHERE id_producto = $2', [estado, id]);

    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CHANGE_PRODUCT_STATUS', `Producto ${id} marcado como ${estado}`]
    );

    res.json({ message: `Producto marcado como ${estado}` });
  } catch (error) {
    console.error('Error cambiando estado producto:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;