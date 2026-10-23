import express from 'express';
import sedesRouter from './routes/sedes.js';
import proveedoresRouter from './routes/proveedores.js';
import productosRouter from './routes/productos.js';
import sedesMyRouter from './routes/sedesMy.js';
import reabastecimientosRouter from './routes/reabastecimientos.js';
import pedidosRouter from './routes/pedidos.js';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sedes' });
});

app.use('/api/v1/sedes', sedesRouter);
app.use('/api/v1/sedes/mia', sedesMyRouter);
app.use('/api/v1/proveedores', proveedoresRouter);
app.use('/api/v1/productos', productosRouter);
app.use('/api/v1/reabastecimientos', reabastecimientosRouter);
app.use('/api/v1/pedidos', pedidosRouter);

app.listen(PORT, () => console.log(`sedes escuchando en el puerto ${PORT}`));