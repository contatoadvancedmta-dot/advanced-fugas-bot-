/**
 * CLÃS — registro (pelo ticket ou pela Central), tag/cargo do clã, painel do líder,
 * desafios X-Clã com aceitar/recusar, lembrete, resultado e ranking.
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, UserSelectMenuBuilder, ModalBuilder,
  LabelBuilder, TextInputBuilder, TextInputStyle, ChannelType, MessageFlags
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { withBanner } = require('../utils/banner');
const { sendLog } = require('../utils/logger');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const cfg = () => config.clas ?? {};
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const btn = (id, label, emoji, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function store(guildId) {
  const g = db.guild(guildId);
  g.clas ??= {};
  g.xcla ??= { counter: 0, items: {} };
  return g;
}
const clans = (gid) => store(gid).clas;
const find = (gid, q) => clans(gid)[q] ?? Object.values(clans(gid)).find((c) => norm(c.sigla) === norm(q) || norm(c.nome) === norm(q));
const clanOf = (gid, uid) => Object.values(clans(gid)).find((c) => c.membros.includes(uid));
const ledBy = (gid, uid) => Object.values(clans(gid)).find((c) => c.liderId === uid);
const isStaff = (member) => perms.hasLevel(member, 'suporte');

/* ───────────── Cores ───────────── */
const COLORS = [
  ['vermelho', 'Vermelho', '#e53935', '🔴'], ['vinho', 'Vinho', '#8e1c2e', '🍷'], ['laranja', 'Laranja', '#f97316', '🟠'],
  ['amarelo', 'Amarelo', '#facc15', '🟡'], ['dourado', 'Dourado', '#d4a017', '🏆'], ['verde', 'Verde', '#22c55e', '🟢'],
  ['limao', 'Verde-limão', '#a3e635', '🍏'], ['ciano', 'Ciano', '#22d3ee', '🩵'], ['azul', 'Azul', '#3b82f6', '🔵'],
  ['marinho', 'Azul-marinho', '#1e3a8a', '🌊'], ['roxo', 'Roxo', '#8b5cf6', '🟣'], ['rosa', 'Rosa', '#f472b6', '🌸'],
  ['marrom', 'Marrom', '#92400e', '🟤'], ['branco', 'Branco', '#f5f5f5', '⚪'], ['cinza', 'Cinza', '#9ca3af', '🩶'], ['preto', 'Preto', '#1f1f1f', '⚫']
];
const hexToInt = (h) => parseInt(String(h).replace('#', ''), 16);
const colorName = (hex) => COLORS.find((c) => c[2] === hex)?.[1] ?? hex;
const colorOptions = (current, extra = []) => [
  ...extra,
  ...COLORS.map(([value, label, hex, emoji]) => ({ label, value: hex, emoji, description: hex, default: hex === current })),
  { label: 'Outra cor (digitar o código)', value: 'custom', emoji: '🎨', description: 'Ex: #ff6600' }
].slice(0, 25);

/** Muda a cor do clã (cargo + embeds). Retorna { text } ou { error } */
async function setColor(guild, c, hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return { error: 'Cor inválida. Use o formato **#RRGGBB**, ex: `#ff6600`.' };
  c.color = hex.toLowerCase();
  db.save();
  const role = c.roleId && (guild.roles.cache.get(c.roleId) ?? (await guild.roles.fetch(c.roleId).catch(() => null)));
  if (!role) return { text: `Cor do clã salva: **${colorName(c.color)}**. (O clã não tem cargo para pintar.)` };
  const ok = await role.setColors({ primaryColor: hexToInt(c.color) }, 'Cor do clã').then(() => true).catch(() => false);
  return ok ? { text: `Cor do clã **[${c.sigla}]** agora é **${colorName(c.color)}** (\`${c.color}\`).` }
    : { error: 'Não consegui mudar a cor do cargo — o cargo do bot precisa ficar **acima** do cargo do clã.' };
}

