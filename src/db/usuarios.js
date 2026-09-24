import { pool } from './pool.js';

export async function upsertUsuario(id, username, nomeExibicao = null) {
  await pool.query(
    `INSERT INTO usuarios (id, username, nome_exibicao)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       username = EXCLUDED.username,
       nome_exibicao = EXCLUDED.nome_exibicao`,
    [String(id), username, nomeExibicao],
  );
}
