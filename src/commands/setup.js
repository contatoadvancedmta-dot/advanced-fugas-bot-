const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const { base, success, e } = require('../utils/embeds');

// Seções do /setup (cada uma vira um subcomando)
const SECTIONS = {
  canal: {
    title: '📁 Canais gerais',
    items: {
      sugestoes: 'Sugestões da comunidade',
      boasvindas: 'Boas-vindas',
      saida: 'Saída de membros',
      anuncios: 'Anúncios',
      eventos: 'Eventos de fuga',
      clips: 'Clipes (melhores fugas)',
      levelup: 'Avisos de nível',
      punicoes: 'Punições (público)',
      tickets: 'Categoria dos tickets',
      whitelistresultado: 'Resultados da whitelist'
    }
  },
  staff: {
    title: '🛠️ Canais da staff (trancados)',
    items: {
      sugestoes_staff: 'Sugestões da staff',
      logs: 'Logs gerais',
      ticketlogs: 'Logs/transcripts dos tickets',
      denuncias: 'Denúncias',
      recursos: 'Recursos de banimento',
      whitelist: 'Análise da whitelist'
    }
  },
  ranking: {
    title: '🏆 Rankings (atualizam sozinhos)',
    items: {
      ranking_tickets: 'Ranking de tickets (quem mais assumiu)',
      ranking_apoiadores: 'Ranking de apoiadores',
      ranking_fugas: 'Ranking das fugas',
      rankings: 'Todos os rankings juntos'
    }
  },
  cidade: {
    title: '🚔 Cidade',
    items: {
      status: 'Status da cidade (atualiza sozinho)',
      contador: 'Contador de jogadores (voz)',
      contadormembros: 'Contador de membros (voz)'
    }
  }
};
const CHANNELS = Object.assign({}, ...Object.values(SECTIONS).map((sec) => sec.items));
const TYPES_FOR = {
  canal: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildCategory],
  staff: [ChannelType.GuildText],
  ranking: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
  cidade: [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice]
};

/** Tranca um canal para só a staff (e o bot) ver */
async function lockToStaff(interaction, ch, g) {
  const staffRoles = [...Object.keys(config.levels), 'staff'].map((k) => g.roles[k]).filter(Boolean);
  await ch.permissionOverwrites.edit(interaction.guild.roles.everyone, { ViewChannel: false }).catch(() => null);
  await ch.permissionOverwrites.edit(interaction.client.user.id, { ViewChannel: true, SendMessages: true, EmbedLinks: true, AttachFiles: true, CreatePublicThreads: true, SendMessagesInThreads: true, ReadMessageHistory: true }).catch(() => null);
  for (const r of staffRoles) await ch.permissionOverwrites.edit(r, { ViewChannel: true, ReadMessageHistory: true, SendMessagesInThreads: true }).catch(() => null);
  return staffRoles;
}

const ROLES = {
  autorole: 'Cargo automático ao entrar',
  verificado: 'Cargo dado ao se verificar',
  whitelist: 'Cargo de whitelist aprovada',
  staff: 'Cargo geral de staff',
  ...Object.fromEntries(Object.entries(config.levels).map(([k, v]) => [k, `Cargo de ${v.label}`]))
};

