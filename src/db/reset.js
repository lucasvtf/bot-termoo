import { pool } from './pool.js';

if (!process.argv.includes('--confirmar')) {
  console.error(
    'Recusado. Esse comando apaga usuários, dias, partidas e banidas.\n' +
    'Pra confirmar, roda:  npm run db:reset -- --confirmar',
  );
  process.exit(1);
}

try {
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM usuarios)       AS usuarios,
      (SELECT COUNT(*) FROM termo_dias)     AS dias,
      (SELECT COUNT(*) FROM termo_partidas) AS partidas,
      (SELECT COUNT(*) FROM termo_banidas)  AS banidas
  `);
  const { usuarios, dias, partidas, banidas } = counts.rows[0];
  console.log(`Apagando: ${usuarios} usuários, ${dias} dias, ${partidas} partidas, ${banidas} banidas...`);

  await pool.query('TRUNCATE usuarios, termo_dias, termo_partidas, termo_banidas RESTART IDENTITY CASCADE');
  console.log('Reset OK. IDs reiniciados.');
} catch (err) {
  console.error('Falha:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
