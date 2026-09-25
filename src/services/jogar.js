// Lógica comum de /termo, /dueto e /quarteto: registra uma tentativa na partida do dia do modo.
import { AttachmentBuilder, MessageFlags } from 'discord.js';
import { pool } from '../db/pool.js';
import { upsertUsuario } from '../db/usuarios.js';
import { garantirPalavraDoDia } from './palavraDoDia.js';
import { MODOS, maxTentativas } from './modos.js';
import { estadoDaPartida } from './termoEngine.js';
import { validarPalavra } from './palavras.js';
import { renderPartida } from './renderTermo.js';
import { dataDeHoje } from '../utils/datas.js';

function anexoGrid(tentativas, palavras) {
  return new AttachmentBuilder(renderPartida(tentativas, palavras), { name: 'termo.png' });
}

const listarPalavras = (palavras) => palavras.map((p) => `\`${p}\``).join(', ');

export async function jogar(interaction, modo) {
  const { nome } = MODOS[modo];
  const doModo = modo === 'termo' ? '' : ` o ${nome}`; // "Você acertou o Dueto em..." / "Você acertou em..."

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { palavra: tentativa, erro } = validarPalavra(interaction.options.getString('palavra'));
  if (erro) return interaction.editReply(erro);

  // Apelido no servidor → nome global → @
  const nomeExibicao = interaction.member?.displayName ?? interaction.user.displayName;
  await upsertUsuario(interaction.user.id, interaction.user.username, nomeExibicao);
  const dia = await garantirPalavraDoDia(dataDeHoje(), modo);
  const { palavras } = dia;
  const MAX_TENTATIVAS = maxTentativas(palavras.length);

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
      if (partida.venceu) return interaction.editReply({ content: `Você já venceu${doModo} hoje!` });
      return interaction.editReply({
        content: `Você já usou suas ${MAX_TENTATIVAS} tentativas${doModo} hoje.`,
        files: [anexoGrid(partida.tentativas, palavras)],
      });
    }
    return interaction.editReply({
      content: `Você já tentou \`${tentativa}\` hoje — essa não contou.`,
      files: [anexoGrid(partida.tentativas, palavras)],
    });
  }

  const { tentativas, num_tentativas: numTentativas, venceu, finalizado } = rows[0];

  let status;
  if (venceu) {
    status = `Você acertou${doModo} em ${numTentativas}/${MAX_TENTATIVAS}!`;
  } else if (finalizado) {
    status = palavras.length === 1
      ? `Suas tentativas acabaram. A palavra era ${listarPalavras(palavras)}.`
      : `Suas tentativas acabaram. As palavras eram ${listarPalavras(palavras)}.`;
  } else {
    status = `Tentativa ${numTentativas} de ${MAX_TENTATIVAS}.`;
    if (palavras.length > 1) {
      const acertadas = estadoDaPartida(tentativas, palavras).resolvidaEm.filter((n) => n !== null).length;
      status += ` ${acertadas}/${palavras.length} palavras acertadas.`;
    }
  }

  if (venceu) {
    await interaction.editReply({ content: status });
  } else {
    await interaction.editReply({ content: status, files: [anexoGrid(tentativas, palavras)] });
  }

  // Só o UPDATE que muda finalizado de false pra true retorna linha com finalizado = true,
  // então o aviso público sai exatamente uma vez. Sem grid: as cores entregariam dicas
  // pra quem ainda vai jogar (as palavras só são reveladas no anúncio da meia-noite).
  if (finalizado && process.env.CANAL_TERMO) {
    const canal = await interaction.client.channels.fetch(process.env.CANAL_TERMO).catch(() => null);
    const content = venceu
      ? `✅ <@${userId}> acertou o ${nome} de hoje em ${numTentativas}/${MAX_TENTATIVAS}`
      : `❌ <@${userId}> não acertou o ${nome} de hoje`;
    await canal?.send({ content, allowedMentions: { parse: [] } });
  }
}
