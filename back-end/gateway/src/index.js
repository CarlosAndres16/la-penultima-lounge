import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

// OJO: los prefijos de ruta son una PROPUESTA del equipo (no están en la documentación).
// Acuérdenlos entre los dos y anótenlos en docs/decisiones.md.
app.use(
  createProxyMiddleware({
    target: 'http://auth:3001',
    changeOrigin: true,
    pathFilter: ['/api/v1/auth', '/api/v1/users'],
  })
);

app.use(
  createProxyMiddleware({
    target: 'http://sedes:3002',
    changeOrigin: true,
    pathFilter: '/api/v1/sedes',
  })
);

app.listen(PORT, () => console.log(`gateway escuchando en el puerto ${PORT}`));