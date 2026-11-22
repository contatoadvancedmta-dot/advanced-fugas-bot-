/**
 * SISTEMA DE FUGAS — perfis, eventos Polícia x Fugitivos, desafios X1, clipes e ranking
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, MessageFlags, AttachmentBuilder
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { withBanner } = require('../utils/banner');
const { sendLog } = require('../utils/logger');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const P = () => config.fugas.points;
const TEAMS = {
  policia: { label: 'Polícia', emoji: '🚓', style: ButtonStyle.Primary },
  fugitivo: { label: 'Fugitivo', emoji: '🏃', style: ButtonStyle.Danger }
};

/* ───────────── Perfis ───────────── */

function store(guildId) {
  const g = db.guild(guildId);
  g.players ??= {};
  g.events ??= {};
  g.eventCounter ??= 0;
  g.duels ??= {};
  g.duelCounter ??= 0;
  g.clips ??= {};
  g.clipCounter ??= 0;
  return g;
}

function player(guildId, userId) {
  const g = store(guildId);
  g.players[userId] ??= { nick: null, points: 0, wins: { policia: 0, fugitivo: 0 }, losses: { policia: 0, fugitivo: 0 }, x1: { w: 0, l: 0 }, events: 0, clips: 0 };
  return g.players[userId];
}

function addResult(guildId, userId, team, won, pts) {
  const p = player(guildId, userId);
  if (team) (won ? p.wins : p.losses)[team]++;
  p.points += pts;
  db.save();
}

