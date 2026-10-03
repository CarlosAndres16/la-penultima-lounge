import express from 'express';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'sedes' });
});

// Ruta temporal de prueba: borrarla cuando existan rutas reales
app.get('/api/v1/sedes/ping', (req, res) => {
  res.json({ message: 'pong desde sedes' });
});

app.listen(PORT, () => console.log(`sedes escuchando en el puerto ${PORT}`));