const colorModal = (id, by = 'cla') => new ModalBuilder().setCustomId(`${by}:colorm:${id}`).setTitle('Cor do clã').addLabelComponents(
  new LabelBuilder().setLabel('Código da cor').setDescription('Formato #RRGGBB — pegue em google.com/search?q=color+picker')
    .setTextInputComponent(new TextInputBuilder().setCustomId('hex').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(6).setMaxLength(7).setPlaceholder('#ff6600')));

/* ───────────── Registro / membros ───────────── */

/** Procura um cargo que já seja do clã (pelo nome, sigla ou "[SIGLA] Nome") */
function findRole(guild, nome, sigla) {
  const wanted = [norm(nome), norm(sigla), norm(`[${sigla}] ${nome}`), norm(`${sigla} ${nome}`)];
  return guild.roles.cache.find((r) => wanted.includes(norm(r.name)));
}

async function create(guild, by, { nome, sigla, liderId, createChannel = false, color = null }) {
  const g = store(guild.id);
  nome = String(nome ?? '').trim();
  sigla = String(sigla ?? '').trim().toUpperCase();
  const id = slug(nome);
  if (!id || !sigla || !liderId) return { error: 'Preencha nome, sigla e líder.' };
  if (g.clas[id] || find(guild.id, sigla)) return { error: 'Já existe um clã com esse nome ou sigla.' };
  const other = clanOf(guild.id, liderId);
  if (other) return { error: `<@${liderId}> já é do clã **[${other.sigla}] ${other.nome}**. Remova ele de lá antes.` };

  // cargo do clã: usa o que já existe ou cria
  let role = findRole(guild, nome, sigla);
  let roleCreated = false;
  if (!role) {
    role = await guild.roles.create({ name: nome, mentionable: true, hoist: !!cfg().hoistRoles, reason: `Clã registrado por ${by.tag ?? by.id}` }).catch(() => null);
    roleCreated = !!role;
  }
  // canal do clã (opcional) dentro da categoria de clãs
  let channel = null;
  if (createChannel) {
    channel = await guild.channels.create({
      name: `${cfg().channelPrefix ?? '🏁・'}${slug(nome)}`,
      type: ChannelType.GuildText,
      parent: g.channels.clas_categoria || null,
      reason: `Canal do clã ${nome}`
    }).catch(() => null);
  }
  const c = { id, nome, sigla, liderId, membros: [liderId], roleId: role?.id ?? null, roleCreated, channelId: channel?.id ?? null, color: null, wins: 0, losses: 0, createdAt: Date.now(), by: by.id };
  g.clas[id] = c;
  db.save();
  if (color && /^#[0-9a-f]{6}$/i.test(color)) await setColor(guild, c, color);

  const member = await guild.members.fetch(liderId).catch(() => null);
  if (c.roleId) await member?.roles.add(c.roleId, `Líder do clã ${nome}`).catch(() => null);
  if (g.roles.lider_cla) await member?.roles.add(g.roles.lider_cla, `Líder do clã ${nome}`).catch(() => null);
  sendLog(guild, base().setDescription(`🏴 Clã **[${sigla}] ${nome}** registrado por <@${by.id}> • líder <@${liderId}>${roleCreated ? ' • cargo criado' : role ? ' • cargo existente usado' : ''}`));
  require('./rankingBoard').touch(guild.client);
  return { c, role, roleCreated, channel };
}

async function setMember(guild, c, userId, add) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (add) {
    if (member?.user.bot) return { error: 'Bots não entram em clã.' };
    if (c.membros.includes(userId)) return { error: `<@${userId}> já é do clã.` };
    const other = clanOf(guild.id, userId);
    if (other) return { error: `<@${userId}> já é do clã **[${other.sigla}]**.` };
    if (cfg().maxMembers && c.membros.length >= cfg().maxMembers) return { error: `O clã já tem o limite de ${cfg().maxMembers} membros.` };
    c.membros.push(userId);
    if (c.roleId) await member?.roles.add(c.roleId, `Entrou no clã ${c.nome}`).catch(() => null);
  } else {
    if (userId === c.liderId) return { error: 'O líder não pode ser removido. Troque o líder antes.' };
    if (!c.membros.includes(userId)) return { error: `<@${userId}> não é do clã.` };
    c.membros = c.membros.filter((x) => x !== userId);
    if (c.roleId) await member?.roles.remove(c.roleId, `Saiu do clã ${c.nome}`).catch(() => null);
  }
  db.save();
  require('./rankingBoard').touch(guild.client);
  return { text: `<@${userId}> ${add ? 'recebeu a tag' : 'perdeu a tag'} **[${c.sigla}] ${c.nome}**.` };
}

