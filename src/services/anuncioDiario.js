import { pool } from '../db/pool.js';
import { dataDeHoje, diaAnterior, inicioDaSemana } from '../utils/datas.js';
import { resumirPartidas, montarAnuncio, calcularCampeoes } from './resumoDia.js';

// Anuncia o dia anterior no CANAL_TERMO (palavra + resumo) e o novo Termo.
// Idempotente: roda no cron da meia-noite e no startup; só quem vira anunciado false → true posta.
export async function anunciarDiaAnterior(client) {
  const canalId = process.env.CANAL_TERMO;
  if (!canalId) return;
  const canal = await client.channels.fetch(canalId).catch(() => null);
  if (!canal) {
    console.warn(`[anuncio] canal ${canalId} não encontrado`);
    return;
  }

  const hoje = dataDeHoje();
  const ontem = diaAnterior(hoje);
  const { rows } = await pool.query(
    `UPDATE termo_dias SET anunciado = TRUE
      WHERE data = $1 AND NOT anunciado
      RETURNING id, palavra`,
    [ontem],
  );
  if (rows.length === 0) return; // já anunciado, ou não existe dia de ontem
  const dia = rows[0];

  try {
    const { rows: partidas } = await pool.query(
      `SELECT usuario_id::text, venceu, num_tentativas
         FROM termo_partidas
        WHERE dia_id = $1 AND finalizado`,
      [dia.id],
    );
    // Segunda-feira: ontem foi domingo, fecha a semana (seg–dom) e anuncia o campeão
    const campeoes = inicioDaSemana(hoje) === hoje ? await campeoesDaSemana(inicioDaSemana(ontem), ontem) : null;
    const content = montarAnuncio(dia.palavra, resumirPartidas(partidas), campeoes);
    await canal.send({ content, allowedMentions: { parse: [] } });
    console.log(`[anuncio] dia ${ontem} anunciado (${partidas.length} partidas)`);
  } catch (err) {
    // Falhou antes de postar: devolve a "reserva" pra tentar de novo no próximo startup/cron
    await pool.query('UPDATE termo_dias SET anunciado = FALSE WHERE id = $1', [dia.id]).catch(() => {});
    throw err;
  }
}

async function campeoesDaSemana(inicio, fim) {
  const { rows } = await pool.query(
    `SELECT tp.usuario_id::text,
            COUNT(*) FILTER (WHERE tp.venceu)::int AS vitorias,
            AVG(tp.num_tentativas) FILTER (WHERE tp.venceu) AS media
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
      WHERE tp.finalizado AND td.data BETWEEN $1 AND $2
      GROUP BY tp.usuario_id`,
    [inicio, fim],
  );
  return calcularCampeoes(rows);
}