function profileEmbed(guild, user) {
  const p = player(guild.id, user.id);
  const wins = p.wins.policia + p.wins.fugitivo;
  const games = wins + p.losses.policia + p.losses.fugitivo;
  const rate = games ? Math.round((wins / games) * 100) : 0;
  const pos = ranking(guild.id, 'geral').findIndex(([id]) => id === user.id) + 1;
  const lvl = db.guild(guild.id).xp?.[user.id]?.level ?? 0;
  const embed = base()
    .setAuthor({ name: `Perfil • ${user.username}`, iconURL: user.displayAvatarURL() })
    .setTitle(`${e.car} ${p.nick ?? user.username}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(`${p.nick ? `${e.user} Nick no MTA: **${p.nick}**` : `${e.warn} Nick do MTA não registrado — use \`/registrar\``}\n${line}`)
    .addFields(
      { name: `${e.trophy} Pontos`, value: `**${p.points}**${pos ? ` • #${pos} no ranking` : ''}`, inline: true },
      { name: `${e.level} Aproveitamento`, value: `**${rate}%** (${wins}V / ${games - wins}D)`, inline: true },
      { name: `${e.star} Nível no Discord`, value: `**${lvl}**`, inline: true },
      { name: `${TEAMS.policia.emoji} Como Polícia`, value: `${p.wins.policia} vitórias • ${p.losses.policia} derrotas`, inline: true },
      { name: `${TEAMS.fugitivo.emoji} Como Fugitivo`, value: `${p.wins.fugitivo} fugas • ${p.losses.fugitivo} capturas`, inline: true },
      { name: '⚔️ Desafios X1', value: `${p.x1.w} vitórias • ${p.x1.l} derrotas`, inline: true },
      { name: `${e.announce} Eventos jogados`, value: `${p.events}`, inline: true },
      { name: '🎬 Clipes enviados', value: `${p.clips}`, inline: true }
    );
  return withBanner({ embeds: [embed] }, embed, 'perfil');
}

/* ───────────── Ranking ───────────── */

function ranking(guildId, tipo) {
  const g = store(guildId);
  const score = {
    geral: (p) => p.points,
    policia: (p) => p.wins.policia,
    fugitivo: (p) => p.wins.fugitivo,
    x1: (p) => p.x1.w
  }[tipo];
  return Object.entries(g.players).map(([id, p]) => [id, p, score(p)]).filter(([, , s]) => s > 0).sort((a, b) => b[2] - a[2]);
}

function rankingEmbed(guild, tipo) {
  const medals = ['🥇', '🥈', '🥉'];
  const titles = { geral: 'Ranking geral', policia: `${TEAMS.policia.emoji} Melhores policiais`, fugitivo: `${TEAMS.fugitivo.emoji} Melhores fugitivos`, x1: '⚔️ Reis do X1', clips: '🎬 Clipes da semana' };
  const unit = { geral: 'pts', policia: 'vitórias', fugitivo: 'fugas', x1: 'vitórias' };
  let lines;
  if (tipo === 'clips') {
    const week = Date.now() - 7 * 864e5;
    lines = Object.values(store(guild.id).clips).filter((c) => c.at > week).sort((a, b) => b.votes.length - a.votes.length).slice(0, 10)
      .map((c, n) => `${medals[n] ?? `\`#${n + 1}\``} **${c.title}** — <@${c.userId}> • 🔥 ${c.votes.length}${c.url ? ` • [assistir](${c.url})` : ''}`);
  } else {
    lines = ranking(guild.id, tipo).slice(0, 10).map(([id, p, s], n) => `${medals[n] ?? `\`#${n + 1}\``} <@${id}>${p.nick ? ` (${p.nick})` : ''} ${e.arrow} **${s}** ${unit[tipo]}`);
  }
  const embed = base().setTitle(`${e.trophy} ${titles[tipo]} — ${config.brand.name}`)
    .setDescription(lines.join('\n') || 'Ninguém pontuou ainda. Bora pra fuga!')
    .setThumbnail(config.brand.logo);
  return withBanner({ embeds: [embed] }, embed, 'ranking');
}

/* ───────────── Eventos de fuga ───────────── */

function eventEmbed(ev) {
  const st = { aberto: `${e.approved} Inscrições abertas`, iniciado: `${e.alert} Em andamento`, finalizado: `${e.check} Finalizado`, cancelado: `${e.cross} Cancelado` }[ev.status];
  const list = (t) => ev.teams[t].map((id, n) => `\`${String(n + 1).padStart(2, '0')}\` <@${id}>`).join('\n') || '*ninguém ainda*';
  const embed = base()
    .setTitle(`${e.report} ${ev.title}`)
    .setDescription([
      ev.desc ? `${ev.desc}\n${line}` : line,
      `${e.clock} **Quando:** ${ts(ev.at, 'F')} (${ts(ev.at)})`,
      `${e.crown} **Organizador:** <@${ev.hostId}>`,
      `${e.info} **Status:** ${st}`,
      ev.winner ? `${e.trophy} **Vencedor:** ${TEAMS[ev.winner].emoji} **${TEAMS[ev.winner].label}**` : null,
      config.brand.connect ? `${e.car} **Conectar:** \`${config.brand.connect}\`` : null
    ].filter(Boolean).join('\n'))
    .addFields(
      { name: `${TEAMS.policia.emoji} Polícia (${ev.teams.policia.length}/${ev.slots.policia})`, value: list('policia').slice(0, 1024), inline: true },
      { name: `${TEAMS.fugitivo.emoji} Fugitivos (${ev.teams.fugitivo.length}/${ev.slots.fugitivo})`, value: list('fugitivo').slice(0, 1024), inline: true }
    );
  if (ev.bannerAttached) embed.setImage('attachment://evento.png');
  return embed;
}

