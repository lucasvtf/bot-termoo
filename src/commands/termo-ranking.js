import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { pool } from '../db/pool.js';
import { renderRankingImagem } from '../services/renderRanking.js';
import { calcularStreaks } from '../services/streaks.js';
import {
  dataDeHoje, inicioDaSemana, inicioDoMes, nomeDoMes, formatarDiaMes,
} from '../utils/datas.js';

const TOP_N = 20;

export const data = new SlashCommandBuilder()
  .setName('termo-ranking')
  .setDescription('Ranking do Termo: streak de acertos, vitórias e constância.')
  .addStringOption((o) =>
    o
      .setName('periodo')
      .setDescription('Período do ranking (padrão: geral)')
      .addChoices(
        { name: 'Semana', value: 'semana' },
        { name: 'Mês', value: 'mes' },
        { name: 'Geral', value: 'geral' },
      ),
  );

// Períodos de calendário: semana começa na segunda, mês no dia 1.
// Filtram só vitórias/média (o que define a posição); streaks são sempre do histórico todo.
const PERIODOS = {
  semana: (hoje) => {
    const inicio = inicioDaSemana(hoje);
    return { inicio, titulo: `Ranking do Termo — semana de ${formatarDiaMes(inicio)}`, nome: 'nesta semana' };
  },
  mes: (hoje) => ({ inicio: inicioDoMes(hoje), titulo: `Ranking do Termo — ${nomeDoMes(hoje)}`, nome: 'neste mês' }),
  geral: () => ({ inicio: null, titulo: 'Ranking do Termo', nome: null }),
};

export async function execute(interaction) {
  await interaction.deferReply();

  const { rows } = await pool.query(
    `SELECT tp.usuario_id, COALESCE(u.nome_exibicao, u.username) AS username, td.data::text AS data, tp.venceu, tp.num_tentativas
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
       JOIN usuarios u ON u.id = tp.usuario_id
      WHERE tp.finalizado = TRUE
      ORDER BY tp.usuario_id, td.data DESC`,
  );

  if (rows.length === 0) {
    return interaction.editReply({ content: 'Ninguém jogou o Termo ainda.' });
  }

  const hoje = dataDeHoje();
  const porUsuario = new Map();
  for (const row of rows) {
    if (!porUsuario.has(row.usuario_id)) porUsuario.set(row.usuario_id, { username: row.username, partidas: [] });
    porUsuario.get(row.usuario_id).partidas.push(row);
  }

  const periodo = PERIODOS[interaction.options.getString('periodo') ?? 'geral'](hoje);

  const todos = [...porUsuario.entries()].map(([usuarioId, { username, partidas }]) => {
    const doPeriodo = periodo.inicio ? partidas.filter((p) => p.data >= periodo.inicio) : partidas;
    const vitorias = doPeriodo.filter((p) => p.venceu).length;
    const jogadas = doPeriodo.length;
    const tentativasVitorias = doPeriodo.filter((p) => p.venceu).map((p) => p.num_tentativas);
    const mediaTentativas = tentativasVitorias.length > 0
      ? tentativasVitorias.reduce((a, b) => a + b, 0) / tentativasVitorias.length
      : null;
    const { streakAcertos, streakJogos } = calcularStreaks(partidas, hoje);
    return { usuarioId, username, vitorias, jogadas, mediaTentativas, streakAcertos, streakJogos };
  });

  // Na posição só entra quem jogou no período; os destaques (streaks) consideram todo mundo.
  const stats = todos.filter((s) => s.jogadas > 0);
  if (stats.length === 0) {
    return interaction.editReply({ content: `Ninguém terminou um Termo ${periodo.nome} ainda.` });
  }

  stats.sort((a, b) =>
    b.vitorias - a.vitorias
    || (a.mediaTentativas ?? Infinity) - (b.mediaTentativas ?? Infinity)
    || b.streakJogos - a.streakJogos,
  );

  const formatarNomes = (nomes) => {
    if (nomes.length === 1) return nomes[0];
    if (nomes.length <= 3) return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
    return `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
  };

  const destaquePor = (campo) => {
    const valor = Math.max(...todos.map((s) => s[campo]));
    if (valor <= 0) return null;
    const nomes = todos.filter((s) => s[campo] === valor).map((s) => s.username);
    return { username: formatarNomes(nomes), valor };
  };

  const destaqueStreak = destaquePor('streakAcertos');
  const destaqueDias = destaquePor('streakJogos');

  const buffer = renderRankingImagem(stats.slice(0, TOP_N), { destaqueStreak, destaqueDias, titulo: periodo.titulo });
  const anexo = new AttachmentBuilder(buffer, { name: 'termo-ranking.png' });

  await interaction.editReply({ files: [anexo] });
}
