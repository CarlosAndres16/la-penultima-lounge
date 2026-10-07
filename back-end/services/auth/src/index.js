import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import pool from './db.js';
import { requireAuth } from '@lounge/common';
import usersRouter from './routes/users.js';
const app = express();
app.use(cors());
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

app.use('/api/v1/users', usersRouter);

app.get('/api/v1/auth/me', requireAuth((text, params) => pool.query(text, params)), (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/v1/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const result = await pool.query(`
      SELECT u.*, r.nombre_rol as rol, s.nombre_sede as sede_nombre
      FROM usuarios u
      JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN sedes s ON u.id_sede = s.id_sede
      WHERE u.username = $1
    `, [username]);

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      const nuevosIntentos = (user.intentos_fallidos || 0) + 1;
      const bloquear = nuevosIntentos >= 3;
      const nuevoEstado = bloquear ? 'Bloqueado' : user.estado;
      await pool.query(
        'UPDATE usuarios SET intentos_fallidos = $1, estado = $2 WHERE id_usuario = $3',
        [nuevosIntentos, nuevoEstado, user.id_usuario]
      );
      const mensaje = bloquear
        ? 'Account blocked after 3 failed attempts. Please contact an Administrator.'
        : 'Invalid username or password';
      const codigo = bloquear ? 403 : 401;
      return res.status(codigo).json({ error: mensaje });
    }

    // Verificar si ya hay una sesión activa para este usuario
    if (user.token_sesion_activa) {
      // Decodificar el token para comprobar su expiración
      const decoded = jwt.decode(user.token_sesion_activa);
      const now = Date.now();
      if (decoded && decoded.exp * 1000 > now) {
        // Token todavía válido → sesión activa
        return res.status(403).json({ error: 'User already has an active session. Please logout first.' });
      } else {
        // Token expirado o inválido → limpiar la columna
        await pool.query('UPDATE usuarios SET token_sesion_activa = NULL WHERE id_usuario = $1', [user.id_usuario]);
      }
    }

    // Verificar si la cuenta está bloqueada
    if (user.estado === 'Bloqueado') {
      return res.status(403).json({
        error: 'Account blocked after 3 failed attempts. Please contact an Administrator.'
      });
    }


    if (user.estado === 'Inactivo') {
      return res.status(403).json({ error: 'Inactive user. Please contact an Administrator.' });
    }

    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        username: user.username,
        rol: user.rol,
        id_sede: user.id_sede
      },
      process.env.JWT_SECRET || 'secret_fallback',
      { expiresIn: '8h' }
    );

    await pool.query(
      'UPDATE usuarios SET intentos_fallidos = 0, token_sesion_activa = $1 WHERE id_usuario = $2',
      [token, user.id_usuario]
    );

    const { password_hash, token_sesion_activa, ...safeUser } = user;

    res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });

  } catch (error) {
    console.error('Error in /login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => console.log(`auth listening on port ${PORT}`));

// Logout endpoint: invalidate active session token
// Logout endpoint: invalidate active session token without DB fetch
// Logout endpoint: invalidate active session token (supports token or username fallback)
app.post('/api/v1/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    // ---- Fallback when no Authorization header (use username in body) ----
    if (!authHeader) {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: 'Missing Authorization header and username' });
      }
      const result = await pool.query('SELECT id_usuario FROM usuarios WHERE username = $1', [username]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const userId = result.rows[0].id_usuario;
      await pool.query('UPDATE usuarios SET token_sesion_activa = NULL WHERE id_usuario = $1', [userId]);
      return res.json({ message: `Logout successful for ${username}` });
    }

    // ---- Normal token based logout ----
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback');
    if (!decoded || !decoded.id_usuario) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    const userId = decoded.id_usuario;
    await pool.query('UPDATE usuarios SET token_sesion_activa = NULL WHERE id_usuario = $1', [userId]);
    return res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error in /logout:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/v1/auth/cancel-session', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: 'username is required' });
    }
    const result = await pool.query('SELECT id_usuario FROM usuarios WHERE username = $1', [username]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userId = result.rows[0].id_usuario;
    await pool.query('UPDATE usuarios SET token_sesion_activa = NULL WHERE id_usuario = $1', [userId]);
    return res.json({ message: `Session cleared for user ${username}` });
  } catch (error) {
    console.error('Error in /cancel-session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});