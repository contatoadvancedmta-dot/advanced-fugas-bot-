const { SlashCommandBuilder, ChannelType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const perms = require('../utils/permissions');
const fugas = require('../handlers/fugas');
const { parseWhen } = require('../handlers/announce');
const { base, success, error, e } = require('../utils/embeds');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;

module.exports = [
  {
    data: new SlashCommandBuilder().setName('ip').setDescription('🚔 IP da cidade para entrar'),
    async execute(i) {
      const embed = base().setTitle(`${e.car} Entrar no ${config.brand.name}`)
        .setDescription(`Abra o **MTA:SA** e conecte em:\n\`\`\`${config.brand.connect ?? config.fivem.ip}\`\`\`\nOu clique no botão abaixo para abrir direto.`)
        .setThumbnail(config.brand.logo);
      const components = config.fivem.joinUrl ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Entrar na cidade').setEmoji(e.car).setStyle(ButtonStyle.Link).setURL(config.fivem.joinUrl),
        new ButtonBuilder().setLabel('Baixar MTA:SA').setStyle(ButtonStyle.Link).setURL('https://multitheftauto.com/'))] : [];
      await i.reply({ embeds: [embed], components });
    }
  },
  {
    data: new SlashCommandBuilder().setName('registrar').setDescription('🪪 Registra seu nick do MTA no seu perfil')
      .addStringOption((o) => o.setName('nick').setDescription('Seu nick dentro do jogo').setRequired(true).setMaxLength(32)),
    async execute(i) {
      const nick = i.options.getString('nick').replace(/#[0-9a-f]{6}/gi, '').trim();
      const taken = Object.entries(fugas.store(i.guild.id).players).find(([id, p]) => id !== i.user.id && p.nick?.toLowerCase() === nick.toLowerCase());
      if (taken) return i.reply({ embeds: [error(`O nick **${nick}** já está registrado por <@${taken[0]}>. Se for seu, abra um ticket.`)], flags: EPH });
      fugas.player(i.guild.id, i.user.id).nick = nick;
      db.save();
      let extra = '';
      if (config.fugas.setNickname && i.member.manageable) {
        await i.member.setNickname(nick.slice(0, 32)).catch(() => null);
        extra = '\nSeu apelido no Discord também foi atualizado.';
      }
      await i.reply({ embeds: [success(`Nick **${nick}** registrado no seu perfil!${extra}`, 'Registrado')], flags: EPH });
    }
  },
  {
    data: new SlashCommandBuilder().setName('perfil').setDescription('🪪 Perfil e estatísticas de fuga')
      .addUserOption((o) => o.setName('membro').setDescription('Ver perfil de outro membro')),
    async execute(i) {
      await i.reply(fugas.profileEmbed(i.guild, i.options.getUser('membro') ?? i.user));
    }
  },
  {
    data: new SlashCommandBuilder().setName('ranking').setDescription('🏆 Rankings da cidade')
      .addStringOption((o) => o.setName('tipo').setDescription('Qual ranking').addChoices(
        { name: '🏆 Geral (pontos)', value: 'geral' },
        { name: '🚓 Melhores policiais', value: 'policia' },
        { name: '🏃 Melhores fugitivos', value: 'fugitivo' },
        { name: '⚔️ Reis do X1', value: 'x1' },
        { name: '🎬 Clipes da semana', value: 'clips' })),
    async execute(i) {
      await i.reply(fugas.rankingEmbed(i.guild, i.options.getString('tipo') ?? 'geral'));
    }
  },
  {
    data: new SlashCommandBuilder().setName('evento').setDescription('🚨 Eventos de fuga (Polícia x Fugitivos)')
      .addSubcommand((s) => s.setName('criar').setDescription('Cria um evento com inscrição por botão')
        .addStringOption((o) => o.setName('titulo').setDescription('Ex: Fuga do Porto').setRequired(true).setMaxLength(80))
        .addStringOption((o) => o.setName('quando').setDescription('Ex: 21:30, 2h ou 25/12 20:00').setRequired(true))
        .addIntegerOption((o) => o.setName('vagas_policia').setDescription('Vagas para polícia (padrão 10)').setMinValue(1).setMaxValue(100))
        .addIntegerOption((o) => o.setName('vagas_fugitivo').setDescription('Vagas para fugitivos (padrão 10)').setMinValue(1).setMaxValue(100))
        .addStringOption((o) => o.setName('descricao').setDescription('Regras, rota, prêmio...').setMaxLength(1000))
        .addChannelOption((o) => o.setName('canal').setDescription('Canal (padrão: canal de eventos ou aqui)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
      .addSubcommand((s) => s.setName('lista').setDescription('Próximos eventos')),
    async execute(i) {
      const sub = i.options.getSubcommand();
      const g = fugas.store(i.guild.id);
      if (sub === 'lista') {
        const list = Object.values(g.events).filter((ev) => ['aberto', 'iniciado'].includes(ev.status)).sort((a, b) => a.at - b.at);
        return i.reply({ embeds: [base().setTitle(`${e.report} Próximos eventos`)
          .setDescription(list.map((ev) => `**${ev.title}** • ${ts(ev.at, 'f')} (${ts(ev.at)})\n${e.arrow} 🚓 ${ev.teams.policia.length}/${ev.slots.policia} • 🏃 ${ev.teams.fugitivo.length}/${ev.slots.fugitivo} • [inscrever](https://discord.com/channels/${i.guild.id}/${ev.channelId}/${ev.messageId})`).join('\n\n') || 'Nenhum evento marcado.')] });
      }
      if (!(await perms.check(i, 'moderador'))) return;
      const at = parseWhen(i.options.getString('quando'));
      if (!at || at <= Date.now()) return i.reply({ embeds: [error('Horário inválido. Use `21:30`, `2h` ou `25/12 20:00`.')], flags: EPH });
      const channel = i.options.getChannel('canal') ?? i.guild.channels.cache.get(g.channels.eventos) ?? i.channel;
      await i.deferReply({ flags: EPH });
      const { ev, msg } = await fugas.createEvent(i, {
        title: i.options.getString('titulo'), at, desc: i.options.getString('descricao'),
        policia: i.options.getInteger('vagas_policia') ?? 10, fugitivo: i.options.getInteger('vagas_fugitivo') ?? 10, channel
      });
      await i.editReply({ embeds: [success(`Evento **#${ev.id}** criado em ${channel}. Lembrete automático 10 min antes. [Ver](${msg.url})`)] });
    }
  },
  {
    data: new SlashCommandBuilder().setName('desafio').setDescription('⚔️ Desafie alguém para um X1 de perseguição')
      .addUserOption((o) => o.setName('membro').setDescription('Quem você quer desafiar').setRequired(true))
      .addStringOption((o) => o.setName('voce_sera').setDescription('Seu papel').setRequired(true).addChoices(
        { name: '🚓 Polícia (eu caço)', value: 'policia' }, { name: '🏃 Fugitivo (eu fujo)', value: 'fugitivo' })),
    async execute(i) {
      const target = i.options.getUser('membro');
      if (target.bot || target.id === i.user.id) return i.reply({ embeds: [error('Escolha outro jogador.')], flags: EPH });
      await i.reply(await fugas.createDuel(i, target, i.options.getString('voce_sera')));
    }
  },
  {
    data: new SlashCommandBuilder().setName('clip').setDescription('🎬 Envie o clipe da sua melhor fuga ou captura')
      .addStringOption((o) => o.setName('titulo').setDescription('Ex: Fuga insana pela ponte').setRequired(true).setMaxLength(80))
      .addStringOption((o) => o.setName('link').setDescription('Link do YouTube, Medal, TikTok, Twitch...'))
      .addAttachmentOption((o) => o.setName('arquivo').setDescription('Ou envie o vídeo/print (até 10 MB)')),
    async execute(i) {
      const url = i.options.getString('link')?.trim() || null;
      const attachment = i.options.getAttachment('arquivo');
      if (!url && !attachment) return i.reply({ embeds: [error('Mande um **link** ou um **arquivo**.')], flags: EPH });
      if (url && !/^https?:\/\/\S+$/.test(url)) return i.reply({ embeds: [error('Link inválido. Precisa começar com https://')], flags: EPH });
      await i.deferReply({ flags: EPH });
      try {
        const msg = await fugas.createClip(i, { title: i.options.getString('titulo'), url, attachment });
        await i.editReply({ embeds: [success(`Clipe enviado! A galera já pode votar 🔥 [Ver](${msg.url})`)] });
      } catch (err) {
        await i.editReply({ embeds: [error(err.message)] });
      }
    }
  }
];