async function setLeader(guild, c, newId) {
  const g = store(guild.id);
  if (newId !== c.liderId) {
    const other = clanOf(guild.id, newId);
    if (other && other.id !== c.id) return { error: `<@${newId}> é de outro clã (**[${other.sigla}]**).` };
  }
  const oldId = c.liderId;
  c.liderId = newId;
  // o antigo líder perde o cargo de Líder de clã (se não liderar outro clã)
  if (g.roles.lider_cla && oldId !== newId && !ledBy(guild.id, oldId)) {
    await (await guild.members.fetch(oldId).catch(() => null))?.roles.remove(g.roles.lider_cla).catch(() => null);
  }
  if (!c.membros.includes(newId)) await setMember(guild, c, newId, true);
  const nw = await guild.members.fetch(newId).catch(() => null);
  if (g.roles.lider_cla) await nw?.roles.add(g.roles.lider_cla).catch(() => null);
  db.save();
  require('./rankingBoard').touch(guild.client);
  return { text: `<@${newId}> agora é o líder do **[${c.sigla}] ${c.nome}**.` };
}

async function remove(guild, c) {
  const g = store(guild.id);
  const lider = await guild.members.fetch(c.liderId).catch(() => null);
  if (g.roles.lider_cla) await lider?.roles.remove(g.roles.lider_cla).catch(() => null);
  if (c.roleId) {
    if (c.roleCreated) await guild.roles.delete(c.roleId).catch(() => null);
    else for (const uid of c.membros) await (await guild.members.fetch(uid).catch(() => null))?.roles.remove(c.roleId).catch(() => null);
  }
  delete g.clas[c.id];
  db.save();
  require('./rankingBoard').touch(guild.client);
}

/* ───────────── Visualização ───────────── */

