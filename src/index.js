const fs = require('node:fs');
const path = require('node:path');
// procura o .env na pasta atual, na pasta do projeto e na raiz do servidor (hospedagens)
require('dotenv').config({
  path: [process.cwd(), path.join(__dirname, '..'), path.join(__dirname, '..', '..')].map((d) => path.join(d, '.env')).filter((p) => fs.existsSync(p)),
  quiet: true
});
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN não encontrado. Crie o arquivo .env com DISCORD_TOKEN, CLIENT_ID e GUILD_ID.');
  process.exit(1);
}
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

client.commands = new Collection();
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter((f) => f.endsWith('.js'))) {
  const mod = require(`./commands/${file}`);
  for (const cmd of [].concat(mod)) client.commands.set(cmd.data.name, cmd);
}

for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter((f) => f.endsWith('.js'))) {
  const ev = require(`./events/${file}`);
  const run = (...args) => ev.execute(...args, client);
  ev.once ? client.once(ev.name, run) : client.on(ev.name, run);
}

process.on('unhandledRejection', (err) => console.error('[Erro]', err));
client.login(process.env.DISCORD_TOKEN);
