import 'dotenv/config';
import pg from 'pg';

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não definido no .env');
}

const needsSsl = /sslmode=require|neon\.tech/i.test(DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Conexão ociosa morreu (ex.: Neon suspendeu o compute). O pool abre outra na próxima query.
  console.error('[pg] erro em conexão ociosa:', err.message);
});

export const query = (text, params) => pool.query(text, params);
