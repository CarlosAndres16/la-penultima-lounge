import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, requireSameSede } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);

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

router.post('/', adminOnly, async (req, res) => {
  const { codigo_sede, nombre_sede, direccion } = req.body;

  if (!codigo_sede || !nombre_sede || !direccion) {
    return res.status(400).json({ error: 'Código, nombre y dirección son obligatorios' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO sedes (codigo_sede, nombre_sede, direccion, estado) VALUES ($1, $2, $3, $4) RETURNING *',
      [codigo_sede, nombre_sede, direccion, 'Activo']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El código de sede ya se encuentra registrado' });
    }
    console.error('Error creando sede:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { nombre_sede, direccion, estado } = req.body;

  if (!nombre_sede || !direccion || !estado) {
    return res.status(400).json({ error: 'Nombre, dirección y estado son obligatorios' });
  }

  try {
    const result = await pool.query(
      'UPDATE sedes SET nombre_sede = $1, direccion = $2, estado = $3 WHERE id_sede = $4 RETURNING *',
      [nombre_sede, direccion, estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sede no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error editando sede:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/:idSede/mesas', requireSameSede, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mesas WHERE id_sede = $1 ORDER BY numero_mesa ASC', [req.params.idSede]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/:idSede/mesas', adminOnly, async (req, res) => {
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