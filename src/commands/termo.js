import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { pool } from '../db/pool.js';
import { upsertUsuario } from '../db/usuarios.js';
import { garantirPalavraDoDia, dataDeHoje } from '../services/palavraDoDia.js';
import { MAX_TENTATIVAS, TAMANHO_PALAVRA } from '../services/termoEngine.js';
import { renderTermoImagem, renderTermoImagemPublica } from '../services/renderTermo.js';
import { normalizar } from '../utils/normalizar.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PALAVRAS_VALIDAS = new Set(
  JSON.parse(readFileSync(join(__dirname, '..', 'data', 'palavras-validas.json'), 'utf8')),
);

export const data = new SlashCommandBuilder()
  .setName('termo')
  .setDescription('Tenta adivinhar a palavra do dia (5 letras).')
  .addStringOption((o) =>
    o.setName('palavra').setDescription('Sua tentativa de 5 letras').setRequired(true).setMinLength(5).setMaxLength(5),
  );

function anexoGrid(tentativas, palavraCerta) {
  const buffer = renderTermoImagem(tentativas, palavraCerta);
  return new AttachmentBuilder(buffer, { name: 'termo.png' });
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  await upsertUsuario(interaction.user.id, interaction.user.username);
  const dia = await garantirPalavraDoDia(dataDeHoje());

  const tentativa = normalizar(interaction.options.getString('palavra'));
  if (tentativa.length !== TAMANHO_PALAVRA || !/^[A-Z]+$/.test(tentativa)) {
    return interaction.editReply('Tentativa inválida — precisa ter 5 letras.');
  }
  if (!PALAVRAS_VALIDAS.has(tentativa)) {
    return interaction.editReply(`\`${tentativa}\` não é uma palavra reconhecida.`);
  }

  const { rows } = await pool.query(
    `SELECT tentativas, finalizado, venceu FROM termo_partidas WHERE usuario_id = $1 AND dia_id = $2`,
    [String(interaction.user.id), dia.id],
  );
  const partida = rows[0];

  if (partida?.finalizado) {
    const status = partida.venceu ? 'Você já venceu hoje!' : 'Você já usou suas 6 tentativas hoje.';
    return interaction.editReply({ content: status, files: [anexoGrid(partida.tentativas, dia.palavra)] });
  }

  const tentativasAnteriores = partida?.tentativas ?? [];
  const novasTentativas = [...tentativasAnteriores, tentativa];
  const numTentativas = novasTentativas.length;
  const venceu = tentativa === dia.palavra;
  const finalizado = venceu || numTentativas >= MAX_TENTATIVAS;

  await pool.query(
    `INSERT INTO termo_partidas (usuario_id, dia_id, tentativas, num_tentativas, venceu, finalizado, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, now())
     ON CONFLICT (usuario_id, dia_id) DO UPDATE SET
       tentativas = EXCLUDED.tentativas,
       num_tentativas = EXCLUDED.num_tentativas,
       venceu = EXCLUDED.venceu,
       finalizado = EXCLUDED.finalizado,
       updated_at = now()`,
    [String(interaction.user.id), dia.id, JSON.stringify(novasTentativas), numTentativas, venceu, finalizado],
  );

  let status;
  if (venceu) status = `Você acertou em ${numTentativas}/${MAX_TENTATIVAS}!`;
  else if (finalizado) status = `Suas tentativas acabaram. A palavra era \`${dia.palavra}\`.`;
  else status = `Tentativa ${numTentativas} de ${MAX_TENTATIVAS}.`;

  await interaction.editReply({ content: status, files: [anexoGrid(novasTentativas, dia.palavra)] });

  const jaEstavaFinalizado = partida?.finalizado ?? false;
  if (finalizado && !jaEstavaFinalizado && process.env.CANAL_TERMO) {
    const canal = await interaction.client.channels.fetch(process.env.CANAL_TERMO).catch(() => null);
    if (canal) {
      const resumo = venceu
        ? `<@${interaction.user.id}> resolveu o Termo de hoje em ${numTentativas}/${MAX_TENTATIVAS}`
        : `<@${interaction.user.id}> não resolveu o Termo de hoje (${MAX_TENTATIVAS}/${MAX_TENTATIVAS})`;
      const bufferPublico = renderTermoImagemPublica(novasTentativas, dia.palavra);
      const anexoPublico = new AttachmentBuilder(bufferPublico, { name: 'termo-resultado.png' });
      const embed = new EmbedBuilder()
        .setDescription(resumo)
        .setImage('attachment://termo-resultado.png')
        .setColor(venceu ? 0x57f287 : 0xed4245);
      await canal.send({ embeds: [embed], files: [anexoPublico], allowedMentions: { parse: [] } });
    }
  }
}
