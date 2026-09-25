import { SlashCommandBuilder } from 'discord.js';
import { jogar } from '../services/jogar.js';

export const data = new SlashCommandBuilder()
  .setName('dueto')
  .setDescription('Dueto: adivinhe 2 palavras ao mesmo tempo, em até 7 tentativas.')
  .addStringOption((o) =>
    o.setName('palavra').setDescription('Sua tentativa de 5 letras (vale pras 2 palavras)').setRequired(true).setMinLength(5).setMaxLength(5),
  );

export const execute = (interaction) => jogar(interaction, 'dueto');
