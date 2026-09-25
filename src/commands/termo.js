import { SlashCommandBuilder } from 'discord.js';
import { jogar } from '../services/jogar.js';

export const data = new SlashCommandBuilder()
  .setName('termo')
  .setDescription('Tenta adivinhar a palavra do dia (5 letras).')
  .addStringOption((o) =>
    o.setName('palavra').setDescription('Sua tentativa de 5 letras').setRequired(true).setMinLength(5).setMaxLength(5),
  );

export const execute = (interaction) => jogar(interaction, 'termo');
