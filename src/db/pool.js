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

export const query = (text, params) => pool.query(text, params);
