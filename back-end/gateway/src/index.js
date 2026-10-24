import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

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
    pathFilter: ['/api/v1/sedes', '/api/v1/productos', '/api/v1/proveedores', '/api/v1/reabastecimientos', '/api/v1/pedidos', '/api/v1/medios-pago', '/api/v1/facturas'],
  })
);

app.listen(PORT, () => console.log(`gateway escuchando en el puerto ${PORT}`));