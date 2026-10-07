// src/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken'; // Simple JWT for demo
import pool from '../db.js';
import { requireAuth } from '@lounge/common';

const router = express.Router();

// Secret for JWT – in real app use env variable
const JWT_SECRET = process.env.JWT_SECRET || 'very_secret_key';

/**
 * POST /api/v1/auth/login
 * Expected body: { username, password }
 * Responses:
 *   200 – { token, user: { id_usuario, username, nombre_rol, id_sede, estado } }
 *   400 – missing fields
 *   401 – "Usuario o contraseña incorrectos"
 *   403 – "Cuenta bloqueada tras 3 intentos fallidos. Contacte a un Administrador"
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const userResult = await pool.query(
      `SELECT u.*, r.nombre_rol FROM usuarios u
       JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.username = $1`,
      [username]
    );
    const user = userResult.rows[0];
    if (!user) {
      // Do not reveal existence
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Check if account is blocked
    if (user.estado === 'Bloqueado') {
      return res
        .status(403)
        .json({ error: 'Cuenta bloqueada tras 3 intentos fallidos. Contacte a un Administrador' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      // Increment failed attempts
      const newFails = (user.intentos_fallidos || 0) + 1;
      const newState = newFails >= 3 ? 'Bloqueado' : user.estado;
      await pool.query(
        `UPDATE usuarios SET intentos_fallidos = $1, estado = $2 WHERE id_usuario = $3`,
        [newFails, newState, user.id_usuario]
      );
      const msg = newState === 'Bloqueado'
        ? 'Cuenta bloqueada tras 3 intentos fallidos. Contacte a un Administrador'
        : 'Usuario o contraseña incorrectos';
      const status = newState === 'Bloqueado' ? 403 : 401;
      return res.status(status).json({ error: msg });
    }

    // Successful login – reset attempts, generate token, enforce single session
    await pool.query(
      `UPDATE usuarios SET intentos_fallidos = 0, token_sesion_activa = $1 WHERE id_usuario = $2`,
      [null, user.id_usuario]
    ); // clear any previous token first

    const tokenPayload = {
      sub: user.id_usuario,
      role: user.nombre_rol,
      sede: user.id_sede,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
    // Store active token (single session)
    await pool.query(
      `UPDATE usuarios SET token_sesion_activa = $1 WHERE id_usuario = $2`,
      [token, user.id_usuario]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (usuario_id, tipo_operacion, detalles) VALUES ($1, $2, $3)`,
      [user.id_usuario, 'LOGIN_SUCCESS', `User ${username} logged in`]
    );

    const responseUser = {
      id_usuario: user.id_usuario,
      username: user.username,
      nombre_rol: user.nombre_rol,
      id_sede: user.id_sede,
      estado: user.estado,
    };
    return res.json({ token, user: responseUser });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Example protected endpoint to test token validation
router.get('/me', requireAuth((text, params) => pool.query(text, params)), async (req, res) => {
  // req.user populated by requireAuth middleware
  res.json({ user: req.user });
});

export default router;

