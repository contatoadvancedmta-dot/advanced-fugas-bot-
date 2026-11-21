const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const { base, success, e } = require('../utils/embeds');

const CHANNELS = {
  sugestoes: 'Canal de sugestões',
  logs: 'Canal de logs',
  boasvindas: 'Canal de boas-vindas',
  saida: 'Canal de saída',
  tickets: 'Categoria dos tickets',
  anuncios: 'Canal de anúncios',
  whitelist: 'Canal de análise da whitelist (staff)',
  whitelistresultado: 'Canal de resultados da whitelist',
  status: 'Canal de status da cidade',
  levelup: 'Canal de avisos de nível',
  ticketlogs: 'Canal de logs/transcripts dos tickets',
  denuncias: 'Canal de denúncias (staff)',
  recursos: 'Canal de recursos de banimento (staff)',
  punicoes: 'Canal público de punições'
};
const ROLES = {
  autorole: 'Cargo automático ao entrar',
  verificado: 'Cargo dado ao se verificar',
  whitelist: 'Cargo de whitelist aprovada',
  staff: 'Cargo geral de staff',
  ...Object.fromEntries(Object.entries(config.levels).map(([k, v]) => [k, `Cargo de ${v.label}`]))
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Configura canais e cargos do bot')
    .addSubcommand((s) => s.setName('canal').setDescription('Define um canal')
      .addStringOption((o) => o.setName('tipo').setDescription('Tipo').setRequired(true)
        .addChoices(...Object.entries(CHANNELS).map(([value, name]) => ({ name, value }))))
      .addChannelOption((o) => o.setName('canal').setDescription('Canal ou categoria').setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildCategory)))
    .addSubcommand((s) => s.setName('cargo').setDescription('Define um cargo')
      .addStringOption((o) => o.setName('tipo').setDescription('Tipo').setRequired(true)
        .addChoices(...Object.entries(ROLES).map(([value, name]) => ({ name, value }))))
      .addRoleOption((o) => o.setName('cargo').setDescription('Cargo').setRequired(true)))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra a configuração atual')),

  async execute(interaction) {
    if (!(await perms.check(interaction, 'admin'))) return;
    const g = db.guild(interaction.guild.id);
    const sub = interaction.options.getSubcommand();
    const EPH = MessageFlags.Ephemeral;

    if (sub === 'canal') {
      const tipo = interaction.options.getString('tipo');
      const ch = interaction.options.getChannel('canal');
      g.channels[tipo] = ch.id; db.save();
      return interaction.reply({ embeds: [success(`**${CHANNELS[tipo]}** definido como ${ch}.`)], flags: EPH });
    }
    if (sub === 'cargo') {
      const tipo = interaction.options.getString('tipo');
      const role = interaction.options.getRole('cargo');
      g.roles[tipo] = role.id; db.save();
      return interaction.reply({ embeds: [success(`**${ROLES[tipo]}** definido como ${role}.`)], flags: EPH });
    }
    const fmt = (map, store, mention) => Object.entries(map)
      .map(([k, label]) => `${store[k] ? e.check : e.cross} ${label}: ${store[k] ? mention(store[k]) : '`não definido`'}`).join('\n');
    const embed = base().setTitle(`⚙️ Configuração — ${config.brand.name}`)
      .addFields(
        { name: 'Canais', value: fmt(CHANNELS, g.channels, (id) => `<#${id}>`) },
        { name: 'Cargos', value: fmt(ROLES, g.roles, (id) => `<@&${id}>`) }
      );
    return interaction.reply({ embeds: [embed], flags: EPH });
  }
};
