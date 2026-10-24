import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();

router.use(requireAuth((text, params) => pool.query(text, params)));
router.use(requireRole(['Cajero', 'Administrador']));

// GET /api/v1/medios-pago - Active payment methods (HU-26 CA-01: Cash, Debit Card, Credit Card only)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_medio_pago, nombre_metodo
       FROM medios_pago
       WHERE estado = 'Activo'
       ORDER BY id_medio_pago ASC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing payment methods:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;