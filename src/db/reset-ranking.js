import { pool } from './pool.js';

if (!process.argv.includes('--confirmar')) {
  console.error(
    'Recusado. Esse comando apaga o histórico de partidas (ranking).\n' +
    'Mantém usuários, palavras banidas e a palavra do dia.\n' +
    'Pra confirmar, roda:  npm run db:reset-ranking -- --confirmar',
  );
  process.exit(1);
}

try {
  const { rows } = await pool.query('SELECT COUNT(*) AS partidas FROM termo_partidas');
  console.log(`Apagando ${rows[0].partidas} partidas...`);

  await pool.query('TRUNCATE termo_partidas RESTART IDENTITY CASCADE');
  console.log('Ranking resetado. Usuários, palavras banidas e palavra do dia continuam intactos.');
} catch (err) {
  console.error('Falha:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