function infoEmbed(c) {
  const games = c.wins + c.losses;
  return base(c.color ? hexToInt(c.color) : undefined, !!c.color).setTitle(`🏴 [${c.sigla}] ${c.nome}`)
    .setDescription(`${c.roleId ? `Tag: <@&${c.roleId}>` : 'Sem cargo'}${c.channelId ? ` • <#${c.channelId}>` : ''}\n${line}`)
    .addFields(
      { name: `${e.crown} Líder`, value: `<@${c.liderId}>`, inline: true },
      { name: `${e.user} Membros`, value: `**${c.membros.length}**${cfg().maxMembers ? `/${cfg().maxMembers}` : ''}`, inline: true },
      { name: `${e.trophy} X-Clã`, value: `**${c.wins}V / ${c.losses}D**${games ? ` • ${Math.round((c.wins / games) * 100)}%` : ''}`, inline: true },
      { name: '🎨 Cor', value: c.color ? `${colorName(c.color)} \`${c.color}\`` : 'padrão', inline: true },
      { name: 'Integrantes', value: c.membros.slice(0, 40).map((id) => `${id === c.liderId ? e.crown : e.dot} <@${id}>`).join('\n').slice(0, 1024) || '—' }
    );
}

function listEmbed(guild) {
  const all = Object.values(clans(guild.id)).sort((a, b) => b.wins - a.wins || b.membros.length - a.membros.length);
  const embed = base().setTitle(`🏴 Clãs — ${config.brand.name}`)
    .setDescription(all.length ? all.map((c) => `**[${c.sigla}] ${c.nome}** — líder <@${c.liderId}>\n${e.dot} ${c.membros.length} membros • X-Clã ${c.wins}V/${c.losses}D${c.roleId ? ` • <@&${c.roleId}>` : ''}`).join('\n\n').slice(0, 4000) : 'Nenhum clã registrado ainda.');
  return withBanner({ embeds: [embed] }, embed, 'ranking');
}

function rankingEmbed(guild) {
  const medals = ['🥇', '🥈', '🥉'];
  const all = Object.values(clans(guild.id)).filter((c) => c.wins + c.losses > 0)
    .sort((a, b) => b.wins - a.wins || (a.losses - b.losses));
  const embed = base().setTitle(`${e.trophy} Ranking de clãs — X-Clã`)
    .setDescription(all.length ? all.slice(0, 15).map((c, n) => `${medals[n] ?? `\`#${n + 1}\``} **[${c.sigla}] ${c.nome}** ${e.arrow} **${c.wins}** vitórias • ${c.losses} derrotas`).join('\n') : 'Nenhum X-Clã finalizado ainda.');
  return withBanner({ embeds: [embed] }, embed, 'ranking');
}

function leaderPanel() {
  const embed = base().setTitle(`🏴 Painel do Líder — ${config.brand.name}`)
    .setDescription([
      'Área dos **líderes de clã**. Tudo por botão:',
      line,
      `${e.user} **Gerenciar meu clã** — dar e tirar a tag dos membros`,
      `⚔️ **Marcar X-Clã** — desafie outro clã com data e hora`,
      `🏴 **Ver clãs** — todos os clãs e a pontuação`,
      line,
      `${e.info} Ainda não tem clã registrado? Abra um **ticket de Clãs**.`
    ].join('\n'));
  return withBanner({ embeds: [embed], components: [row(
    btn('cla:me', 'Gerenciar meu clã', e.user, ButtonStyle.Primary),
    btn('cla:x', 'Marcar X-Clã', '⚔️', ButtonStyle.Danger),
    btn('cla:list', 'Ver clãs', '🏴'))] }, embed, 'staff');
}

function manageView(c, note) {
  const embeds = [infoEmbed(c)];
  if (note) embeds.unshift(base().setDescription(note.slice(0, 4000)));
  return { embeds, components: [
    row(new UserSelectMenuBuilder().setCustomId(`cla:add:${c.id}`).setPlaceholder('➕ Dar a tag do clã (até 10)').setMaxValues(10)),
    row(new UserSelectMenuBuilder().setCustomId(`cla:rem:${c.id}`).setPlaceholder('➖ Tirar a tag do clã (até 10)').setMaxValues(10)),
    row(new StringSelectMenuBuilder().setCustomId(`cla:color:${c.id}`).setPlaceholder('🎨 Escolher a cor do clã').addOptions(colorOptions(c.color))),
    row(btn('cla:x', 'Marcar X-Clã', '⚔️', ButtonStyle.Danger))
  ] };
}

/* ───────────── Registro pelo ticket ───────────── */

function registerModal(ownerId) {
  return new ModalBuilder().setCustomId(`cla:regm:${ownerId}`).setTitle('Registrar clã').addLabelComponents(
    new LabelBuilder().setLabel('Nome do clã').setDescription('Se já existir um cargo com esse nome, o bot usa ele')
      .setTextInputComponent(new TextInputBuilder().setCustomId('nome').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40)),
    new LabelBuilder().setLabel('Sigla').setTextInputComponent(new TextInputBuilder().setCustomId('sigla').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(8).setPlaceholder('Ex: ZN')),
    new LabelBuilder().setLabel('Líder').setUserSelectMenuComponent(new UserSelectMenuBuilder().setCustomId('lider').setRequired(true).setMaxValues(1).setDefaultUsers(ownerId)),
    new LabelBuilder().setLabel('Criar canal do clã?').setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('canal').setRequired(true)
      .addOptions({ label: 'Não', value: 'nao', default: true }, { label: 'Sim, criar na categoria de clãs', value: 'sim' })),
    new LabelBuilder().setLabel('Cor do clã').setDescription('A cor do cargo (o nome dos membros fica dessa cor)')
      .setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('cor').setRequired(true)
        .addOptions(colorOptions(null, [{ label: 'Manter a cor atual do cargo', value: 'manter', emoji: '🎨', default: true }]).filter((o) => o.value !== 'custom')))
  );
}

/* ───────────── X-Clã ───────────── */

const xcStatus = {
  pendente: () => `${e.pending} Aguardando o líder adversário aceitar`,
  aceito: () => `${e.approved} **Confirmado!**`,
  recusado: () => `${e.rejected} Recusado`,
  cancelado: () => `${e.cross} Cancelado`,
  finalizado: () => `${e.trophy} Finalizado`
};

function xcEmbed(guildId, x) {
  const A = clans(guildId)[x.a], B = clans(guildId)[x.b];
  const nameA = A ? A.nome : x.aName, nameB = B ? B.nome : x.bName;
  const embed = base().setTitle(`⚔️ ${nameA} x ${nameB}`)
    .setDescription([
      `👤 **Líder ${A?.sigla ?? nameA}:** <@${A?.liderId ?? x.aLider}>`,
      `👤 **Líder ${B?.sigla ?? nameB}:** <@${B?.liderId ?? x.bLider}>`,
      '',
      `📅 **Data:** ${ts(x.at, 'D')}`,
      `🕐 **Hora:** ${ts(x.at, 't')} (${ts(x.at)})`,
      x.note ? `\n${e.log} ${x.note}` : null,
      line,
      xcStatus[x.status](),
      x.winner ? `${e.trophy} **Vencedor:** ${x.winner === x.a ? nameA : nameB}` : null,
      x.claim && x.status === 'aceito' ? `${e.info} <@${x.claim.by}> marcou vitória de **${x.claim.winner === x.a ? nameA : nameB}** — o outro líder precisa confirmar.` : null
    ].filter((l) => l !== null).join('\n'));
  return embed;
}

function xcButtons(guildId, x) {
  const A = clans(guildId)[x.a], B = clans(guildId)[x.b];
  if (x.status === 'pendente') return [row(btn(`xc:ok:${x.n}`, 'Aceitar', e.check, ButtonStyle.Success), btn(`xc:no:${x.n}`, 'Recusar', e.cross, ButtonStyle.Danger), btn(`xc:cancel:${x.n}`, 'Cancelar', e.trash))];
  if (x.status === 'aceito') return [row(
    btn(`xc:win:${x.n}:${x.a}`, `Vitória ${A?.sigla ?? 'A'}`, e.trophy, ButtonStyle.Primary),
    btn(`xc:win:${x.n}:${x.b}`, `Vitória ${B?.sigla ?? 'B'}`, e.trophy, ButtonStyle.Primary),
    btn(`xc:cancel:${x.n}`, 'Cancelar', e.trash))];
  return [];
}

function xcModal(guildId, mine) {
  const options = Object.values(clans(guildId)).filter((c) => c.id !== mine.id).slice(0, 25)
    .map((c) => ({ label: `[${c.sigla}] ${c.nome}`.slice(0, 100), value: c.id, description: `Líder: ${c.membros.length} membros • ${c.wins}V/${c.losses}D` }));
  return new ModalBuilder().setCustomId(`xc:new:${mine.id}`).setTitle(`X-Clã — ${mine.nome}`.slice(0, 45)).addLabelComponents(
    new LabelBuilder().setLabel('Contra qual clã?').setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('adv').setRequired(true).addOptions(options)),
    new LabelBuilder().setLabel('Data (dd/mm)').setTextInputComponent(new TextInputBuilder().setCustomId('data').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10).setPlaceholder('14/11')),
    new LabelBuilder().setLabel('Hora (hh:mm)').setTextInputComponent(new TextInputBuilder().setCustomId('hora').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(5).setPlaceholder('22:30')),
    new LabelBuilder().setLabel('Regras / observação (opcional)').setTextInputComponent(new TextInputBuilder().setCustomId('obs').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500))
  );
}

async function refreshXc(guild, x) {
  const msg = await guild.channels.cache.get(x.channelId)?.messages.fetch(x.messageId).catch(() => null);
  await msg?.edit({ embeds: [xcEmbed(guild.id, x)], components: xcButtons(guild.id, x) }).catch(() => null);
}

const pingClans = (guildId, x) => [clans(guildId)[x.a], clans(guildId)[x.b]].filter(Boolean).map((c) => (c.roleId ? `<@&${c.roleId}>` : `<@${c.liderId}>`)).join(' ');

/** Lembrete antes e na hora (a cada 30s) */
async function tick(client) {
  const before = (cfg().reminderMinutes ?? 15) * 6e4;
  for (const guild of client.guilds.cache.values()) {
    const g = store(guild.id);
    for (const x of Object.values(g.xcla.items)) {
      if (x.status !== 'aceito') continue;
      const ch = guild.channels.cache.get(x.channelId);
      if (!ch) continue;
      if (!x.reminded && x.at - Date.now() <= before) {
        x.reminded = true;
        db.save();
        await ch.send({ content: pingClans(guild.id, x), embeds: [base().setDescription(`⏰ **${clans(guild.id)[x.a]?.nome} x ${clans(guild.id)[x.b]?.nome}** começa ${ts(x.at)}! Todo mundo na cidade.`)], allowedMentions: { parse: ['roles', 'users'] } }).catch(() => null);
      }
      if (!x.started && x.at <= Date.now()) {
        x.started = true;
        db.save();
        await ch.send({ content: pingClans(guild.id, x), embeds: [base().setDescription(`⚔️ **É AGORA!** ${clans(guild.id)[x.a]?.nome} x ${clans(guild.id)[x.b]?.nome}. Boa sorte aos dois clãs!`)], allowedMentions: { parse: ['roles', 'users'] } }).catch(() => null);
      }
    }
  }
}

function parseDate(data, hora) {
  const off = (config.timezoneOffset ?? -3) * 36e5;
  const d = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(data.trim());
  const h = /^(\d{1,2})[:h]?(\d{2})?$/.exec(hora.trim());
  if (!d || !h) return null;
  const now = new Date(Date.now() + off);
  let year = d[3] ? Number(d[3].length === 2 ? `20${d[3]}` : d[3]) : now.getUTCFullYear();
  let at = Date.UTC(year, Number(d[2]) - 1, Number(d[1]), Number(h[1]), Number(h[2] ?? 0)) - off;
  if (!d[3] && at < Date.now() - 864e5) at = Date.UTC(year + 1, Number(d[2]) - 1, Number(d[1]), Number(h[1]), Number(h[2] ?? 0)) - off;
  return Number.isNaN(at) ? null : at;
}

/* ───────────── Roteadores ───────────── */

async function handle(i) { // "cla:..."
  const [, action, a] = i.customId.split(':');
  const guild = i.guild;

  if (action === 'list') return i.reply({ ...listEmbed(guild), flags: EPH });
  if (action === 'me' || action === 'x') {
    const c = ledBy(guild.id, i.user.id);
    if (!c) return i.reply({ embeds: [error('Você não é líder de nenhum clã registrado. Abra um **ticket de Clãs** para registrar o seu.')], flags: EPH });
    if (action === 'me') return i.reply({ ...manageView(c), flags: EPH });
    if (Object.keys(clans(guild.id)).length < 2) return i.reply({ embeds: [error('Ainda não há outro clã registrado para desafiar.')], flags: EPH });
    if (!store(guild.id).channels.xcla) return i.reply({ embeds: [error('O canal de X-Clã não foi configurado (Central → Canais → Clãs).')], flags: EPH });
    return i.showModal(xcModal(guild.id, c));
  }
  if (action === 'add' || action === 'rem') {
    const c = clans(guild.id)[a];
    if (!c) return i.update({ embeds: [error('Esse clã não existe mais.')], components: [] });
    if (c.liderId !== i.user.id && !(await perms.check(i, 'suporte'))) return;
    const out = [];
    for (const uid of i.values) {
      const r = await setMember(guild, c, uid, action === 'add');
      out.push(r.error ? `${e.cross} ${r.error}` : `${e.check} ${r.text}`);
    }
    return i.update(manageView(c, out.join('\n')));
  }
  if (action === 'color' || action === 'colorm') {
    const c = clans(guild.id)[a];
    if (!c) return i.reply({ embeds: [error('Esse clã não existe mais.')], flags: EPH });
    if (c.liderId !== i.user.id && !(await perms.check(i, 'suporte'))) return;
    if (action === 'color' && i.values[0] === 'custom') return i.showModal(colorModal(c.id));
    const hex = action === 'color' ? i.values[0] : `#${i.fields.getTextInputValue('hex').trim().replace('#', '')}`;
    const r = await setColor(guild, c, hex);
    return i.update(manageView(c, r.error ? `${e.cross} ${r.error}` : `${e.check} ${r.text}`));
  }
  // registro pelo ticket (staff)
  if (action === 'reg') {
    if (!(await perms.check(i, 'suporte'))) return;
    const t = db.guild(guild.id).tickets[i.channel.id];
    return i.showModal(registerModal(t?.ownerId ?? i.user.id));
  }
  if (action === 'regm') {
    if (!(await perms.check(i, 'suporte'))) return;
    await i.deferReply();
    const lider = i.fields.getSelectedUsers('lider')?.first();
    const r = await create(guild, i.user, {
      nome: i.fields.getTextInputValue('nome'), sigla: i.fields.getTextInputValue('sigla'), liderId: lider?.id,
      createChannel: i.fields.getStringSelectValues('canal')?.[0] === 'sim',
      color: (i.fields.getStringSelectValues('cor')?.[0] ?? 'manter') === 'manter' ? null : i.fields.getStringSelectValues('cor')[0]
    });
    if (r.error) return i.editReply({ embeds: [error(r.error)] });
    const g = store(guild.id);
    return i.editReply({ embeds: [success([
      `Clã **[${r.c.sigla}] ${r.c.nome}** registrado!`,
      r.roleCreated ? `${e.check} Cargo <@&${r.c.roleId}> **criado** e entregue ao líder <@${r.c.liderId}>.` : r.c.roleId ? `${e.check} Cargo existente <@&${r.c.roleId}> entregue ao líder <@${r.c.liderId}>.` : `${e.warn} Não consegui criar o cargo (o cargo do bot precisa estar acima).`,
      g.roles.lider_cla ? `${e.crown} Cargo de Líder de clã <@&${g.roles.lider_cla}> entregue.` : `${e.warn} Configure o cargo de **Líder de clã** (Central → Cargos) para ele acessar o chat dos líderes.`,
      r.channel ? `${e.check} Canal criado: ${r.channel}` : null,
      r.c.color ? `🎨 Cor: **${colorName(r.c.color)}**` : null,
      `${e.arrow} O líder já pode dar a tag aos membros pelo **Painel do Líder**.`
    ].filter(Boolean).join('\n'), 'Clã registrado'), infoEmbed(r.c)] });
  }
}

async function handleXc(i) { // "xc:..."
  const [, action, a, b] = i.customId.split(':');
  const guild = i.guild;
  const g = store(guild.id);

  if (action === 'new') {
    const mine = clans(guild.id)[a];
    const adv = clans(guild.id)[i.fields.getStringSelectValues('adv')?.[0]];
    if (!mine || mine.liderId !== i.user.id) return i.reply({ embeds: [error('Só o líder pode marcar X-Clã.')], flags: EPH });
    if (!adv) return i.reply({ embeds: [error('Clã adversário não encontrado.')], flags: EPH });
    const at = parseDate(i.fields.getTextInputValue('data'), i.fields.getTextInputValue('hora'));
    if (!at || at < Date.now()) return i.reply({ embeds: [error('Data ou hora inválida. Use **dd/mm** e **hh:mm**, ex: 14/11 e 22:30 (precisa ser no futuro).')], flags: EPH });
    const ch = guild.channels.cache.get(g.channels.xcla);
    if (!ch) return i.reply({ embeds: [error('O canal de X-Clã não foi configurado.')], flags: EPH });
    const x = { n: ++g.xcla.counter, a: mine.id, b: adv.id, aName: mine.nome, bName: adv.nome, aLider: mine.liderId, bLider: adv.liderId, at, note: i.fields.getTextInputValue('obs')?.trim() || null, status: 'pendente', by: i.user.id, createdAt: Date.now() };
    const msg = await ch.send({ content: `<@${adv.liderId}>, o clã **${mine.nome}** te desafiou!`, embeds: [xcEmbed(guild.id, x)], components: xcButtons(guild.id, x) });
    x.channelId = ch.id;
    x.messageId = msg.id;
    g.xcla.items[x.n] = x;
    db.save();
    return i.reply({ embeds: [success(`Desafio enviado em ${ch}! Agora o líder do **${adv.nome}** precisa aceitar.`)], flags: EPH });
  }

  const x = g.xcla.items[a];
  if (!x) return i.reply({ embeds: [error('Desafio não encontrado.')], flags: EPH });
  const A = clans(guild.id)[x.a], B = clans(guild.id)[x.b];
  const staff = isStaff(i.member);
  const isA = A?.liderId === i.user.id, isB = B?.liderId === i.user.id;

  if (action === 'ok' || action === 'no') {
    if (x.status !== 'pendente') return i.reply({ embeds: [error('Esse desafio já foi respondido.')], flags: EPH });
    if (!isB && !staff) return i.reply({ embeds: [error(`Só o líder do **${B?.nome ?? 'clã desafiado'}** pode responder.`)], flags: EPH });
    x.status = action === 'ok' ? 'aceito' : 'recusado';
    db.save();
    await i.update({ content: action === 'ok' ? pingClans(guild.id, x) || null : null, embeds: [xcEmbed(guild.id, x)], components: xcButtons(guild.id, x), allowedMentions: { parse: ['roles', 'users'] } });
    return;
  }
  if (action === 'cancel') {
    if (!isA && !isB && !staff) return i.reply({ embeds: [error('Só os líderes ou a staff podem cancelar.')], flags: EPH });
    if (['finalizado', 'cancelado', 'recusado'].includes(x.status)) return i.reply({ embeds: [error('Esse desafio já terminou.')], flags: EPH });
    x.status = 'cancelado';
    db.save();
    return i.update({ embeds: [xcEmbed(guild.id, x)], components: [] });
  }
  if (action === 'win') {
    if (x.status !== 'aceito') return i.reply({ embeds: [error('Esse desafio não está valendo.')], flags: EPH });
    if (!isA && !isB && !staff) return i.reply({ embeds: [error('Só os líderes ou a staff podem marcar o resultado.')], flags: EPH });
    // staff decide na hora; líderes precisam concordar
    if (!(staff && !isA && !isB)) {
      if (!x.claim || x.claim.by === i.user.id || x.claim.winner !== b) {
        x.claim = { by: i.user.id, winner: b };
        db.save();
        return i.update({ embeds: [xcEmbed(guild.id, x)], components: xcButtons(guild.id, x) });
      }
    }
    x.status = 'finalizado';
    x.winner = b;
    const W = clans(guild.id)[b], L = clans(guild.id)[b === x.a ? x.b : x.a];
    if (W) W.wins++;
    if (L) L.losses++;
    db.save();
    require('./rankingBoard').touch(i.client);
    await i.update({ content: `${e.trophy} **${W?.nome ?? 'Vencedor'}** venceu o X-Clã!`, embeds: [xcEmbed(guild.id, x)], components: [] });
    sendLog(guild, base().setDescription(`⚔️ X-Clã #${x.n}: **${W?.nome}** venceu **${L?.nome}**`));
  }
}

module.exports = {
  store, clans, find, clanOf, ledBy, create, setMember, setLeader, remove, setColor, colorOptions, colorModal, colorName, COLORS,
  infoEmbed, listEmbed, rankingEmbed, leaderPanel, manageView, registerModal, tick, handle, handleXc, parseDate
};
