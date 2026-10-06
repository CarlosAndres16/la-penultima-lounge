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

// GET /api/v1/users - Listar usuarios
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
    console.error('Error listando usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/v1/users - Crear usuario
router.post('/', async (req, res) => {
  const { codigo_usuario, nombre_completo, username, password, id_rol, id_sede, estado } = req.body;

  if (!codigo_usuario || !nombre_completo || !username || !password || !id_rol || !id_sede) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres, al menos 1 letra y 1 número' });
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
      [req.user.id_usuario, 'CREATE_USER', `Creado usuario ${username} (${codigo_usuario})`]
    );

    res.status(201).json({ message: 'Usuario creado', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'usuarios_codigo_usuario_key') {
        return res.status(400).json({ error: 'El código de usuario ya existe' });
      }
      return res.status(400).json({ error: 'El nombre de usuario ya se encuentra en uso' });
    }
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/v1/users/:id - Editar usuario
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, id_rol, id_sede, estado, password } = req.body;

  if (!nombre_completo || !id_rol || !id_sede || !estado) {
    return res.status(400).json({ error: 'Nombre, sede, perfil y estado son obligatorios' });
  }

  try {
    const actualRes = await pool.query(
      'SELECT id_rol, id_sede, estado FROM usuarios WHERE id_usuario = $1',
      [id]
    );
    const actual = actualRes.rows[0];

    if (!actual) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    let query = 'UPDATE usuarios SET nombre_completo = $1, id_rol = $2, id_sede = $3, estado = $4';
    let params = [nombre_completo, id_rol, id_sede, estado];
    let queryIndex = 5;

    if (password) {
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: 'La contraseña no cumple con las políticas' });
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
    if (sedeChanged) cambios.push(`sede: ${actual.id_sede} -> ${id_sede}`);
    if (rolChanged) cambios.push(`perfil: ${actual.id_rol} -> ${id_rol}`);
    if (estadoChanged) cambios.push(`estado: ${actual.estado} -> ${estado}`);

    if (cambios.length > 0) {
      await pool.query(
        `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
        [req.user.id_usuario, 'UPDATE_USER', `Usuario ${id}: ${cambios.join(', ')}`]
      );
    }

    res.json({ message: 'Usuario actualizado correctamente', sesionCerrada: debeCerrarSesion });
  } catch (error) {
    console.error('Error editando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/v1/users/:id/status - Cambiar estado
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
        return res.status(400).json({ error: 'No puedes inactivarte porque eres el único Administrador activo' });
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
      [req.user.id_usuario, 'CHANGE_USER_STATUS', `Usuario ${id} marcado como ${estado}`]
    );

    res.json({ message: `Usuario marcado como ${estado}` });
  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;