function channelSub(s, name, description) {
  return s.setName(name).setDescription(description)
    .addStringOption((o) => o.setName('tipo').setDescription('O que configurar').setRequired(true)
      .addChoices(...Object.entries(SECTIONS[name].items).map(([value, label]) => ({ name: label, value }))))
    .addChannelOption((o) => o.setName('canal').setDescription('Canal').setRequired(true).addChannelTypes(...TYPES_FOR[name]));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Configura canais e cargos do bot')
    .addSubcommand((s) => channelSub(s, 'canal', 'Define um canal geral (sugestões, boas-vindas, eventos...)'))
    .addSubcommand((s) => channelSub(s, 'staff', 'Define um canal da equipe — tranca para só a staff ver')
      .addBooleanOption((o) => o.setName('trancar').setDescription('Trancar o canal para só a staff ver (padrão: sim)')))
    .addSubcommand((s) => channelSub(s, 'ranking', 'Define o canal de cada ranking'))
    .addSubcommand((s) => channelSub(s, 'cidade', 'Status da cidade e contadores'))
    .addSubcommand((s) => s.setName('cargo').setDescription('Define um cargo')
      .addStringOption((o) => o.setName('tipo').setDescription('Tipo').setRequired(true)
        .addChoices(...Object.entries(ROLES).map(([value, name]) => ({ name, value }))))
      .addRoleOption((o) => o.setName('cargo').setDescription('Cargo').setRequired(true)))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra a configuração atual'))
    .addSubcommand((s) => s.setName('contador').setDescription('Cria os contadores de jogadores e membros no topo do servidor')),

  async execute(interaction) {
    if (!(await perms.check(interaction, 'admin'))) return;
    const g = db.guild(interaction.guild.id);
    const sub = interaction.options.getSubcommand();

    if (sub === 'contador') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const status = config.fivem.ip ? await require('../handlers/fivem').fetchStatus() : null;
      const created = await require('../handlers/counters').create(interaction.guild, status);
      return interaction.editReply({ embeds: [success(`Contadores criados no topo do servidor:\n${created.map((c) => `${e.arrow} ${c}`).join('\n')}\n\nEles se atualizam sozinhos (o Discord permite renomear a cada ~5 min).`, 'Contadores criados')] });
    }
    const EPH = MessageFlags.Ephemeral;

    if (SECTIONS[sub]) {
      const tipo = interaction.options.getString('tipo');
      const ch = interaction.options.getChannel('canal');
      g.channels[tipo] = ch.id; db.save();
      const notes = [];

      if (sub === 'staff' && interaction.options.getBoolean('trancar') !== false && ch.permissionOverwrites) {
        const roles = await lockToStaff(interaction, ch, g);
        notes.push(`${e.lock} Canal trancado: só ${roles.length ? roles.map((r) => `<@&${r}>`).join(', ') : 'quem é admin'} vê.`);
        if (!roles.length) notes.push(`${e.warn} Nenhum cargo de staff configurado — use \`/setup cargo\` (Suporte, Moderador, Admin) e rode de novo.`);
      }
      if (tipo === 'sugestoes_staff') {
        await ch.send(require('../handlers/suggestions').staffPanel()).catch(() => null);
        notes.push(`${e.check} Painel com o botão **Enviar sugestão** foi enviado lá.`);
      }
      if (sub === 'ranking') {
        require('../handlers/rankingBoard').update(interaction.client).catch(() => null);
        notes.push(`${e.check} Ranking postado — atualiza sozinho.`);
      }
      if (tipo === 'status') {
        g.status = {};
        db.save();
        require('../handlers/fivem').tick(interaction.client).catch(() => null);
        notes.push(`${e.check} Status postado — atualiza a cada minuto.`);
      }
      return interaction.reply({ embeds: [success(`**${CHANNELS[tipo]}** → ${ch}${notes.length ? `\n${notes.join('\n')}` : ''}`, 'Configurado')], flags: EPH });
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
      .setDescription(`Use \`/setup canal\`, \`/setup staff\`, \`/setup ranking\`, \`/setup cidade\` e \`/setup cargo\`.`)
      .addFields(
        ...Object.entries(SECTIONS).map(([k, sec]) => ({ name: `${sec.title} — /setup ${k}`, value: fmt(sec.items, g.channels, (id) => `<#${id}>`).slice(0, 1024) })),
        { name: '👥 Cargos — /setup cargo', value: fmt(ROLES, g.roles, (id) => `<@&${id}>`).slice(0, 1024) }
      );
    return interaction.reply({ embeds: [embed], flags: EPH });
  }
};
