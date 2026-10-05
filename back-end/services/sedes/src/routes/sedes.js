import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sedes ORDER BY id_sede ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error listando sedes:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/', requireRole(['Administrador']), async (req, res) => {
  const { nombre_sede, direccion } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO sedes (nombre_sede, direccion, estado) VALUES ($1, $2, $3) RETURNING *',
      [nombre_sede, direccion, 'Activo']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/:id', requireRole(['Administrador']), async (req, res) => {
  const { id } = req.params;
  const { nombre_sede, direccion, estado } = req.body;
  try {
    const result = await pool.query(
      'UPDATE sedes SET nombre_sede = $1, direccion = $2, estado = $3 WHERE id_sede = $4 RETURNING *',
      [nombre_sede, direccion, estado, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/:idSede/mesas', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mesas WHERE id_sede = $1 ORDER BY numero_mesa ASC', [req.params.idSede]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/:idSede/mesas', requireRole(['Administrador']), async (req, res) => {
  const { numero_mesa } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO mesas (id_sede, numero_mesa, estado_actual) VALUES ($1, $2, $3) RETURNING *',
      [req.params.idSede, numero_mesa, 'Disponible']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;

