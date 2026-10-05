import jwt from 'jsonwebtoken';

export const requireAuth = (queryFn) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback');
    
    const result = await queryFn('SELECT token_sesion_activa, estado FROM usuarios WHERE id_usuario = $1', [decoded.id_usuario]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    if (user.estado !== 'Activo') {
      return res.status(403).json({ error: 'Usuario inactivo o bloqueado' });
    }

    if (user.token_sesion_activa !== token) {
      return res.status(401).json({ 
        error: 'Su sesión ha finalizado porque se inició sesión en otro dispositivo',
        code: 'SESSION_SUPERSEDED'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Error de autenticación:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'El token ha expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
};

export const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!allowedRoles.includes(req.user.rol)) {
    return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
  }
  next();
};
