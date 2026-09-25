import { pool } from '../db/pool.js';
import { sortearPalavras } from './palavras.js';
import { MODOS, MODO_PADRAO } from './modos.js';
import { dataDeHoje } from '../utils/datas.js';

const COLUNAS = 'id, data::text AS data, modo, palavras';

async function sortearNovasPalavras(quantidade, data) {
  const [usadas, banidas] = await Promise.all([
    pool.query('SELECT data::text AS data, unnest(palavras) AS palavra FROM termo_dias'),
    pool.query('SELECT palavra FROM termo_banidas'),
  ]);
  const nuncaUsar = new Set([
    ...banidas.rows.map((r) => r.palavra),
    ...usadas.rows.filter((r) => r.data === data).map((r) => r.palavra),
  ]);
  const evitar = new Set(usadas.rows.map((r) => r.palavra));
  return sortearPalavras(quantidade, { nuncaUsar, evitar });
}

export async function garantirPalavraDoDia(data = dataDeHoje(), modo = MODO_PADRAO) {
  const existente = await pool.query(
    `SELECT ${COLUNAS} FROM termo_dias WHERE data = $1 AND modo = $2`,
    [data, modo],
  );
  if (existente.rows.length > 0) return existente.rows[0];

  const palavras = await sortearNovasPalavras(MODOS[modo].palavras, data);

  const { rows } = await pool.query(
    `INSERT INTO termo_dias (data, modo, palavras)
     VALUES ($1, $2, $3)
     ON CONFLICT (data, modo) DO UPDATE SET data = EXCLUDED.data
     RETURNING ${COLUNAS}`,
    [data, modo, palavras],
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
// Como as palavras atuais continuam em termo_dias, elas ficam excluídas do sorteio.
export async function rerolarPalavraDoDia(data = dataDeHoje(), modo = MODO_PADRAO) {
  return definirPalavrasDoDia(await sortearNovasPalavras(MODOS[modo].palavras, data), data, modo);
}

export async function statusDoDia(data = dataDeHoje(), modo = MODO_PADRAO) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS iniciadas,
            COUNT(*) FILTER (WHERE tp.finalizado)::int AS finalizadas
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
      WHERE td.data = $1 AND td.modo = $2`,
    [data, modo],
  );
  return rows[0];
}

export async function definirPalavrasDoDia(palavras, data = dataDeHoje(), modo = MODO_PADRAO) {
  const { rows } = await pool.query(
    `INSERT INTO termo_dias (data, modo, palavras)
     VALUES ($1, $2, $3)
     ON CONFLICT (data, modo) DO UPDATE SET palavras = EXCLUDED.palavras
     RETURNING ${COLUNAS}`,
    [data, modo, palavras],
  );
  return rows[0];
}
