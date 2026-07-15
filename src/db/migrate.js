import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

try {
  await pool.query(sql);
  console.log('Schema aplicado com sucesso.');
} catch (err) {
  console.error('Erro ao aplicar schema:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