function eventButtons(ev) {
  const open = ev.status === 'aberto';
  const done = ['finalizado', 'cancelado'].includes(ev.status);
  return [
    new ActionRowBuilder().addComponents(
      ...Object.entries(TEAMS).map(([k, t]) => new ButtonBuilder().setCustomId(`ev:join:${ev.id}:${k}`).setLabel(`${t.label} (${ev.teams[k].length}/${ev.slots[k]})`)
        .setEmoji(t.emoji).setStyle(t.style).setDisabled(!open || ev.teams[k].length >= ev.slots[k])),
      new ButtonBuilder().setCustomId(`ev:leave:${ev.id}`).setLabel('Sair').setStyle(ButtonStyle.Secondary).setDisabled(!open)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ev:start:${ev.id}`).setLabel('Iniciar').setEmoji(e.alert).setStyle(ButtonStyle.Success).setDisabled(!open),
      new ButtonBuilder().setCustomId(`ev:end:${ev.id}`).setLabel('Finalizar').setEmoji(e.trophy).setStyle(ButtonStyle.Secondary).setDisabled(done),
      new ButtonBuilder().setCustomId(`ev:cancel:${ev.id}`).setLabel('Cancelar').setEmoji(e.cross).setStyle(ButtonStyle.Secondary).setDisabled(done)
    )
  ];
}

async function createEvent(interaction, { title, at, desc, policia, fugitivo, channel }) {
  const g = store(interaction.guild.id);
  const ev = {
    id: ++g.eventCounter, title, at, desc, hostId: interaction.user.id, channelId: channel.id,
    slots: { policia, fugitivo }, teams: { policia: [], fugitivo: [] }, status: 'aberto', reminded: false, started: false
  };
  const embed = eventEmbed(ev);
  const payload = withBanner({ content: config.fugas.eventPing || undefined, embeds: [embed], components: eventButtons(ev), allowedMentions: { parse: ['everyone', 'roles'] } }, embed, 'evento');
  ev.bannerAttached = !!payload.files?.length;
  const msg = await channel.send(payload);
  ev.messageId = msg.id;
  g.events[ev.id] = ev;
  db.save();
  return { ev, msg };
}

async function refreshEvent(guild, ev) {
  const msg = await guild.channels.cache.get(ev.channelId)?.messages.fetch(ev.messageId).catch(() => null);
  await msg?.edit({ embeds: [eventEmbed(ev)], components: eventButtons(ev) }).catch(() => null);
}

const mentionTeams = (ev) => [...ev.teams.policia, ...ev.teams.fugitivo].map((id) => `<@${id}>`).join(' ');

/** Lembrete 10 min antes e aviso na hora (chamado a cada 30s) */
async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    const g = store(guild.id);
    for (const ev of Object.values(g.events)) {
      if (ev.status !== 'aberto') continue;
      const ch = guild.channels.cache.get(ev.channelId);
      if (!ch) continue;
      if (!ev.reminded && ev.at - Date.now() <= 10 * 6e4) {
        ev.reminded = true;
        db.save();
        await ch.send({ content: mentionTeams(ev) || undefined, embeds: [base().setDescription(`${e.clock} **${ev.title}** começa ${ts(ev.at)}! Já entra na cidade.${config.brand.connect ? `\n${e.car} \`${config.brand.connect}\`` : ''}`)] }).catch(() => null);
      }
      if (!ev.started && ev.at <= Date.now()) {
        ev.started = true;
        db.save();
        await ch.send({ content: mentionTeams(ev) || undefined, embeds: [base().setDescription(`${e.alert} **${ev.title}** — **É AGORA!** A staff vai iniciar a fuga.`)] }).catch(() => null);
      }
    }
  }
}

async function handleEvent(interaction) {
  const [, action, id, arg] = interaction.customId.split(':');
  const g = store(interaction.guild.id);
  const ev = g.events[id];
  if (!ev) return interaction.reply({ embeds: [error('Evento não encontrado.')], flags: EPH });
  const uid = interaction.user.id;

  if (action === 'join') {
    if (ev.status !== 'aberto') return interaction.reply({ embeds: [error('As inscrições estão fechadas.')], flags: EPH });
    const other = arg === 'policia' ? 'fugitivo' : 'policia';
    if (ev.teams[arg].includes(uid)) return interaction.reply({ embeds: [error(`Você já está na ${TEAMS[arg].label}.`)], flags: EPH });
    if (ev.teams[arg].length >= ev.slots[arg]) return interaction.reply({ embeds: [error('Esse time já está cheio.')], flags: EPH });
    ev.teams[other] = ev.teams[other].filter((x) => x !== uid);
    ev.teams[arg].push(uid);
    db.save();
    await interaction.update({ embeds: [eventEmbed(ev)], components: eventButtons(ev) });
    const nick = player(interaction.guild.id, uid).nick;
    return interaction.followUp({ embeds: [success(`Você entrou como ${TEAMS[arg].emoji} **${TEAMS[arg].label}**!${nick ? '' : `\n${e.warn} Registre seu nick do MTA com \`/registrar\`.`}`)], flags: EPH });
  }
  if (action === 'leave') {
    const before = ev.teams.policia.length + ev.teams.fugitivo.length;
    ev.teams.policia = ev.teams.policia.filter((x) => x !== uid);
    ev.teams.fugitivo = ev.teams.fugitivo.filter((x) => x !== uid);
    if (before === ev.teams.policia.length + ev.teams.fugitivo.length) return interaction.reply({ embeds: [error('Você não está inscrito.')], flags: EPH });
    db.save();
    return interaction.update({ embeds: [eventEmbed(ev)], components: eventButtons(ev) });
  }

  // Ações da staff
  if (!(await perms.check(interaction, 'suporte'))) return;
  if (action === 'start') {
    ev.status = 'iniciado';
    ev.started = true;
    db.save();
    await interaction.update({ embeds: [eventEmbed(ev)], components: eventButtons(ev) });
    return interaction.channel.send({ content: mentionTeams(ev) || undefined, embeds: [base().setDescription(`${e.alert} **${ev.title} COMEÇOU!** Boa fuga e boa caçada! ${TEAMS.policia.emoji}${TEAMS.fugitivo.emoji}`)] });
  }
  if (action === 'cancel') {
    ev.status = 'cancelado';
    db.save();
    await interaction.update({ embeds: [eventEmbed(ev)], components: eventButtons(ev) });
    return interaction.channel.send({ content: mentionTeams(ev) || undefined, embeds: [base().setDescription(`${e.cross} O evento **${ev.title}** foi cancelado.`)] });
  }
  if (action === 'end') {
    return interaction.reply({
      embeds: [base().setDescription(`${e.trophy} Quem venceu **${ev.title}**?`)],
      components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`ev:win:${ev.id}`).setPlaceholder('Time vencedor')
        .addOptions(Object.entries(TEAMS).map(([k, t]) => ({ label: t.label, value: k, emoji: t.emoji }))))],
      flags: EPH
    });
  }
  if (action === 'win') {
    if (ev.status === 'finalizado') return interaction.update({ embeds: [error('Esse evento já foi finalizado.')], components: [] });
    const winner = interaction.values[0];
    const loser = winner === 'policia' ? 'fugitivo' : 'policia';
    ev.status = 'finalizado';
    ev.winner = winner;
    for (const t of ['policia', 'fugitivo']) for (const u of ev.teams[t]) {
      player(interaction.guild.id, u).events++;
      addResult(interaction.guild.id, u, t, t === winner, t === winner ? P().eventWin : P().eventPlay);
    }
    db.save();
    await interaction.update({ embeds: [success(`Resultado registrado: ${TEAMS[winner].emoji} **${TEAMS[winner].label}** venceu.`)], components: [] });
    await refreshEvent(interaction.guild, ev);
    const ch = interaction.guild.channels.cache.get(ev.channelId);
    await ch?.send({
      content: ev.teams[winner].map((x) => `<@${x}>`).join(' ') || undefined,
      embeds: [base().setTitle(`${e.trophy} ${TEAMS[winner].emoji} ${TEAMS[winner].label.toUpperCase()} VENCEU!`)
        .setDescription(`**${ev.title}** terminou!\n${line}\n${e.star} Vencedores ganharam **+${P().eventWin} pts** • participantes **+${P().eventPlay} pt**\n${e.arrow} Veja o ranking com \`/ranking\``)]
    });
    sendLog(interaction.guild, base().setDescription(`${e.trophy} Evento **#${ev.id} ${ev.title}** finalizado por ${interaction.user} — venceu ${TEAMS[winner].label} (${ev.teams[winner].length} x ${ev.teams[loser].length})`));
  }
}

