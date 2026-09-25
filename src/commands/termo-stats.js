import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { pool } from '../db/pool.js';
import { calcularEstatisticas, montarEstatisticas } from '../services/estatisticas.js';
import { MODOS } from '../services/modos.js';
import { CORES } from '../services/renderTermo.js';
import { dataDeHoje } from '../utils/datas.js';

export const data = new SlashCommandBuilder()
  .setName('termo-stats')
  .setDescription('Estatísticas de Termo, Dueto e Quarteto: vitórias, streaks e distribuição de tentativas.')
  .addUserOption((o) =>
    o.setName('usuario').setDescription('De quem ver as estatísticas (padrão: você)').setRequired(false),
  );

export async function execute(interaction) {
  const alvo = interaction.options.getUser('usuario') ?? interaction.user;
  const membro = interaction.options.getMember('usuario') ?? (alvo.id === interaction.user.id ? interaction.member : null);
  const nome = membro?.displayName ?? alvo.displayName;

  // Só partidas finalizadas: a de hoje em andamento não entra (não vaza nada da palavra do dia)
  const { rows } = await pool.query(
    `SELECT td.modo, td.data::text AS data, tp.venceu, tp.num_tentativas
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
      WHERE tp.usuario_id = $1 AND tp.finalizado
      ORDER BY td.data DESC`,
    [String(alvo.id)],
  );

  if (rows.length === 0) {
    const quem = alvo.id === interaction.user.id ? 'Você ainda não terminou' : `${nome} ainda não terminou`;
    return interaction.reply({ content: `${quem} nenhuma partida.`, allowedMentions: { parse: [] } });
  }

  const hoje = dataDeHoje();
  const secoes = Object.entries(MODOS).map(([modo, { nome: nomeModo, palavras }]) => {
    const doModo = rows.filter((r) => r.modo === modo);
    if (doModo.length === 0) return `**${nomeModo}**: ainda não jogou`;
    return `**${nomeModo}**\n${montarEstatisticas(calcularEstatisticas(doModo, hoje, palavras))}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`📊 Estatísticas de ${nome}`)
    .setDescription(secoes.join('\n\n'))
    .setColor(CORES.verde);

  await interaction.reply({ embeds: [embed] });
}
