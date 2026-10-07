// src/routes/mesas.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();

// Only Administrador can manage mesas; Cajero can read (handled elsewhere)
router.use(requireAuth((text, params) => pool.query(text, params)));
router.use(requireRole(['Administrador']));

/**
 * GET /api/v1/mesas?sedesId=... (optional)
 * Returns tables, filtered by branch if provided.
 */
router.get('/', async (req, res) => {
  const { sedeId } = req.query;
  try {
    const result = await pool.query(
      `SELECT m.id_mesa, m.numero_mesa, m.estado_actual, s.id_sede, s.codigo_sede
       FROM mesas m
       JOIN sedes s ON m.id_sede = s.id_sede
       ${sedeId ? 'WHERE s.id_sede = $1' : ''}`,
      sedeId ? [sedeId] : []
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing mesas:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/mesas
 * Create a new table for a branch.
 * Body: { id_sede, numero_mesa }
 * Validation: numero_mesa unique per sede; initial estado "Libre".
 */
router.post('/', async (req, res) => {
  const { id_sede, numero_mesa } = req.body;
  if (!id_sede || !numero_mesa) {
    return res.status(400).json({ error: 'Datos requeridos faltan' });
  }
  try {
    const duplicate = await pool.query(
      'SELECT 1 FROM mesas WHERE id_sede = $1 AND numero_mesa = $2',
      [id_sede, numero_mesa]
    );
    if (duplicate.rowCount > 0) {
      return res.status(400).json({ error: 'Ya existe una mesa con ese número en la sede' });
    }
    const result = await pool.query(
      `INSERT INTO mesas (id_sede, numero_mesa, estado_actual)
       VALUES ($1, $2, 'Libre') RETURNING *`,
      [id_sede, numero_mesa]
    );
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_MESA', `Created mesa ${numero_mesa} for sede ${id_sede}`]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating mesa:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/v1/mesas/:id
 * Logical deletion: set estado_actual = 'Inactivo'.
 * Must reject if there are open orders (pedido_estado = 'Abierto') for this mesa.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const openOrders = await pool.query(
      `SELECT 1 FROM pedidos WHERE id_mesa = $1 AND estado = 'Abierto' LIMIT 1`,
      [id]
    );
    if (openOrders.rowCount > 0) {
      return res.status(400).json({ error: 'No es posible eliminar una mesa con pedidos abiertos' });
    }
    const result = await pool.query(
      `UPDATE mesas SET estado_actual = 'Inactivo' WHERE id_mesa = $1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'DELETE_MESA', `Deleted mesa ${id}`]
    );
    res.json({ message: 'Mesa eliminada', mesa: result.rows[0] });
  } catch (error) {
    console.error('Error deleting mesa:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
