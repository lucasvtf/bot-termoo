import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../db/pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESPOSTAS = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'palavras-respostas.json'), 'utf8'),
);

export function dataDeHoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function sortearPalavra(excluir) {
  const disponiveis = RESPOSTAS.filter((p) => !excluir.has(p));
  const candidatas = disponiveis.length > 0 ? disponiveis : RESPOSTAS;
  return candidatas[Math.floor(Math.random() * candidatas.length)];
}

export async function garantirPalavraDoDia(data = dataDeHoje()) {
  const existente = await pool.query('SELECT id, data::text AS data, palavra FROM termo_dias WHERE data = $1', [data]);
  if (existente.rows.length > 0) return existente.rows[0];

  const [usadas, banidas] = await Promise.all([
    pool.query('SELECT palavra FROM termo_dias'),
    pool.query('SELECT palavra FROM termo_banidas'),
  ]);
  const excluir = new Set([...usadas.rows.map((r) => r.palavra), ...banidas.rows.map((r) => r.palavra)]);
  const palavra = sortearPalavra(excluir);

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

export async function rerolarPalavraDoDia(data = dataDeHoje()) {
  await pool.query('DELETE FROM termo_dias WHERE data = $1', [data]);
  return garantirPalavraDoDia(data);
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
