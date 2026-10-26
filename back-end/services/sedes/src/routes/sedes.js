import express from 'express';
import pool from '../db.js';
import { requireAuth, requireRole, requireSameSede } from '@lounge/common';

const router = express.Router();
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);
const tableStatusRoles = requireRole(['Mesero', 'Cajero', 'Administrador']);
const MANUAL_TABLE_STATES = ['Libre', 'Reservada'];

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sedes ORDER BY id_sede ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing branches:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.post('/', adminOnly, async (req, res) => {
  const { codigo_sede, nombre_sede, direccion } = req.body;

  if (!codigo_sede || !nombre_sede || !direccion) {
    return res.status(400).json({ error: 'Code, name and address are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO sedes (codigo_sede, nombre_sede, direccion, estado) VALUES ($1, $2, $3, $4) RETURNING *',
      [codigo_sede, nombre_sede, direccion, 'Activo']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Branch code is already registered' });
    }
    console.error('Error creating branch:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { nombre_sede, direccion, estado } = req.body;

  if (!nombre_sede || !direccion || !estado) {
    return res.status(400).json({ error: 'Name, address and status are required' });
  }

  try {
    const result = await pool.query(
      'UPDATE sedes SET nombre_sede = $1, direccion = $2, estado = $3 WHERE id_sede = $4 RETURNING *',
      [nombre_sede, direccion, estado, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error editing branch:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/v1/sedes/:idSede/mesas - List tables of a branch (HU-18 CA-04: independent per branch)
router.get('/:idSede/mesas', requireSameSede, async (req, res) => {
  const idSede = Number(req.params.idSede);

  if (!Number.isInteger(idSede)) {
    return res.status(400).json({ error: 'Invalid branch id' });
  }

  try {
    const result = await pool.query(
      `SELECT id_mesa, id_sede, numero_mesa, estado_actual
       FROM mesas
       WHERE id_sede = $1
       ORDER BY NULLIF(regexp_replace(numero_mesa, '\\D', '', 'g'), '')::INT NULLS LAST, numero_mesa ASC`,
      [idSede]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing tables:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/v1/sedes/:idSede/mesas - Create table (HU-18 CA-01 and CA-02)
router.post('/:idSede/mesas', adminOnly, async (req, res) => {
  const idSede = Number(req.params.idSede);
  const numeroMesa = String(req.body.numero_mesa ?? '').trim();

  if (!Number.isInteger(idSede)) {
    return res.status(400).json({ error: 'Invalid branch id' });
  }
  if (!numeroMesa) {
    return res.status(400).json({ error: 'Table number is required' });
  }
  if (numeroMesa.length > 20) {
    return res.status(400).json({ error: 'Table number must be 20 characters or fewer' });
  }

  try {
    const sedeRes = await pool.query('SELECT nombre_sede FROM sedes WHERE id_sede = $1', [idSede]);
    if (sedeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    const result = await pool.query(
      'INSERT INTO mesas (id_sede, numero_mesa, estado_actual) VALUES ($1, $2, $3) RETURNING *',
      [idSede, numeroMesa, 'Libre']
    );

    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_TABLE', `Created table ${numeroMesa} in branch ${sedeRes.rows[0].nombre_sede} (id ${idSede})`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Table number already exists in this branch' });
    }
    console.error('Error creating table:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// PATCH /api/v1/sedes/:idSede/mesas/:idMesa/estado - Manually reserve a free table or release a reserved one
// Body: { estado: 'Reservada' | 'Libre' }. 'Ocupada' is only set by the order flow (HU-22 / HU-28).
router.patch('/:idSede/mesas/:idMesa/estado', requireSameSede, tableStatusRoles, async (req, res) => {
  const idSede = Number(req.params.idSede);
  const idMesa = Number(req.params.idMesa);
  const nuevoEstado = req.body?.estado;

  if (!Number.isInteger(idSede) || !Number.isInteger(idMesa)) {
    return res.status(400).json({ error: 'Invalid branch or table id' });
  }
  if (!MANUAL_TABLE_STATES.includes(nuevoEstado)) {
    return res.status(400).json({ error: 'Status must be Libre or Reservada' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the table row so it cannot be taken by an order while its status is being changed
    const mesaRes = await client.query(
      'SELECT id_mesa, numero_mesa, estado_actual FROM mesas WHERE id_mesa = $1 AND id_sede = $2 FOR UPDATE',
      [idMesa, idSede]
    );
    const mesa = mesaRes.rows[0];

    if (!mesa) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Table not found' });
    }
    if (mesa.estado_actual === 'Ocupada') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'The table is occupied and its status cannot be changed manually' });
    }
    if (mesa.estado_actual === nuevoEstado) {
      // Another user already made the same change: nothing to do
      await client.query('ROLLBACK');
      return res.json(mesa);
    }

    const updated = await client.query(
      'UPDATE mesas SET estado_actual = $1 WHERE id_mesa = $2 RETURNING id_mesa, id_sede, numero_mesa, estado_actual',
      [nuevoEstado, idMesa]
    );

    await client.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'UPDATE_TABLE_STATUS', `Table ${mesa.numero_mesa} (branch id ${idSede}): ${mesa.estado_actual} -> ${nuevoEstado}`]
    );

    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error changing table status:', error);
    res.status(500).json({ error: 'Internal error' });
  } finally {
    client.release();
  }
});

// DELETE /api/v1/sedes/:idSede/mesas/:idMesa - Delete table (HU-18 CA-03)
router.delete('/:idSede/mesas/:idMesa', adminOnly, async (req, res) => {
  const idSede = Number(req.params.idSede);
  const idMesa = Number(req.params.idMesa);

  if (!Number.isInteger(idSede) || !Number.isInteger(idMesa)) {
    return res.status(400).json({ error: 'Invalid branch or table id' });
  }

  try {
    const mesaRes = await pool.query(
      'SELECT id_mesa, numero_mesa FROM mesas WHERE id_mesa = $1 AND id_sede = $2',
      [idMesa, idSede]
    );
    const mesa = mesaRes.rows[0];

    if (!mesa) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const abiertos = await pool.query(
      `SELECT 1 FROM pedidos WHERE id_mesa = $1 AND estado = 'Abierto' LIMIT 1`,
      [idMesa]
    );
    if (abiertos.rows.length > 0) {
      return res.status(400).json({ error: 'It is not possible to delete a table with open orders' });
    }

    await pool.query('DELETE FROM mesas WHERE id_mesa = $1', [idMesa]);

    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'DELETE_TABLE', `Deleted table ${mesa.numero_mesa} from branch id ${idSede}`]
    );

    res.json({ message: 'Table deleted' });
  } catch (error) {
    // Table has closed orders (history): the foreign key prevents deletion
    if (error.code === '23503') {
      return res.status(400).json({ error: 'It is not possible to delete a table that has order history' });
    }
    console.error('Error deleting table:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;