/* ───────────── Desafio X1 ───────────── */

function duelEmbed(d) {
  const st = {
    pendente: `${e.pending} Aguardando <@${d.targetId}> aceitar`,
    aceito: `${e.alert} Valendo! Depois da perseguição, marquem quem venceu`,
    recusado: `${e.cross} Recusado`,
    finalizado: `${e.trophy} Vencedor: <@${d.winnerId}>`
  }[d.status];
  const embed = base()
    .setTitle(`⚔️ Desafio X1 #${d.id}`)
    .setDescription(`<@${d.challengerId}> ${TEAMS[d.role].emoji} **${TEAMS[d.role].label}**\n**VS**\n<@${d.targetId}> ${TEAMS[d.role === 'policia' ? 'fugitivo' : 'policia'].emoji} **${TEAMS[d.role === 'policia' ? 'fugitivo' : 'policia'].label}**\n${line}\n${st}${d.claim && d.status === 'aceito' ? `\n${e.info} <@${d.claim.by}> disse que <@${d.claim.winner}> venceu — o outro jogador precisa confirmar.` : ''}${d.note ? `\n${e.log} ${d.note}` : ''}`);
  if (d.bannerAttached) embed.setImage('attachment://x1.png');
  return embed;
}

function duelButtons(d) {
  if (d.status === 'pendente') return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`x1:accept:${d.id}`).setLabel('Aceitar').setEmoji(e.check).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`x1:decline:${d.id}`).setLabel('Recusar').setEmoji(e.cross).setStyle(ButtonStyle.Danger))];
  if (d.status === 'aceito') return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`x1:win:${d.id}:${d.challengerId}`).setLabel(`${d.challengerName} venceu`).setEmoji(e.trophy).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`x1:win:${d.id}:${d.targetId}`).setLabel(`${d.targetName} venceu`).setEmoji(e.trophy).setStyle(ButtonStyle.Secondary))];
  return [];
}

