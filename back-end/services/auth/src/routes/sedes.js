// src/routes/sedes.js
import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '@lounge/common';

const router = express.Router();

// Middleware: only Administrador can access these routes
router.use(requireAuth((text, params) => pool.query(text, params)));
router.use(requireRole(['Administrador']));

/**
 * GET /api/v1/sedes
 * Returns all branches. Administrador sees all; other roles (should not reach here) would be filtered.
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_sede, codigo_sede, nombre_sede, direccion, estado FROM sedes ORDER BY id_sede`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing sedes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/sedes
 * Create a new branch.
 * Validations:
 *   - codigo_sede must be unique, otherwise return exact error message.
 *   - Estado defaults to 'Activo' if omitted.
 */
router.post('/', async (req, res) => {
  const { codigo_sede, nombre_sede, direccion, estado } = req.body;
  if (!codigo_sede || !nombre_sede || !direccion) {
    return res.status(400).json({ error: 'Datos requeridos faltan' });
  }
  try {
    const duplicate = await pool.query(
      'SELECT 1 FROM sedes WHERE codigo_sede = $1',
      [codigo_sede]
    );
    if (duplicate.rowCount > 0) {
      return res.status(400).json({ error: 'El código de sede ya se encuentra registrado' });
    }
    const result = await pool.query(
      `INSERT INTO sedes (codigo_sede, nombre_sede, direccion, estado)
       VALUES ($1, $2, $3, COALESCE($4, 'Activo'))
       RETURNING id_sede, codigo_sede, nombre_sede, direccion, estado`,
      [codigo_sede, nombre_sede, direccion, estado]
    );
    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_SEDE', `Created sede ${codigo_sede}`]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating sede:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/v1/sedes/:id
 * Edit a branch. Código cannot be changed.
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_sede, direccion, estado } = req.body;
  if (!nombre_sede || !direccion || !estado) {
    return res.status(400).json({ error: 'Campos obligatorios faltan' });
  }
  try {
    const result = await pool.query(
      `UPDATE sedes SET nombre_sede = $1, direccion = $2, estado = $3 WHERE id_sede = $4 RETURNING *`,
      [nombre_sede, direccion, estado, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sede no encontrada' });
    }
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'UPDATE_SEDE', `Updated sede ${id}`]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating sede:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/v1/sedes/:id
 * Logical deletion: set estado = 'Inactivo'.
 * Must reject if the sede has active references (users, mesas, inventory).
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Check for associated active records
    const assoc = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM usuarios WHERE id_sede = $1 AND estado = 'Activo') AS has_users,
            EXISTS (SELECT 1 FROM mesas WHERE id_sede = $1) AS has_mesas,
            EXISTS (SELECT 1 FROM inventario_sede WHERE id_sede = $1) AS has_inventario`,
      [id]
    );
    const { has_users, has_mesas, has_inventario } = assoc.rows[0];
    if (has_users || has_mesas || has_inventario) {
      return res.status(400).json({ error: 'No se puede desactivar la sede porque tiene registros asociados' });
    }
    const result = await pool.query(
      `UPDATE sedes SET estado = 'Inactivo' WHERE id_sede = $1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sede no encontrada' });
    }
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'DEACTIVATE_SEDE', `Deactivated sede ${id}`]
    );
    res.json({ message: 'Sede desactivada', sede: result.rows[0] });
  } catch (error) {
    console.error('Error deactivating sede:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
