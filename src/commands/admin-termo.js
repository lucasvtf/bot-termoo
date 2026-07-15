import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SlashCommandBuilder } from 'discord.js';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../utils/admin.js';
import { normalizar } from '../utils/normalizar.js';
import { TAMANHO_PALAVRA } from '../services/termoEngine.js';
import { rerolarPalavraDoDia, definirPalavraDoDia, banirPalavra, dataDeHoje } from '../services/palavraDoDia.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PALAVRAS_VALIDAS = new Set(
  JSON.parse(readFileSync(join(__dirname, '..', 'data', 'palavras-validas.json'), 'utf8')),
);

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

export async function execute(interaction) {
  if (!(await requireAdmin(interaction))) return;

  const sub = interaction.options.getSubcommand();

  if (sub === 'rerolar') {
    const hoje = dataDeHoje();
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM termo_partidas tp
         JOIN termo_dias td ON td.id = tp.dia_id
        WHERE td.data = $1 AND tp.finalizado = TRUE`,
      [hoje],
    );
    if (rows[0].total > 0) {
      return interaction.reply({
        content: `Não dá pra rerolar: ${rows[0].total} pessoa(s) já finalizaram a palavra de hoje.`,
        ephemeral: true,
      });
    }
    const dia = await rerolarPalavraDoDia(hoje);
    return interaction.reply({ content: `Nova palavra do dia sorteada (\`${dia.palavra}\`).`, ephemeral: true });
  }

  if (sub === 'definir-palavra') {
    const palavra = normalizar(interaction.options.getString('palavra'));
    if (palavra.length !== TAMANHO_PALAVRA || !/^[A-Z]+$/.test(palavra)) {
      return interaction.reply({ content: 'Palavra inválida — precisa ter 5 letras.', ephemeral: true });
    }
    if (!PALAVRAS_VALIDAS.has(palavra)) {
      return interaction.reply({ content: `\`${palavra}\` não está na lista de palavras válidas.`, ephemeral: true });
    }
    const dia = await definirPalavraDoDia(palavra, dataDeHoje());
    return interaction.reply({ content: `Palavra do dia definida como \`${dia.palavra}\`.`, ephemeral: true });
  }

  if (sub === 'banir-palavra') {
    const palavra = normalizar(interaction.options.getString('palavra'));
    if (palavra.length !== TAMANHO_PALAVRA || !/^[A-Z]+$/.test(palavra)) {
      return interaction.reply({ content: 'Palavra inválida — precisa ter 5 letras.', ephemeral: true });
    }

    await banirPalavra(palavra, interaction.user.id);

    const hoje = dataDeHoje();
    const { rows } = await pool.query(
      `SELECT td.palavra,
              EXISTS (
                SELECT 1 FROM termo_partidas tp WHERE tp.dia_id = td.id AND tp.finalizado = TRUE
              ) AS alguem_finalizou
         FROM termo_dias td
        WHERE td.data = $1`,
      [hoje],
    );
    const diaAtual = rows[0];

    if (diaAtual?.palavra === palavra && !diaAtual.alguem_finalizou) {
      const novoDia = await rerolarPalavraDoDia(hoje);
      return interaction.reply({
        content: `\`${palavra}\` banida do sorteio. Como era a palavra de hoje e ninguém tinha terminado, já sorteei outra: \`${novoDia.palavra}\`.`,
        ephemeral: true,
      });
    }

    return interaction.reply({ content: `\`${palavra}\` banida do sorteio de palavras futuras.`, ephemeral: true });
  }
}
