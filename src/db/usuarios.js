import { pool } from './pool.js';

export async function upsertUsuario(id, username) {
  await pool.query(
    `INSERT INTO usuarios (id, username)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username`,
    [String(id), username],
  );
}