async function createDuel(interaction, target, role) {
  const g = store(interaction.guild.id);
  const d = {
    id: ++g.duelCounter, challengerId: interaction.user.id, targetId: target.id, role, status: 'pendente', at: Date.now(),
    challengerName: interaction.user.username.slice(0, 30), targetName: target.username.slice(0, 30)
  };
  g.duels[d.id] = d;
  db.save();
  const embed = duelEmbed(d);
  const payload = withBanner({ content: `<@${target.id}>, você foi desafiado!`, embeds: [embed], components: duelButtons(d) }, embed, 'x1');
  d.bannerAttached = !!payload.files?.length;
  return payload;
}

async function handleDuel(interaction) {
  const [, action, id, arg] = interaction.customId.split(':');
  const d = store(interaction.guild.id).duels[id];
  if (!d) return interaction.reply({ embeds: [error('Desafio não encontrado.')], flags: EPH });
  const uid = interaction.user.id;
  const isPlayer = uid === d.challengerId || uid === d.targetId;
  const isStaff = perms.hasLevel(interaction.member, 'suporte');

  if (action === 'accept' || action === 'decline') {
    if (uid !== d.targetId) return interaction.reply({ embeds: [error('Só o desafiado pode responder.')], flags: EPH });
    if (d.status !== 'pendente') return interaction.reply({ embeds: [error('Esse desafio já foi respondido.')], flags: EPH });
    d.status = action === 'accept' ? 'aceito' : 'recusado';
    db.save();
    return interaction.update({ content: action === 'accept' ? `<@${d.challengerId}> <@${d.targetId}> — **Valendo!**` : null, embeds: [duelEmbed(d)], components: duelButtons(d) });
  }

  if (action === 'win') {
    if (d.status !== 'aceito') return interaction.reply({ embeds: [error('Esse desafio não está em andamento.')], flags: EPH });
    if (!isPlayer && !isStaff) return interaction.reply({ embeds: [error('Só os jogadores ou a staff podem marcar o resultado.')], flags: EPH });
    // staff decide na hora; jogadores precisam concordar
    if (isStaff && !isPlayer) {
      d.note = `Resultado definido pela staff (${interaction.user.username}).`;
    } else if (!d.claim || d.claim.by === uid || d.claim.winner !== arg) {
      d.claim = { by: uid, winner: arg };
      db.save();
      return interaction.update({ embeds: [duelEmbed(d)], components: duelButtons(d) });
    }
    d.status = 'finalizado';
    d.winnerId = arg;
    const loserId = arg === d.challengerId ? d.targetId : d.challengerId;
    const winnerRole = arg === d.challengerId ? d.role : d.role === 'policia' ? 'fugitivo' : 'policia';
    const gid = interaction.guild.id;
    player(gid, arg).x1.w++;
    player(gid, loserId).x1.l++;
    addResult(gid, arg, winnerRole, true, P().x1Win);
    addResult(gid, loserId, winnerRole === 'policia' ? 'fugitivo' : 'policia', false, 0);
    db.save();
    await interaction.update({ content: `<@${arg}> venceu o X1! ${e.trophy} **+${P().x1Win} pts**`, embeds: [duelEmbed(d)], components: [] });
  }
}

