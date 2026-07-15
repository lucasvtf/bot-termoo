import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { registerCrons } from './cron/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDir = join(__dirname, 'commands');
for (const file of readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const mod = await import(pathToFileURL(join(commandsDir, file)).href);
  if (mod.data && mod.execute) {
    client.commands.set(mod.data.name, mod);
  } else {
    console.warn(`[commands] ${file} ignorado: faltam 'data' ou 'execute'`);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`Logado como ${c.user.tag}`);
  registerCrons(c);
});

client.on(Events.InteractionCreate, async (interaction) => {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (interaction.isAutocomplete()) {
    if (!command.autocomplete) return;
    try {
      await command.autocomplete(interaction);
    } catch (err) {
      console.error('autocomplete error:', err);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    try {
      const msg = { content: 'Deu ruim ao executar esse comando.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch (fallbackErr) {
      console.error('falha ao avisar o usuário do erro:', fallbackErr);
    }
  }
});

client.on(Events.Error, (err) => console.error('client error:', err));

client.login(process.env.DISCORD_TOKEN);
