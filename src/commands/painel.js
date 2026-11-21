const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const perms = require('../utils/permissions');
const { success } = require('../utils/embeds');
const panels = require('../handlers/panels');
const tickets = require('../handlers/tickets');
const admin = require('../handlers/admin');
const whitelist = require('../handlers/whitelist');
const fivem = require('../handlers/fivem');

const TYPES = {
  sugestoes: () => panels.suggestionPanel(),
  tickets: () => tickets.panel(),
  verificacao: () => panels.verifyPanel(),
  regras: () => panels.rulesPanel(),
  staff: () => admin.panel(),
  whitelist: () => whitelist.panel(),
  status: async () => fivem.statusMessage(await fivem.fetchStatus())
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('🧩 Envia um painel com botões')
    .addStringOption((o) => o.setName('tipo').setDescription('Qual painel').setRequired(true).addChoices(
      { name: '💡 Sugestões', value: 'sugestoes' },
      { name: '🎫 Tickets', value: 'tickets' },
      { name: '✔️ Verificação', value: 'verificacao' },
      { name: '📜 Regras', value: 'regras' },
      { name: '📝 Whitelist', value: 'whitelist' },
      { name: '🖥️ Status da cidade', value: 'status' },
      { name: '👑 Gerenciador de staff (donos)', value: 'staff' }
    ))
    .addChannelOption((o) => o.setName('canal').setDescription('Onde enviar (padrão: aqui)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

  async execute(interaction) {
    const tipo = interaction.options.getString('tipo');
    if (!(await perms.check(interaction, tipo === 'staff' ? 'owner' : 'admin'))) return;
    const channel = interaction.options.getChannel('canal') ?? interaction.channel;
    await channel.send(await TYPES[tipo]());
    await interaction.reply({ embeds: [success(`Painel enviado em ${channel}.`)], flags: MessageFlags.Ephemeral });
  }
};