/* ───────────── Clipes ───────────── */

function clipEmbed(c) {
  const embed = base()
    .setAuthor({ name: `Clipe #${c.id} • ${c.username}`, iconURL: c.avatar })
    .setTitle(`🎬 ${c.title}`)
    .setDescription(`${c.url ? `${e.arrow} [Assistir clipe](${c.url})\n` : ''}${e.user} Enviado por <@${c.userId}> ${ts(c.at)}`)
    .addFields({ name: '🔥 Votos', value: `**${c.votes.length}**`, inline: true });
  if (c.file && /\.(png|jpe?g|gif|webp)$/i.test(c.file)) embed.setImage(`attachment://${c.file}`);
  return embed;
}

const clipButtons = (c) => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`clip:vote:${c.id}`).setLabel(`Brabo! (${c.votes.length})`).setEmoji('🔥').setStyle(ButtonStyle.Secondary),
  ...(c.url ? [new ButtonBuilder().setLabel('Assistir').setStyle(ButtonStyle.Link).setURL(c.url)] : []))];

async function createClip(interaction, { title, url, attachment }) {
  const g = store(interaction.guild.id);
  const ch = g.channels.clips && interaction.guild.channels.cache.get(g.channels.clips);
  if (!ch) throw new Error('O canal de clipes não foi configurado (`/setup canal` → Canal de clipes).');
  const c = { id: ++g.clipCounter, title, url, userId: interaction.user.id, username: interaction.user.username, avatar: interaction.user.displayAvatarURL(), at: Date.now(), votes: [] };
  const files = [];
  if (attachment) {
    if (attachment.size > 10 * 1024 * 1024) throw new Error('O arquivo passa de 10 MB. Envie um link (YouTube, Medal, TikTok...).');
    const buf = await fetch(attachment.url).then((r) => r.arrayBuffer());
    const ext = (attachment.name.split('.').pop() || 'mp4').toLowerCase();
    c.file = `clipe-${c.id}.${ext}`;
    files.push(new AttachmentBuilder(Buffer.from(buf), { name: c.file }));
  }
  const msg = await ch.send({ embeds: [clipEmbed(c)], components: clipButtons(c), files });
  c.channelId = ch.id;
  c.messageId = msg.id;
  g.clips[c.id] = c;
  player(interaction.guild.id, interaction.user.id).clips++;
  db.save();
  return msg;
}

async function handleClip(interaction) {
  const [, , id] = interaction.customId.split(':');
  const c = store(interaction.guild.id).clips[id];
  if (!c) return interaction.reply({ embeds: [error('Clipe não encontrado.')], flags: EPH });
  if (c.userId === interaction.user.id) return interaction.reply({ embeds: [error('Você não pode votar no próprio clipe 😅')], flags: EPH });
  const had = c.votes.includes(interaction.user.id);
  c.votes = had ? c.votes.filter((x) => x !== interaction.user.id) : [...c.votes, interaction.user.id];
  db.save();
  await interaction.update({ embeds: [clipEmbed(c)], components: clipButtons(c) });
}

module.exports = {
  TEAMS, player, profileEmbed, rankingEmbed, createEvent, handleEvent, createDuel, handleDuel, createClip, handleClip, tick, store
};
