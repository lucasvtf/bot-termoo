import { pool } from '../db/pool.js';
import { dataDeHoje, diaAnterior, inicioDaSemana } from '../utils/datas.js';
import { MODOS } from './modos.js';
import {
  resumirPartidas, montarAnuncio, calcularCampeoes, faixaDeTentativas,
} from './resumoDia.js';

// Anuncia o dia anterior no CANAL_TERMO numa mensagem só: palavras + resumo de cada modo
// (e os campeões da semana às segundas). Idempotente: roda no cron da meia-noite e no startup;
// só os dias que viram anunciado false → true entram, então nada sai duplicado.
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
  const { rows: dias } = await pool.query(
    `UPDATE termo_dias SET anunciado = TRUE
      WHERE data = $1 AND NOT anunciado
      RETURNING id, modo, palavras`,
    [ontem],
  );
  if (dias.length === 0) return; // já anunciado, ou não existe dia de ontem
  const ids = dias.map((d) => d.id);

  try {
    const { rows: partidas } = await pool.query(
      `SELECT dia_id, usuario_id::text, venceu, num_tentativas
         FROM termo_partidas
        WHERE dia_id = ANY($1) AND finalizado`,
      [ids],
    );

    const ordem = Object.keys(MODOS);
    const secoes = dias
      .sort((a, b) => ordem.indexOf(a.modo) - ordem.indexOf(b.modo))
      .map((d) => ({
        nome: MODOS[d.modo].nome,
        palavras: d.palavras,
        resumo: resumirPartidas(partidas.filter((p) => p.dia_id === d.id), faixaDeTentativas(d.palavras.length)),
      }));

    // Segunda-feira: ontem foi domingo, fecha a semana (seg–dom) e anuncia os campeões
    const campeoes = inicioDaSemana(hoje) === hoje ? await campeoesDaSemana(inicioDaSemana(ontem), ontem) : [];
    const content = montarAnuncio(secoes, campeoes);
    await canal.send({ content, allowedMentions: { parse: [] } });
    console.log(`[anuncio] dia ${ontem} anunciado (${dias.length} modos, ${partidas.length} partidas)`);
  } catch (err) {
    // Falhou antes de postar: devolve a "reserva" pra tentar de novo no próximo startup/cron
    await pool.query('UPDATE termo_dias SET anunciado = FALSE WHERE id = ANY($1)', [ids]).catch(() => {});
    throw err;
  }
}

async function campeoesDaSemana(inicio, fim) {
  const { rows } = await pool.query(
    `SELECT td.modo, tp.usuario_id::text,
            COUNT(*) FILTER (WHERE tp.venceu)::int AS vitorias,
            AVG(tp.num_tentativas) FILTER (WHERE tp.venceu) AS media
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
      WHERE tp.finalizado AND td.data BETWEEN $1 AND $2
      GROUP BY td.modo, tp.usuario_id`,
    [inicio, fim],
  );
  return Object.entries(MODOS).map(([modo, { nome }]) => ({
    nome,
    campeoes: calcularCampeoes(rows.filter((r) => r.modo === modo)),
  }));
}
