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
    console.error('Error obteniendo proveedor:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { nombre_proveedor, identificacion, contacto, telefono, correo } = req.body;

  if (!nombre_proveedor || !identificacion || !telefono || !correo) {
    return res.status(400).json({ error: 'Nombre, identificación, teléfono y correo son obligatorios' });
  }

  try {
    const exists = await pool.query('SELECT count(*) FROM proveedores');
    if (parseInt(exists.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Ya existe un proveedor registrado. Solo puede editarlo.' });
    }

    const result = await pool.query(
      'INSERT INTO proveedores (nombre_proveedor, identificacion, contacto, telefono, correo) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre_proveedor, identificacion, contacto || null, telefono, correo]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creando proveedor:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { nombre_proveedor, identificacion, contacto, telefono, correo } = req.body;

  if (!nombre_proveedor || !identificacion || !telefono || !correo) {
    return res.status(400).json({ error: 'Nombre, identificación, teléfono y correo son obligatorios' });
  }

  try {
    const result = await pool.query(
      'UPDATE proveedores SET nombre_proveedor = $1, identificacion = $2, contacto = $3, telefono = $4, correo = $5 WHERE id_proveedor = $6 RETURNING *',
      [nombre_proveedor, identificacion, contacto || null, telefono, correo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error editando proveedor:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;