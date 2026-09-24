import { pool } from '../db/pool.js';
import { RESPOSTAS } from './palavras.js';
import { dataDeHoje } from '../utils/datas.js';

function sortearPalavra(excluir) {
  const disponiveis = RESPOSTAS.filter((p) => !excluir.has(p));
  const candidatas = disponiveis.length > 0 ? disponiveis : RESPOSTAS;
  return candidatas[Math.floor(Math.random() * candidatas.length)];
}

async function sortearNovaPalavra() {
  const [usadas, banidas] = await Promise.all([
    pool.query('SELECT palavra FROM termo_dias'),
    pool.query('SELECT palavra FROM termo_banidas'),
  ]);
  const excluir = new Set([...usadas.rows, ...banidas.rows].map((r) => r.palavra));
  return sortearPalavra(excluir);
}

export async function garantirPalavraDoDia(data = dataDeHoje()) {
  const existente = await pool.query('SELECT id, data::text AS data, palavra FROM termo_dias WHERE data = $1', [data]);
  if (existente.rows.length > 0) return existente.rows[0];

  const palavra = await sortearNovaPalavra();

  const { rows } = await pool.query(
    `INSERT INTO termo_dias (data, palavra)
     VALUES ($1, $2)
     ON CONFLICT (data) DO UPDATE SET data = EXCLUDED.data
     RETURNING id, data::text AS data, palavra`,
    [data, palavra],
  );
  return rows[0];
}

export async function banirPalavra(palavra, usuarioId) {
  await pool.query(
    `INSERT INTO termo_banidas (palavra, banida_por)
     VALUES ($1, $2)
     ON CONFLICT (palavra) DO NOTHING`,
    [palavra, usuarioId ? String(usuarioId) : null],
  );
}

// UPDATE em vez de DELETE: o dia mantém o mesmo id e nada é apagado em cascata.
// Como a palavra atual continua em termo_dias, ela fica excluída do sorteio.
export async function rerolarPalavraDoDia(data = dataDeHoje()) {
  return definirPalavraDoDia(await sortearNovaPalavra(), data);
}

export async function statusDoDia(data = dataDeHoje()) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS iniciadas,
            COUNT(*) FILTER (WHERE tp.finalizado)::int AS finalizadas
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
      WHERE td.data = $1`,
    [data],
  );
  return rows[0];
}

export async function definirPalavraDoDia(palavra, data = dataDeHoje()) {
  const { rows } = await pool.query(
    `INSERT INTO termo_dias (data, palavra)
     VALUES ($1, $2)
     ON CONFLICT (data) DO UPDATE SET palavra = EXCLUDED.palavra
     RETURNING id, data::text AS data, palavra`,
    [data, palavra],
  );
  return rows[0];
}
