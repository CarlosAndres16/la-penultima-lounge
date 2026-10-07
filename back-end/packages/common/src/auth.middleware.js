import jwt from 'jsonwebtoken';

export const requireAuth = (queryFn) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token not provided' });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback');
    
    const result = await queryFn('SELECT token_sesion_activa, estado FROM usuarios WHERE id_usuario = $1', [decoded.id_usuario]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.estado !== 'Activo') {
      return res.status(403).json({ error: 'User is inactive or blocked' });
    }

    if (user.token_sesion_activa !== token) {
      return res.status(401).json({ 
        error: 'Your session has ended because you signed in on another device',
        code: 'SESSION_SUPERSEDED'
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!allowedRoles.includes(req.user.rol)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  next();
};