import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores ORDER BY id_proveedor ASC LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error getting supplier:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { nombre_proveedor, identificacion, contacto, telefono, correo } = req.body;

  if (!nombre_proveedor || !identificacion || !telefono || !correo) {
    return res.status(400).json({ error: 'Name, ID, phone and email are required' });
  }

  try {
    const exists = await pool.query('SELECT count(*) FROM proveedores');
    if (parseInt(exists.rows[0].count) > 0) {
      return res.status(400).json({ error: 'A supplier is already registered. You can only edit it.' });
    }

    const result = await pool.query(
      'INSERT INTO proveedores (nombre_proveedor, identificacion, contacto, telefono, correo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre_proveedor, identificacion, contacto || null, telefono, correo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { nombre_proveedor, identificacion, contacto, telefono, correo } = req.body;

  if (!nombre_proveedor || !identificacion || !telefono || !correo) {
    return res.status(400).json({ error: 'Name, ID, phone and email are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE proveedores SET nombre_proveedor = $1, identificacion = $2, contacto = $3, telefono = $4, correo = $5 WHERE id_proveedor = $6 RETURNING *',
      [nombre_proveedor, identificacion, contacto || null, telefono, correo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error editing supplier:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;