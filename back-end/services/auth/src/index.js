import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth' });
});

// Ruta temporal de prueba: borrarla cuando existan rutas reales
app.get('/api/v1/auth/ping', (req, res) => {
  res.json({ message: 'pong desde auth' });
});

app.listen(PORT, () => console.log(`auth escuchando en el puerto ${PORT}`));