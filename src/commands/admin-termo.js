import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { requireAdmin } from '../utils/admin.js';
import { validarFormato, validarPalavra } from '../services/palavras.js';
import {
  rerolarPalavraDoDia, definirPalavrasDoDia, banirPalavra, statusDoDia, garantirPalavraDoDia,
} from '../services/palavraDoDia.js';
import { dataDeHoje } from '../utils/datas.js';

export const data = new SlashCommandBuilder()
  .setName('admin-termo')
  .setDescription('Administração da palavra do dia do Termo.')
  .addSubcommand((sc) => sc.setName('rerolar').setDescription('Sorteia uma nova palavra do dia (descarta a atual).'))
  .addSubcommand((sc) =>
    sc
      .setName('definir-palavra')
      .setDescription('Define manualmente a palavra do dia.')
      .addStringOption((o) =>
        o.setName('palavra').setDescription('Palavra de 5 letras').setRequired(true).setMinLength(5).setMaxLength(5),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName('banir-palavra')
      .setDescription('Bane uma palavra do sorteio de palavra do dia (permanente).')
      .addStringOption((o) =>
        o.setName('palavra').setDescription('Palavra de 5 letras').setRequired(true).setMinLength(5).setMaxLength(5),
      ),
  );

async function recusarSeAlguemComecou(interaction, hoje) {
  const { iniciadas } = await statusDoDia(hoje);
  if (iniciadas === 0) return false;
  await interaction.reply({
    content: `Não dá pra trocar a palavra: ${iniciadas} pessoa(s) já começaram a de hoje.`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

export async function execute(interaction) {
  if (!(await requireAdmin(interaction))) return;

  const sub = interaction.options.getSubcommand();

  if (sub === 'rerolar') {
    const hoje = dataDeHoje();
    if (await recusarSeAlguemComecou(interaction, hoje)) return;
    const dia = await rerolarPalavraDoDia(hoje);
    return interaction.reply({ content: `Nova palavra do dia sorteada (\`${dia.palavras.join(', ')}\`).`, flags: MessageFlags.Ephemeral });
  }

  if (sub === 'definir-palavra') {
    const { palavra, erro } = validarPalavra(interaction.options.getString('palavra'));
    if (erro) return interaction.reply({ content: erro, flags: MessageFlags.Ephemeral });
    const hoje = dataDeHoje();
    if (await recusarSeAlguemComecou(interaction, hoje)) return;
    const dia = await definirPalavrasDoDia([palavra], hoje, 'termo');
    return interaction.reply({ content: `Palavra do dia definida como \`${dia.palavras.join(', ')}\`.`, flags: MessageFlags.Ephemeral });
  }

  if (sub === 'banir-palavra') {
    // Só formato: dá pra banir qualquer palavra de 5 letras, mesmo fora da lista de válidas.
    const { palavra, erro } = validarFormato(interaction.options.getString('palavra'));
    if (erro) return interaction.reply({ content: erro, flags: MessageFlags.Ephemeral });

    await banirPalavra(palavra, interaction.user.id);

    const hoje = dataDeHoje();
    const diaAtual = await garantirPalavraDoDia(hoje);
    if (diaAtual.palavras.includes(palavra)) {
      const { iniciadas } = await statusDoDia(hoje);
      if (iniciadas === 0) {
        const novoDia = await rerolarPalavraDoDia(hoje);
        return interaction.reply({
          content: `\`${palavra}\` banida do sorteio. Como era a palavra de hoje e ninguém tinha começado, já sorteei outra: \`${novoDia.palavras.join(', ')}\`.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return interaction.reply({
        content: `\`${palavra}\` banida de sorteios futuros. Hoje ela continua, porque ${iniciadas} pessoa(s) já começaram.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({ content: `\`${palavra}\` banida do sorteio de palavras futuras.`, flags: MessageFlags.Ephemeral });
  }
}
