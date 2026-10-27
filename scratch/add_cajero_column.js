import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'lounge_user',
  password: process.env.PGPASSWORD || 'lounge_pass',
  database: process.env.PGDATABASE || 'lounge_db',
});
(async () => {
  try {
    await pool.query(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS id_usuario_cajero INT DEFAULT NULL;`);
    await pool.query(`ALTER TABLE pedidos ADD CONSTRAINT IF NOT EXISTS fk_pedido_cajero FOREIGN KEY (id_usuario_cajero) REFERENCES usuarios(id_usuario);`);
    console.log('Column added/constraint ensured');
  } catch (e) {
    console.error('Error applying migration', e);
  } finally {
    await pool.end();
  }
})();

