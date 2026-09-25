import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { requireAdmin } from '../utils/admin.js';
import { validarFormato, validarPalavra } from '../services/palavras.js';
import {
  rerolarPalavraDoDia, definirPalavrasDoDia, banirPalavra, statusDoDia, garantirPalavraDoDia,
} from '../services/palavraDoDia.js';
import { dataDeHoje } from '../utils/datas.js';
import { MODOS } from '../services/modos.js';

const ESCOLHAS_MODO = Object.entries(MODOS).map(([value, { nome }]) => ({ name: nome, value }));

export const data = new SlashCommandBuilder()
  .setName('admin-termo')
  .setDescription('Administração das palavras do dia (Termo, Dueto e Quarteto).')
  .addSubcommand((sc) =>
    sc
      .setName('rerolar')
      .setDescription('Sorteia novas palavras do dia de um modo (descarta as atuais).')
      .addStringOption((o) =>
        o.setName('modo').setDescription('Modo (padrão: Termo)').addChoices(...ESCOLHAS_MODO),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName('definir-palavra')
      .setDescription('Define manualmente a palavra do dia do Termo.')
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

async function recusarSeAlguemComecou(interaction, hoje, modo) {
  const { iniciadas } = await statusDoDia(hoje, modo);
  if (iniciadas === 0) return false;
  await interaction.reply({
    content: `Não dá pra trocar: ${iniciadas} pessoa(s) já começaram o ${MODOS[modo].nome} de hoje.`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

export async function execute(interaction) {
  if (!(await requireAdmin(interaction))) return;

  const sub = interaction.options.getSubcommand();

  if (sub === 'rerolar') {
    const modo = interaction.options.getString('modo') ?? 'termo';
    const hoje = dataDeHoje();
    if (await recusarSeAlguemComecou(interaction, hoje, modo)) return;
    const dia = await rerolarPalavraDoDia(hoje, modo);
    return interaction.reply({
      content: `Novas palavras do ${MODOS[modo].nome} sorteadas (\`${dia.palavras.join(', ')}\`).`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (sub === 'definir-palavra') {
    const { palavra, erro } = validarPalavra(interaction.options.getString('palavra'));
    if (erro) return interaction.reply({ content: erro, flags: MessageFlags.Ephemeral });
    const hoje = dataDeHoje();
    if (await recusarSeAlguemComecou(interaction, hoje, 'termo')) return;
    const dia = await definirPalavrasDoDia([palavra], hoje, 'termo');
    return interaction.reply({ content: `Palavra do dia definida como \`${dia.palavras.join(', ')}\`.`, flags: MessageFlags.Ephemeral });
  }

  if (sub === 'banir-palavra') {
    // Só formato: dá pra banir qualquer palavra de 5 letras, mesmo fora da lista de válidas.
    const { palavra, erro } = validarFormato(interaction.options.getString('palavra'));
    if (erro) return interaction.reply({ content: erro, flags: MessageFlags.Ephemeral });

    await banirPalavra(palavra, interaction.user.id);

    // Se a palavra estiver no dia de hoje de algum modo: troca as palavras desse modo se ninguém começou.
    const hoje = dataDeHoje();
    const avisos = [];
    for (const modo of Object.keys(MODOS)) {
      const diaAtual = await garantirPalavraDoDia(hoje, modo);
      if (!diaAtual.palavras.includes(palavra)) continue;
      const { iniciadas } = await statusDoDia(hoje, modo);
      if (iniciadas === 0) {
        const novoDia = await rerolarPalavraDoDia(hoje, modo);
        avisos.push(`Era do ${MODOS[modo].nome} de hoje e ninguém tinha começado: sorteei \`${novoDia.palavras.join(', ')}\`.`);
      } else {
        avisos.push(`Está no ${MODOS[modo].nome} de hoje, que continua valendo porque ${iniciadas} pessoa(s) já começaram.`);
      }
    }
    if (avisos.length > 0) {
      return interaction.reply({
        content: [`\`${palavra}\` banida do sorteio.`, ...avisos].join('\n'),
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.reply({ content: `\`${palavra}\` banida do sorteio de palavras futuras.`, flags: MessageFlags.Ephemeral });
  }
}
