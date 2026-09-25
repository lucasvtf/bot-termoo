import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { pool } from '../db/pool.js';
import { calcularEstatisticas, montarEstatisticas } from '../services/estatisticas.js';
import { CORES } from '../services/renderTermo.js';
import { dataDeHoje } from '../utils/datas.js';

export const data = new SlashCommandBuilder()
  .setName('termo-stats')
  .setDescription('Estatísticas do Termo: vitórias, streaks e distribuição de tentativas.')
  .addUserOption((o) =>
    o.setName('usuario').setDescription('De quem ver as estatísticas (padrão: você)').setRequired(false),
  );

export async function execute(interaction) {
  const alvo = interaction.options.getUser('usuario') ?? interaction.user;
  const membro = interaction.options.getMember('usuario') ?? (alvo.id === interaction.user.id ? interaction.member : null);
  const nome = membro?.displayName ?? alvo.displayName;

  // Só partidas finalizadas: a de hoje em andamento não entra (não vaza nada da palavra do dia)
  const { rows: partidas } = await pool.query(
    `SELECT td.data::text AS data, tp.venceu, tp.num_tentativas
       FROM termo_partidas tp
       JOIN termo_dias td ON td.id = tp.dia_id
      WHERE tp.usuario_id = $1 AND tp.finalizado AND td.modo = 'termo'
      ORDER BY td.data DESC`,
    [String(alvo.id)],
  );

  if (partidas.length === 0) {
    const quem = alvo.id === interaction.user.id ? 'Você ainda não terminou' : `${nome} ainda não terminou`;
    return interaction.reply({ content: `${quem} nenhum Termo.`, allowedMentions: { parse: [] } });
  }

  const embed = new EmbedBuilder()
    .setTitle(`📊 Estatísticas de ${nome}`)
    .setDescription(montarEstatisticas(calcularEstatisticas(partidas, dataDeHoje())))
    .setColor(CORES.verde);

  await interaction.reply({ embeds: [embed] });
}
