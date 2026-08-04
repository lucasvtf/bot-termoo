import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { pool } from '../db/pool.js';
import { renderRankingImagem } from '../services/renderRanking.js';

const TOP_N = 20;

export const data = new SlashCommandBuilder()
  .setName('termo-ranking')
  .setDescription('Ranking do Termo: streak de acertos, vitórias e constância.');

function diaAnterior(dataStr) {
  const d = new Date(`${dataStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function calcularStreaks(partidasOrdenadasDesc) {
  let streakAcertos = 0;
  let streakJogos = 0;
  let acertosAindaValendo = true;
  let dataEsperada = null;

  for (const p of partidasOrdenadasDesc) {
    if (dataEsperada !== null && p.data !== dataEsperada) break;
    streakJogos += 1;
    if (acertosAindaValendo && p.venceu) {
      streakAcertos += 1;
    } else {
      acertosAindaValendo = false;
    }
    dataEsperada = diaAnterior(p.data);
  }

  return { streakAcertos, streakJogos };
}

export async function execute(interaction) {
  await interaction.deferReply();

  const { rows } = await pool.query(
    `SELECT tp.usuario_id, u.username, td.data::text AS data, tp.venceu, tp.num_tentativas
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
       JOIN usuarios u ON u.id = tp.usuario_id
      WHERE tp.finalizado = TRUE
      ORDER BY tp.usuario_id, td.data DESC`,
  );

  if (rows.length === 0) {
    return interaction.editReply({ content: 'Ninguém jogou o Termo ainda.' });
  }

  const porUsuario = new Map();
  for (const row of rows) {
    if (!porUsuario.has(row.usuario_id)) porUsuario.set(row.usuario_id, { username: row.username, partidas: [] });
    porUsuario.get(row.usuario_id).partidas.push(row);
  }

  const stats = [...porUsuario.entries()].map(([usuarioId, { username, partidas }]) => {
    const vitorias = partidas.filter((p) => p.venceu).length;
    const jogadas = partidas.length;
    const tentativasVitorias = partidas.filter((p) => p.venceu).map((p) => p.num_tentativas);
    const mediaTentativas = tentativasVitorias.length > 0
      ? tentativasVitorias.reduce((a, b) => a + b, 0) / tentativasVitorias.length
      : null;
    const { streakAcertos, streakJogos } = calcularStreaks(partidas);
    return { usuarioId, username, vitorias, jogadas, mediaTentativas, streakAcertos, streakJogos };
  });

  stats.sort((a, b) =>
    b.vitorias - a.vitorias
    || (a.mediaTentativas ?? Infinity) - (b.mediaTentativas ?? Infinity)
    || b.streakJogos - a.streakJogos,
  );

  const melhorPor = (campo) =>
    stats.reduce((melhor, s) => (s[campo] > (melhor?.[campo] ?? 0) ? s : melhor), null);

  const recordistaStreak = melhorPor('streakAcertos');
  const destaqueStreak = recordistaStreak && recordistaStreak.streakAcertos > 0
    ? { username: recordistaStreak.username, valor: recordistaStreak.streakAcertos }
    : null;

  const recordistaDias = melhorPor('streakJogos');
  const destaqueDias = recordistaDias && recordistaDias.streakJogos > 0
    ? { username: recordistaDias.username, valor: recordistaDias.streakJogos }
    : null;

  const buffer = renderRankingImagem(stats.slice(0, TOP_N), { destaqueStreak, destaqueDias });
  const anexo = new AttachmentBuilder(buffer, { name: 'termo-ranking.png' });

  await interaction.editReply({ files: [anexo] });
}
