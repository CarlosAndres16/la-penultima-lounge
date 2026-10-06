import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db.js';
import { requireAuth } from '@lounge/common';
import usersRouter from './routes/users.js';

const app = express();
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
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
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
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      const nuevosIntentos = user.intentos_fallidos + 1;

      if (nuevosIntentos >= 3) {
        await pool.query(
          'UPDATE usuarios SET intentos_fallidos = $1, estado = $2 WHERE id_usuario = $3',
          [nuevosIntentos, 'Bloqueado', user.id_usuario]
        );
        return res.status(403).json({
          error: 'Cuenta bloqueada tras 3 intentos fallidos. Contacte a un Administrador.'
        });
      }

      await pool.query(
        'UPDATE usuarios SET intentos_fallidos = $1 WHERE id_usuario = $2',
        [nuevosIntentos, user.id_usuario]
      );

      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    if (user.estado === 'Bloqueado') {
      return res.status(403).json({
        error: 'Cuenta bloqueada tras 3 intentos fallidos. Contacte a un Administrador.'
      });
    }

    if (user.estado === 'Inactivo') {
      return res.status(403).json({ error: 'Usuario inactivo. Contacte a un Administrador.' });
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
      message: 'Login exitoso',
      token,
      user: safeUser
    });

  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(PORT, () => console.log(`auth escuchando en el puerto ${PORT}`));