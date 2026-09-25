import { AttachmentBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { pool } from '../db/pool.js';
import { upsertUsuario } from '../db/usuarios.js';
import { garantirPalavraDoDia } from '../services/palavraDoDia.js';
import { dataDeHoje } from '../utils/datas.js';
import { maxTentativas } from '../services/modos.js';
import { validarPalavra } from '../services/palavras.js';
import { renderTermoImagem } from '../services/renderTermo.js';

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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { palavra: tentativa, erro } = validarPalavra(interaction.options.getString('palavra'));
  if (erro) return interaction.editReply(erro);

  // Apelido no servidor → nome global → @
  const nomeExibicao = interaction.member?.displayName ?? interaction.user.displayName;
  await upsertUsuario(interaction.user.id, interaction.user.username, nomeExibicao);
  const dia = await garantirPalavraDoDia(dataDeHoje(), 'termo');
  const [palavraCerta] = dia.palavras;
  const MAX_TENTATIVAS = maxTentativas(dia.palavras.length);

  const userId = String(interaction.user.id);

  // Garante que a linha existe; o incremento abaixo é atômico (trava a linha),
  // então tentativas simultâneas não se sobrescrevem nem passam de MAX_TENTATIVAS.
  await pool.query(
    `INSERT INTO termo_partidas (usuario_id, dia_id) VALUES ($1, $2)
     ON CONFLICT (usuario_id, dia_id) DO NOTHING`,
    [userId, dia.id],
  );

  const { rows } = await pool.query(
    // Vitória = todas as palavras do dia aparecem nas tentativas (vale pra 1, 2 ou 4 palavras).
    // As palavras vêm do próprio termo_dias, então a checagem é consistente com o banco.
    `UPDATE termo_partidas tp
        SET tentativas     = tp.tentativas || jsonb_build_array($3::text),
            num_tentativas = tp.num_tentativas + 1,
            venceu         = td.palavras <@ (ARRAY(SELECT jsonb_array_elements_text(tp.tentativas)) || $3::text),
            finalizado     = td.palavras <@ (ARRAY(SELECT jsonb_array_elements_text(tp.tentativas)) || $3::text)
                             OR tp.num_tentativas + 1 >= $4,
            updated_at     = now()
       FROM termo_dias td
      WHERE td.id = tp.dia_id
        AND tp.usuario_id = $1 AND tp.dia_id = $2
        AND NOT tp.finalizado
        AND NOT (tp.tentativas ? $3::text)
      RETURNING tp.tentativas, tp.num_tentativas, tp.venceu, tp.finalizado`,
    [userId, dia.id, tentativa, MAX_TENTATIVAS],
  );

  if (rows.length === 0) {
    // Nada foi gravado: ou a partida já estava finalizada, ou a palavra é repetida.
    const { rows: atual } = await pool.query(
      `SELECT tentativas, finalizado, venceu FROM termo_partidas WHERE usuario_id = $1 AND dia_id = $2`,
      [userId, dia.id],
    );
    const partida = atual[0];
    if (partida.finalizado) {
      const status = partida.venceu ? 'Você já venceu hoje!' : `Você já usou suas ${MAX_TENTATIVAS} tentativas hoje.`;
      if (partida.venceu) return interaction.editReply({ content: status });
      return interaction.editReply({ content: status, files: [anexoGrid(partida.tentativas, palavraCerta)] });
    }
    return interaction.editReply({
      content: `Você já tentou \`${tentativa}\` hoje — essa não contou.`,
      files: [anexoGrid(partida.tentativas, palavraCerta)],
    });
  }

  const {
    tentativas: novasTentativas,
    num_tentativas: numTentativas,
    venceu,
    finalizado,
  } = rows[0];

  let status;
  if (venceu) status = `Você acertou em ${numTentativas}/${MAX_TENTATIVAS}!`;
  else if (finalizado) status = `Suas tentativas acabaram. A palavra era \`${palavraCerta}\`.`;
  else status = `Tentativa ${numTentativas} de ${MAX_TENTATIVAS}.`;

  if (venceu) {
    await interaction.editReply({ content: status });
  } else {
    await interaction.editReply({ content: status, files: [anexoGrid(novasTentativas, palavraCerta)] });
  }

  // Só o UPDATE que muda finalizado de false pra true retorna linha com finalizado = true,
  // então o aviso público sai exatamente uma vez. Sem grid: as cores entregariam dicas
  // pra quem ainda vai jogar (a palavra e os grids só são revelados no anúncio da meia-noite).
  if (finalizado && process.env.CANAL_TERMO) {
    const canal = await interaction.client.channels.fetch(process.env.CANAL_TERMO).catch(() => null);
    const content = venceu
      ? `✅ <@${userId}> acertou o Termo de hoje em ${numTentativas}/${MAX_TENTATIVAS}`
      : `❌ <@${userId}> não acertou o Termo de hoje`;
    await canal?.send({ content, allowedMentions: { parse: [] } });
  }
}
