// clearTokens.js – utility to clear all active JWTs from the database
// Usage:   node clearTokens.js
// It connects to the PostgreSQL database using the DATABASE_URL environment variable (or defaults).
// Ensure the .env file is loaded (e.g., via `npm run start` or `node -r dotenv/config clearTokens.js`).

import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables (dotenv) if not already loaded
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  await import('dotenv/config');
} catch (e) {
  // dotenv not installed – ignore (environment may already be set)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/${process.env.POSTGRES_DB}`,
});

(async () => {
  try {
    const res = await pool.query('UPDATE usuarios SET token_sesion_activa = NULL');
    console.log('✅ Tokens cleared. Rows affected:', res.rowCount);
  } catch (err) {
    console.error('❌ Error clearing tokens:', err);
  } finally {
    await pool.end();
  }
})();
