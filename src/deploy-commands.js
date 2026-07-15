import 'dotenv/config';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { REST, Routes } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  console.error('Faltam DISCORD_TOKEN, DISCORD_CLIENT_ID ou DISCORD_GUILD_ID no .env');
  process.exit(1);
}

const commands = [];
const commandsDir = join(__dirname, 'commands');
for (const file of readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const mod = await import(pathToFileURL(join(commandsDir, file)).href);
  if (mod.data) commands.push(mod.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  console.log(`Registrando ${commands.length} comando(s) na guild ${DISCORD_GUILD_ID}...`);
  const data = await rest.put(
    Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
    { body: commands },
  );
  console.log(`Pronto. ${data.length} comando(s) registrados.`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
