import express from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '@lounge/common';
import pool from '../db.js';

const router = express.Router();

const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);

router.use(authMiddleware);
router.use(adminOnly);

const isValidPassword = (password) => {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

// GET /api/v1/users - List users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id_usuario, u.codigo_usuario, u.nombre_completo, u.username, u.estado, u.intentos_fallidos,
             r.id_rol, r.nombre_rol, s.id_sede, s.nombre_sede
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN sedes s ON u.id_sede = s.id_sede
      ORDER BY u.id_usuario DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/users - Create user
router.post('/', async (req, res) => {
  const { nombre_completo, username, password, id_rol, id_sede, estado } = req.body;

  // Generate a unique user code server‑side
  const codigo_usuario = `USR-${Date.now()}`;

  if (!nombre_completo || !username || !password || !id_rol || !id_sede) {
    return res.status(400).json({ error: 'Required fields are missing' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, una letra y un número' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (codigo_usuario, nombre_completo, username, password_hash, id_rol, id_sede, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_usuario, codigo_usuario, username`,
      [codigo_usuario, nombre_completo, username, hash, id_rol, id_sede, estado || 'Activo']
    );

    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_USER', `Created user ${username} (${codigo_usuario})`]
    );

    res.status(201).json({ message: 'User created', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'usuarios_codigo_usuario_key') {
        return res.status(400).json({ error: 'User code already exists' });
      }
      // Duplicate username
      return res.status(400).json({ error: 'El nombre de usuario ya se encuentra en uso' });
    }
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/users/:id - Edit user
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, id_rol, id_sede, estado, password } = req.body;

  if (!nombre_completo || !id_rol || !id_sede || !estado) {
    return res.status(400).json({ error: 'Name, branch, role and status are required' });
  }

  try {
    const actualRes = await pool.query(
      'SELECT id_rol, id_sede, estado FROM usuarios WHERE id_usuario = $1',
      [id]
    );
    const actual = actualRes.rows[0];

    if (!actual) {
      return res.status(404).json({ error: 'User not found' });
    }

    let query = 'UPDATE usuarios SET nombre_completo = $1, id_rol = $2, id_sede = $3, estado = $4';
    let params = [nombre_completo, id_rol, id_sede, estado];
    let queryIndex = 5;

    if (password) {
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: 'Password does not meet the security policy' });
      }
      const hash = await bcrypt.hash(password, 10);
      query += `, password_hash = $${queryIndex}`;
      params.push(hash);
      queryIndex++;
    }

    const sedeChanged = String(actual.id_sede) !== String(id_sede);
    const rolChanged = String(actual.id_rol) !== String(id_rol);
    const estadoChanged = actual.estado !== estado;
    const debeCerrarSesion = sedeChanged || rolChanged || estadoChanged;

    if (debeCerrarSesion) {
      query += ', token_sesion_activa = NULL';
    }

    query += ` WHERE id_usuario = $${queryIndex}`;
    params.push(id);

    await pool.query(query, params);

    const cambios = [];
    if (sedeChanged) cambios.push(`branch: ${actual.id_sede} -> ${id_sede}`);
    if (rolChanged) cambios.push(`role: ${actual.id_rol} -> ${id_rol}`);
    if (estadoChanged) cambios.push(`status: ${actual.estado} -> ${estado}`);

    if (cambios.length > 0) {
      await pool.query(
        `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
        [req.user.id_usuario, 'UPDATE_USER', `User ${id}: ${cambios.join(', ')}`]
      );
    }

    res.json({ message: 'User updated successfully', sesionCerrada: debeCerrarSesion });
  } catch (error) {
    console.error('Error editing user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/users/:id/status - Change status
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  try {
    if (estado === 'Inactivo' && parseInt(id) === req.user.id_usuario) {
      const adminCount = await pool.query(
        `SELECT count(*) FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
         WHERE r.nombre_rol = 'Administrador' AND u.estado = 'Activo'`
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'You cannot deactivate yourself because you are the only active Administrator' });
      }
    }

    let updateQuery = 'UPDATE usuarios SET estado = $1, intentos_fallidos = 0';
    let queryParams = [estado, id];

    if (estado === 'Inactivo') {
      updateQuery += ', token_sesion_activa = NULL';
    }

    updateQuery += ' WHERE id_usuario = $2';

    await pool.query(updateQuery, queryParams);

    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CHANGE_USER_STATUS', `User ${id} marked as ${estado}`]
    );

    res.json({ message: `User marked as ${estado}` });
  } catch (error) {
    console.error('Error changing status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;