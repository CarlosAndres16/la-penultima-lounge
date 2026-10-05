import express from 'express';
import bcrypt from 'bcrypt';
import { requireAuth, requireRole } from '@lounge/common';
import pool from '../db.js';

const router = express.Router();

// Helper para auth middleware
const authMiddleware = requireAuth((text, params) => pool.query(text, params));
const adminOnly = requireRole(['Administrador']);

// Aplicar middleware a todas las rutas de este router
router.use(authMiddleware);
router.use(adminOnly);

// Validación de contraseña
const isValidPassword = (password) => {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
};

// GET /api/v1/users - Listar usuarios
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id_usuario, u.nombre_completo, u.username, u.estado, u.intentos_fallidos,
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
  const { nombre_completo, username, password, id_rol, id_sede } = req.body;

  if (!nombre_completo || !username || !password || !id_rol) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!isValidPassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener mínimo 8 caracteres, al menos 1 letra y 1 número' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO usuarios (nombre_completo, username, password_hash, id_rol, id_sede, estado)
       VALUES ($1, $2, $3, $4, $5, 'Activo') RETURNING id_usuario, username`,
      [nombre_completo, username, hash, id_rol, id_sede || null]
    );

    // Auditoría
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [req.user.id_usuario, 'CREATE_USER', `Creado usuario ${username}`]
    ).catch(err => console.error("Error audit (si no existe la tabla aún):", err.message));

    res.status(201).json({ message: 'Usuario creado', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'El nombre de usuario ya existe' });
    }
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/v1/users/:id - Editar usuario
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre_completo, id_rol, id_sede, password } = req.body;

  try {
    let query = 'UPDATE usuarios SET nombre_completo = $1, id_rol = $2, id_sede = $3';
    let params = [nombre_completo, id_rol, id_sede || null];
    let queryIndex = 4;

    if (password) {
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: 'La contraseña no cumple con las políticas' });
      }
      const hash = await bcrypt.hash(password, 10);
      query += `, password_hash = $${queryIndex}`;
      params.push(hash);
      queryIndex++;
    }

    query += ` WHERE id_usuario = $${queryIndex}`;
    params.push(id);

    await pool.query(query, params);
    
    // HU-09 y HU-02: Al cambiar sede o rol, si el usuario está conectado, deberíamos idealmente 
    // invalidar su sesión para que tome los nuevos permisos.
    await pool.query('UPDATE usuarios SET token_sesion_activa = NULL WHERE id_usuario = $1', [id]);

    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (error) {
    console.error('Error editando usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PATCH /api/v1/users/:id/status - Cambiar estado
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // 'Activo' o 'Inactivo'

  try {
    if (estado === 'Inactivo' && parseInt(id) === req.user.id_usuario) {
      // Verificar si es el único admin
      const adminCount = await pool.query(
        `SELECT count(*) FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol 
         WHERE r.nombre_rol = 'Administrador' AND u.estado = 'Activo'`
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'No puedes inactivarte porque eres el único Administrador activo' });
      }
    }

    // HU-11: Al inactivar se invalida inmediatamente cualquier sesión y si se activa (HU-10) se reinician intentos fallidos.
    const intentos = estado === 'Activo' ? 0 : 0;
    const token = estado === 'Activo' ? undefined : null; // Si es inactivo, invalidamos token.

    let updateQuery = 'UPDATE usuarios SET estado = $1, intentos_fallidos = $2';
    let queryParams = [estado, intentos, id];

    if (estado === 'Inactivo') {
      updateQuery += ', token_sesion_activa = NULL';
    }

    updateQuery += ' WHERE id_usuario = $3';
    
    await pool.query(updateQuery, queryParams);

    res.json({ message: `Usuario marcado como ${estado}` });
  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
