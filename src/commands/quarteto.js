import { SlashCommandBuilder } from 'discord.js';
import { jogar } from '../services/jogar.js';

export const data = new SlashCommandBuilder()
  .setName('quarteto')
  .setDescription('Quarteto: adivinhe 4 palavras ao mesmo tempo, em até 9 tentativas.')
  .addStringOption((o) =>
    o.setName('palavra').setDescription('Sua tentativa de 5 letras (vale pras 4 palavras)').setRequired(true).setMinLength(5).setMaxLength(5),
  );

export const execute = (interaction) => jogar(interaction, 'quarteto');
