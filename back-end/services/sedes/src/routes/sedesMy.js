import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();

// Middleware: ensure the user is authenticated
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
// Only Cajero role can access this endpoint
const cajeroOnly = requireRole(['Cajero']);

router.use(authMiddleware);
router.use(cajeroOnly);

// GET /api/v1/sedes/mia - Return the sede assigned to the logged‑in Cajero
router.get('/', async (req, res) => {
  try {
    // req.user should contain id_sede (the sede assigned to the user)
    const userSedeId = req.user.id_sede;
    if (!userSedeId) {
      return res.status(400).json({ error: 'Usuario no tiene sede asignada' });
    }
    const result = await pool.query('SELECT * FROM sedes WHERE id_sede = $1', [userSedeId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sede no encontrada' });
    }
    // Return a single‑element array to keep UI shape consistent
    res.json([result.rows[0]]);
  } catch (error) {
    console.error('Error fetching cajero sede:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
