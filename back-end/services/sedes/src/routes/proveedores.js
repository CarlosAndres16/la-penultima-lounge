import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM proveedores LIMIT 1');
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error obteniendo proveedor:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { nombre_proveedor, contacto, telefono } = req.body;
  try {
    const exists = await pool.query('SELECT count(*) FROM proveedores');
    if (parseInt(exists.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Ya existe un proveedor registrado. Solo puede editarlo.' });
    }

    const result = await pool.query(
      'INSERT INTO proveedores (nombre_proveedor, contacto, telefono) VALUES ($1, $2, $3) RETURNING *',
      [nombre_proveedor, contacto, telefono]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { nombre_proveedor, contacto, telefono } = req.body;
  try {
    const result = await pool.query(
      'UPDATE proveedores SET nombre_proveedor = $1, contacto = $2, telefono = $3 WHERE id_proveedor = $4 RETURNING *',
      [nombre_proveedor, contacto, telefono, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;

