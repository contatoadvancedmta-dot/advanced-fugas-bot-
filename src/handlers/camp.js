/**
 * CAMPEONATO X1 — anúncio, regras, inscrição por botão, chaveamento sorteado a cada fase,
 * sorteio de quem começa fugindo, vencedores por menu e anúncio do campeão.
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ModalBuilder,
  LabelBuilder, TextInputBuilder, TextInputStyle, MessageFlags, ChannelType
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { withBanner } = require('../utils/banner');
const { sendLog } = require('../utils/logger');
const { ts } = require('../utils/time');

const EPH = MessageFlags.Ephemeral;
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const btn = (id, label, emoji, style = ButtonStyle.Secondary, disabled = false) => new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style).setDisabled(disabled);
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function camp(guildId) {
  const g = db.guild(guildId);
  g.camp ??= null;
  return g;
}
const get = (gid) => camp(gid).camp;
const phaseName = (n) => (n <= 2 ? 'FINAL' : n <= 4 ? 'Semifinal' : n <= 8 ? 'Quartas de final' : n <= 16 ? 'Oitavas de final' : `Primeira fase (${n} jogadores)`);
const approved = (c) => c.inscritos.filter((p) => (p.status ?? 'aprovado') === 'aprovado');
const pendingList = (c) => c.inscritos.filter((p) => p.status === 'pendente');
const mention = (c, uid) => { const p = c.inscritos.find((x) => x.userId === uid); return `<@${uid}>${p?.nick ? ` (${p.nick})` : ''}`; };

/* ───────────── Datas ───────────── */

function parseWhen(text) {
  if (!text?.trim()) return null;
  const off = (config.timezoneOffset ?? -3) * 36e5;
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(?:às\s+)?(\d{1,2})[:h](\d{2})?)?$/i.exec(text.trim());
  if (!m) return null;
  const now = new Date(Date.now() + off);
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : now.getUTCFullYear();
  let at = Date.UTC(year, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 23), Number(m[5] ?? (m[4] ? 0 : 59))) - off;
  if (!m[3] && at < Date.now() - 864e5) at = Date.UTC(year + 1, Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 23), Number(m[5] ?? (m[4] ? 0 : 59))) - off;
  return Number.isNaN(at) ? null : at;
}
const fmtDate = (t) => (t ? `${ts(t, 'D')} às ${ts(t, 't')}` : '`a definir`');

/* ───────────── Mensagens públicas ───────────── */

const fmtDay = (t) => {
  if (!t) return '[dd/mm]';
  const d = new Date(t + (config.timezoneOffset ?? -3) * 36e5);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const fmtHour = (t) => {
  if (!t) return '[hh:mm]';
  const d = new Date(t + (config.timezoneOffset ?? -3) * 36e5);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const RULES_LINES = () => [
  `⏱️ **Duração da rodada:** ${config.camp?.roundTime ?? '2 minutos'} (fuga e perseguição)`,
  '📊 **Diferença necessária:** vence quem abrir **2 pontos** de vantagem',
  '🔄 **Empate:** o placar zera',
  '⏳ **Após 2 empates:** o tempo cai para **1m30**, e depois para **1m**',
  '🌳 **Vegetação:** ATIVADA',
  '🎲 **Quem começa fugindo ou perseguindo** também é sorteado'
];
const ANTIHACK_LINES = [
  'Antes de cada X1, os jogadores vão **relogar o MTA com a tela compartilhada** e fazer o **reset de verificação** pedido pela organização.',
  'Quem se recusar ou for pego com qualquer irregularidade é **desclassificado na hora**. ❌'
];

function announceMessage(c) {
  const embed = base()
    .setTitle(`🏆 ${c.title} — ${config.brand.name.toUpperCase()} 🏆`)
    .setDescription([
      'Chegou a hora de provar quem é o melhor na **fuga** e na **perseguição**! O Campeonato de X1 da Advanced Fugas está com as **inscrições abertas**! 🔥',
      '',
      '📋 **COMO FUNCIONA**',
      '👤 **Modo:** Solo (1v1)',
      `👥 **Vagas:** de ${c.min} a ${c.max} jogadores`,
      '🎲 **Chaveamento:** sorteado ao vivo a cada fase',
      '🏁 **Fases:** Oitavas ➜ Quartas ➜ Semifinal ➜ FINAL',
      `📺 **Transmissão ao vivo no YouTube:** ${c.youtube || '*em breve*'}`,
      '',
      '⚔️ **REGRAS DO X1**',
      ...RULES_LINES(),
      '',
      '🛡️ **ANTI-HACK**',
      ...ANTIHACK_LINES,
      '',
      '🎁 **PREMIAÇÃO**',
      c.premio || '*a definir*',
      '',
      '📝 **INSCRIÇÕES**',
      `🗓️ **Inscrições abertas:** de ${fmtDay(c.opensAt ?? c.createdAt)} até ${fmtDay(c.deadline)}`,
      `📅 **Dia do campeonato:** ${fmtDay(c.date)} às ${fmtHour(c.date)}`,
      `✍️ **Como se inscrever:** ${c.inscricaoChannelId ? `clique em **Inscrever-me** em <#${c.inscricaoChannelId}>` : 'clique em **Inscrever-me** no canal de inscrição'} (a staff confere seu nick e ID)`,
      '',
      '⚠️ O número de participantes precisa ser **par**. Se faltar alguém, a organização ajusta as chaves.',
      '',
      'Inscreva-se, chama os parças e bora ver quem é o **rei do X1**! 🚓💨'
    ].join('\n'));
  const components = c.youtube ? [row(new ButtonBuilder().setLabel('Assistir no YouTube').setEmoji('📺').setStyle(ButtonStyle.Link).setURL(c.youtube))] : [];
  return withBanner({ content: '@everyone', embeds: [embed], components, allowedMentions: { parse: ['everyone'] } }, embed, 'campeonato');
}

function rulesMessage(c) {
  const embed = base()
    .setTitle(`⚔️ Regras do X1 — ${c?.title ?? 'Campeonato X1'}`)
    .setDescription([...RULES_LINES(), line, '🛡️ **ANTI-HACK**', ...ANTIHACK_LINES].join('\n'));
  return withBanner({ embeds: [embed] }, embed, 'campeonato');
}

function signupEmbed(c) {
  const open = c.status === 'inscricoes' && (!c.deadline || Date.now() < c.deadline) && c.inscritos.length < c.max;
  const list = approved(c).map((p, n) => `\`${String(n + 1).padStart(2, '0')}\` <@${p.userId}> — ${p.nick} \`#${p.gameId}\``);
  const waiting = pendingList(c).length;
  return base()
    .setTitle(`✍️ Inscrições — ${c.title}`)
    .setDescription([
      `📅 **Campeonato:** ${fmtDate(c.date)}`,
      `🗓️ **Inscrições até:** ${fmtDate(c.deadline)}`,
      `👥 **Aprovados:** **${approved(c).length}/${c.max}** (mínimo ${c.min})${waiting ? ` • ${e.pending} ${waiting} em análise` : ''}`,
      open ? `${e.approved} **Inscrições abertas!** Clique em **Inscrever-me**.` : `${e.lock} **Inscrições encerradas.**`,
      line,
      list.length ? list.join('\n').slice(0, 3500) : '*Nenhum inscrito aprovado ainda. Seja o primeiro!*',
      line,
      `${e.info} Sua inscrição passa pela **staff**, que confere seu **nick e ID**. Você recebe a resposta na DM.`
    ].join('\n'));
}

function signupMessage(c) {
  const open = c.status === 'inscricoes' && (!c.deadline || Date.now() < c.deadline) && c.inscritos.length < c.max;
  const embed = signupEmbed(c);
  return withBanner({ embeds: [embed], components: [row(
    btn('camp:join', 'Inscrever-me', '✍️', ButtonStyle.Success, !open),
    btn('camp:leave', 'Sair da inscrição', '🚪', ButtonStyle.Secondary, c.status !== 'inscricoes'))] }, embed, 'campeonato');
}

async function refreshSignup(guild) {
  const c = get(guild.id);
  if (!c?.signupMsg) return;
  const msg = await guild.channels.cache.get(c.signupMsg.channelId)?.messages.fetch(c.signupMsg.messageId).catch(() => null);
  const payload = signupMessage(c);
  if (msg?.attachments.size) delete payload.files;
  await msg?.edit(payload).catch(() => null);
}

/* ───────────── Chaveamento ───────────── */

function drawPhase(c) {
  const players = c.rounds.length ? c.rounds.at(-1).matches.map((m) => m.winner ?? m.bye).filter(Boolean) : approved(c).map((p) => p.userId);
  const pool = shuffle(players);
  const matches = [];
  let bye = null;
  if (pool.length % 2) bye = pool.pop(); // ímpar: um passa direto (a organização pode ajustar)
  for (let i = 0; i < pool.length; i += 2) matches.push({ n: matches.length + 1, a: pool[i], b: pool[i + 1], start: Math.random() < 0.5 ? pool[i] : pool[i + 1], winner: null });
  if (bye) matches.push({ n: matches.length + 1, bye, winner: bye });
  c.rounds.push({ name: phaseName(players.length), players: players.length, matches, at: Date.now() });
  return c.rounds.at(-1);
}

function bracketEmbed(c, r) {
  const done = r.matches.filter((m) => m.winner).length;
  return base()
    .setTitle(`🎲 ${r.name} — ${c.title}`)
    .setDescription([
      `${r.players} jogadores • ${done}/${r.matches.length} confrontos definidos`,
      line,
      ...r.matches.map((m) => m.bye
        ? `**Jogo ${m.n}:** ${mention(c, m.bye)} — ✅ passa direto (número ímpar)`
        : `**Jogo ${m.n}:** ${m.winner === m.a ? '🏆 ' : ''}${mention(c, m.a)} 🆚 ${m.winner === m.b ? '🏆 ' : ''}${mention(c, m.b)}\n${e.dot} 🏃 Começa fugindo: <@${m.start}>${m.winner ? ` • **Vencedor:** <@${m.winner}>` : ''}`)
    ].join('\n').slice(0, 4000));
}

function bracketComponents(c, r) {
  const pending = r.matches.filter((m) => !m.winner);
  const options = pending.flatMap((m) => [
    { label: `Jogo ${m.n}: vitória de ${nickOf(c, m.a)}`.slice(0, 100), value: `${m.n}:${m.a}`, emoji: '🏆' },
    { label: `Jogo ${m.n}: vitória de ${nickOf(c, m.b)}`.slice(0, 100), value: `${m.n}:${m.b}`, emoji: '🏆' }
  ]);
  const rows = [];
  for (let i = 0; i < options.length && rows.length < 4; i += 24) {
    rows.push(row(new StringSelectMenuBuilder().setCustomId(`camp:win:${c.rounds.length - 1}:${rows.length}`).setPlaceholder('🏆 Registrar vencedor (staff)').addOptions(options.slice(i, i + 24))));
  }
  const allDone = !pending.length;
  const isFinal = r.players <= 2;
  rows.push(row(allDone && isFinal
    ? btn('camp:champion', 'Anunciar campeão', '👑', ButtonStyle.Success)
    : btn('camp:next', 'Sortear próxima fase', '🎲', ButtonStyle.Primary, !allDone)));
  return rows;
}
const nickOf = (c, uid) => c.inscritos.find((p) => p.userId === uid)?.nick ?? uid;

/* ───────────── Campeonato padrão (do config) ───────────── */

function fromDefaults(by) {
  const p = config.camp?.padrao;
  if (!p) return null;
  const [min, max] = String(p.vagas ?? '16-32').split(/[-a\s]+/).map((n) => parseInt(n, 10));
  const date = parseWhen(p.data), deadline = parseWhen(p.prazo);
  if (!date || !deadline) return null;
  return {
    title: config.camp?.title ?? 'CAMPEONATO X1', status: Date.now() < deadline ? 'inscricoes' : 'fechado', inscritos: [], rounds: [],
    createdAt: Date.now(), opensAt: parseWhen(p.abertura) ?? Date.now(), by: by ?? null,
    date, deadline, min: min || 16, max: max || 32, premio: p.premio ?? '', youtube: p.youtube || null
  };
}

/** Garante que existe um campeonato (cria o padrão do config se não tiver) */
function ensure(guildId) {
  const g = camp(guildId);
  if (!g.camp && !g.campDisabled) {
    g.camp = fromDefaults();
    if (g.camp) db.save();
  }
  return g.camp;
}

/* ───────────── Painel da staff ───────────── */

function staffPanel(guild) {
  const c = ensure(guild.id);
  const g = camp(guild.id);
  const embed = base().setTitle('🏆 Gerenciar campeonato X1');
  if (!c) {
    embed.setDescription('Nenhum campeonato ativo. Clique em **Criar campeonato** — ele já vem preenchido com o padrão (datas, vagas e premiação).');
    return { content: null, embeds: [embed], files: [], attachments: [], components: [row(btn('camp:new', 'Criar campeonato', '➕', ButtonStyle.Success))] };
  }
  const r = c.rounds.at(-1);
  embed.setDescription([
    `**${c.title}**`,
    `📅 ${fmtDate(c.date)} • 🗓️ inscrições de ${fmtDay(c.opensAt ?? c.createdAt)} até ${fmtDate(c.deadline)}`,
    `📺 YouTube: ${c.youtube ? c.youtube : '`falta colocar o link`'}`,
    `👥 **${approved(c).length}/${c.max}** aprovados (mínimo ${c.min})${pendingList(c).length ? ` • ${e.pending} **${pendingList(c).length} aguardando análise**` : ''}`,
    `📌 **Status:** ${{ inscricoes: '✍️ inscrições abertas', fechado: '🔒 inscrições fechadas', andamento: `⚔️ em andamento — ${r?.name ?? ''}`, finalizado: '👑 finalizado' }[c.status]}`,
    line,
    `📢 Anúncio: ${g.channels.camp_anuncios ? `<#${g.channels.camp_anuncios}>` : '`canal não configurado`'}`,
    `📜 Regras: ${g.channels.camp_regras ? `<#${g.channels.camp_regras}>` : '`canal não configurado`'}`,
    `✍️ Inscrição: ${g.channels.camp_inscricao ? `<#${g.channels.camp_inscricao}>` : '`canal não configurado`'}`,
    `🔎 Análise das inscrições: ${g.channels.camp_analise ? `<#${g.channels.camp_analise}>` : '`canal não configurado (as inscrições entram direto)`'}`,
    `🎫 Cargo de participante: ${g.roles.camp_participante ? `<@&${g.roles.camp_participante}>` : '`não configurado`'}`
  ].join('\n'));
  return { content: null, embeds: [embed], files: [], attachments: [], components: [
    row(btn('camp:yt', c.youtube ? 'Editar link do YouTube' : 'Colocar link do YouTube', '📺', ButtonStyle.Success), btn('camp:edit', 'Editar dados', '✏️')),
    row(btn('camp:pubann', 'Publicar anúncio', '📢', ButtonStyle.Primary), btn('camp:pubrules', 'Publicar regras', '📜', ButtonStyle.Primary), btn('camp:pubsignup', 'Publicar inscrição', '✍️', ButtonStyle.Primary)),
    row(
      c.status === 'inscricoes' ? btn('camp:close', 'Fechar inscrições', '🔒') : btn('camp:open', 'Reabrir inscrições', '🔓', ButtonStyle.Secondary, c.status !== 'fechado'),
      btn('camp:draw', c.rounds.length ? 'Ver chaveamento' : 'Sortear chaves', '🎲', ButtonStyle.Success, approved(c).length < 2),
      btn('camp:reset', 'Encerrar / novo campeonato', '🗑️', ButtonStyle.Danger))
  ] };
}

function editModal(c) {
  const fmt = (t) => {
    if (!t) return '';
    const d = new Date(t + (config.timezoneOffset ?? -3) * 36e5);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };
  const t = (id, label, value, ph, style = TextInputStyle.Short, required = true, max = 100) => new LabelBuilder().setLabel(label)
    .setTextInputComponent(new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(required).setMaxLength(max).setPlaceholder(ph).setValue(value ?? ''));
  return new ModalBuilder().setCustomId('camp:save').setTitle('Campeonato X1').addLabelComponents(
    t('data', 'Data e hora do campeonato', fmt(c?.date), '28/12 20:00'),
    t('prazo', 'Inscrições até (data e hora)', fmt(c?.deadline), '27/12 23:59'),
    t('vagas', 'Vagas (mínimo-máximo)', c ? `${c.min}-${c.max}` : '16-32', '16-32', TextInputStyle.Short, true, 7),
    t('premio', 'Premiação (1º, 2º, 3º)', c?.premio, '🥇 1º: ...\n🥈 2º: ...\n🥉 3º: ...', TextInputStyle.Paragraph, false, 1000),
    t('youtube', 'Link da transmissão no YouTube (opcional)', c?.youtube, 'https://youtube.com/@...', TextInputStyle.Short, false, 200)
  );
}

/* ───────────── Tick: fecha inscrição no prazo ───────────── */

async function tick(client) {
  for (const guild of client.guilds.cache.values()) {
    const c = get(guild.id);
    if (!c || c.status !== 'inscricoes' || !c.deadline || Date.now() < c.deadline) continue;
    c.status = 'fechado';
    db.save();
    await refreshSignup(guild);
    const ch = guild.channels.cache.get(camp(guild.id).channels.camp_anuncios);
    await ch?.send({ embeds: [base().setDescription(`${e.lock} **Inscrições encerradas!** ${approved(c).length} jogadores aprovados.${pendingList(c).length ? ` (${pendingList(c).length} ainda em análise)` : ''}${approved(c).length % 2 ? '\n⚠️ Número ímpar — a organização vai ajustar as chaves.' : ''}`)] }).catch(() => null);
  }
}

/* ───────────── Roteador "camp:..." ───────────── */

async function handle(i) {
  const [, action, a, b] = i.customId.split(':');
  const guild = i.guild;
  const g = camp(guild.id);
  const c = ensure(guild.id);

  /* jogadores */
  if (action === 'join') {
    if (!c || c.status !== 'inscricoes') return i.reply({ embeds: [error('As inscrições não estão abertas.')], flags: EPH });
    if (c.deadline && Date.now() >= c.deadline) return i.reply({ embeds: [error('O prazo de inscrição acabou.')], flags: EPH });
    const mine = c.inscritos.find((p) => p.userId === i.user.id);
    if (mine) return i.reply({ embeds: [error(mine.status === 'pendente' ? 'Sua inscrição já está **em análise** pela staff. Aguarde a resposta na DM.' : 'Você já está inscrito! ✅')], flags: EPH });
    if (c.inscritos.length >= c.max) return i.reply({ embeds: [error('As vagas acabaram.')], flags: EPH });
    const nick = require('./fugas').player(guild.id, i.user.id).nick ?? '';
    return i.showModal(new ModalBuilder().setCustomId('camp:joinm').setTitle(`Inscrição — ${c.title}`.slice(0, 45)).addLabelComponents(
      new LabelBuilder().setLabel('Seu nick no MTA').setTextInputComponent(new TextInputBuilder().setCustomId('nick').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setValue(nick)),
      new LabelBuilder().setLabel('Seu ID na cidade').setTextInputComponent(new TextInputBuilder().setCustomId('id').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
      new LabelBuilder().setLabel('Concordo com as regras e o anti-hack').setStringSelectMenuComponent(new StringSelectMenuBuilder().setCustomId('aceite').setRequired(true)
        .addOptions({ label: 'Sim, li e concordo com as regras e o anti-hack', value: 'sim', emoji: '✅' }))));
  }
  if (action === 'joinm') {
    if (!c || c.status !== 'inscricoes' || c.inscritos.length >= c.max) return i.reply({ embeds: [error('As inscrições fecharam enquanto você preenchia.')], flags: EPH });
    if (c.inscritos.some((p) => p.userId === i.user.id)) return i.reply({ embeds: [error('Você já está inscrito!')], flags: EPH });
    const nick = i.fields.getTextInputValue('nick').replace(/#[0-9a-f]{6}/gi, '').trim();
    const gameId = i.fields.getTextInputValue('id').replace(/\D/g, '');
    if (!gameId) return i.reply({ embeds: [error('O ID precisa ser um número.')], flags: EPH });
    if (c.inscritos.some((p) => p.nick.toLowerCase() === nick.toLowerCase() || p.gameId === gameId)) return i.reply({ embeds: [error('Esse nick ou ID já está inscrito.')], flags: EPH });
    const entry = { userId: i.user.id, nick, gameId, at: Date.now(), status: 'pendente' };
    c.inscritos.push(entry);
    db.save();
    const review = guild.channels.cache.get(g.channels.camp_analise);
    if (!review) { // sem canal de análise: entra direto
      await approve(guild, c, entry, null);
      return i.reply({ embeds: [success(`Inscrição confirmada! Você é o **${approved(c).length}º** inscrito. 🏆`, 'Inscrito')], flags: EPH });
    }
    const roles = ['suporte', 'moderador'].map((k) => g.roles[k]).filter(Boolean).map((r) => `<@&${r}>`).join(' ');
    const msg = await review.send({ content: roles || undefined, embeds: [reviewEmbed(c, entry, i.user)], components: reviewButtons(entry) });
    entry.review = { channelId: review.id, messageId: msg.id };
    db.save();
    await refreshSignup(guild);
    return i.reply({ embeds: [success(`Inscrição enviada! A staff vai conferir seu **nick (${nick})** e **ID (#${gameId})**.\nVocê recebe a resposta aqui na DM. ${e.pending}`, 'Em análise')], flags: EPH });
  }
  if (action === 'leave') {
    if (!c || c.status !== 'inscricoes') return i.reply({ embeds: [error('Não dá para sair agora — as chaves já foram fechadas. Fale com a organização.')], flags: EPH });
    const me = c.inscritos.find((p) => p.userId === i.user.id);
    if (!me) return i.reply({ embeds: [error('Você não está inscrito.')], flags: EPH });
    c.inscritos = c.inscritos.filter((p) => p.userId !== i.user.id);
    if (me.review) await closeReview(guild, me, `${e.leave} O jogador desistiu da inscrição.`);
    db.save();
    if (g.roles.camp_participante) await i.member.roles.remove(g.roles.camp_participante).catch(() => null);
    await refreshSignup(guild);
    return i.reply({ embeds: [success('Você saiu da inscrição.')], flags: EPH });
  }

  /* análise das inscrições (Suporte+) */
  if (['ap', 'rj', 'rjm', 'fix', 'fixm'].includes(action)) {
    if (!(await perms.check(i, 'suporte'))) return;
    const entry = c?.inscritos.find((p) => p.userId === a);
    if (!entry || entry.status !== 'pendente') return i.reply({ embeds: [error('Essa inscrição já foi analisada (ou o jogador desistiu).')], flags: EPH });
    if (action === 'ap') {
      await i.deferReply({ flags: EPH });
      await approve(guild, c, entry, i.user);
      return i.editReply({ embeds: [success(`<@${a}> aprovado: **${entry.nick}** \`#${entry.gameId}\`.`)] });
    }
    if (action === 'rj') return i.showModal(new ModalBuilder().setCustomId(`camp:rjm:${a}`).setTitle('Recusar inscrição').addLabelComponents(
      new LabelBuilder().setLabel('Motivo (o jogador recebe na DM)').setTextInputComponent(new TextInputBuilder().setCustomId('motivo').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(400).setPlaceholder('Ex: ID não confere com a conta'))));
    if (action === 'rjm') {
      const motivo = i.fields.getTextInputValue('motivo').trim();
      c.inscritos = c.inscritos.filter((p) => p.userId !== a);
      db.save();
      await closeReview(guild, entry, `${e.rejected} **Recusado** por ${i.user}\n> ${motivo}`);
      (await i.client.users.fetch(a).catch(() => null))?.send({ embeds: [base().setTitle(`${e.rejected} Inscrição recusada — ${c.title}`).setDescription(`> ${motivo}\n\nSe foi um engano, corrija e inscreva-se de novo enquanto as inscrições estiverem abertas.`)] }).catch(() => null);
      await refreshSignup(guild);
      return i.reply({ embeds: [success(`Inscrição de <@${a}> recusada.`)], flags: EPH });
    }
    if (action === 'fix') return i.showModal(new ModalBuilder().setCustomId(`camp:fixm:${a}`).setTitle('Corrigir e aprovar').addLabelComponents(
      new LabelBuilder().setLabel('Nick correto').setTextInputComponent(new TextInputBuilder().setCustomId('nick').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32).setValue(entry.nick)),
      new LabelBuilder().setLabel('ID correto').setTextInputComponent(new TextInputBuilder().setCustomId('id').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10).setValue(entry.gameId))));
    if (action === 'fixm') {
      const nick = i.fields.getTextInputValue('nick').replace(/#[0-9a-f]{6}/gi, '').trim();
      const gameId = i.fields.getTextInputValue('id').replace(/\D/g, '');
      if (!nick || !gameId) return i.reply({ embeds: [error('Nick e ID (número) são obrigatórios.')], flags: EPH });
      if (c.inscritos.some((p) => p.userId !== a && (p.nick.toLowerCase() === nick.toLowerCase() || p.gameId === gameId))) return i.reply({ embeds: [error('Esse nick ou ID já é de outro inscrito.')], flags: EPH });
      const before = `${entry.nick} #${entry.gameId}`;
      entry.nick = nick;
      entry.gameId = gameId;
      await i.deferReply({ flags: EPH });
      await approve(guild, c, entry, i.user, `✏️ Corrigido de \`${before}\` para \`${nick} #${gameId}\``);
      return i.editReply({ embeds: [success(`<@${a}> aprovado com os dados corrigidos: **${nick}** \`#${gameId}\`.`)] });
    }
  }

  /* staff */
  if (!(await perms.check(i, 'moderador'))) return;
  const respond = (p) => (i.message?.flags?.has(MessageFlags.Ephemeral) ? i.update(p) : i.reply({ ...p, flags: EPH }));

  switch (action) {
    case 'panel': return respond(staffPanel(guild));
    case 'new':
      g.campDisabled = false;
      g.camp = fromDefaults(i.user.id);
      db.save();
      return respond(staffPanel(guild));
    case 'yt': return i.showModal(new ModalBuilder().setCustomId('camp:ytm').setTitle('Link da transmissão').addLabelComponents(
      new LabelBuilder().setLabel('Link do canal ou da live no YouTube').setTextInputComponent(new TextInputBuilder().setCustomId('url').setStyle(TextInputStyle.Short)
        .setRequired(false).setMaxLength(200).setPlaceholder('https://youtube.com/@advancedfugas').setValue(c?.youtube ?? ''))));
    case 'ytm': {
      const url = i.fields.getTextInputValue('url').trim();
      if (url && !/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(url)) return i.reply({ embeds: [error('Coloque um link do YouTube (https://youtube.com/... ou https://youtu.be/...).')], flags: EPH });
      c.youtube = url || null;
      db.save();
      // atualiza o anúncio já publicado
      if (c.announceMsg) {
        const msg = await guild.channels.cache.get(c.announceMsg.channelId)?.messages.fetch(c.announceMsg.messageId).catch(() => null);
        if (msg) { const p = announceMessage(c); delete p.content; if (msg.attachments.size) delete p.files; await msg.edit(p).catch(() => null); }
      }
      return respond(staffPanel(guild));
    }
    case 'edit': return i.showModal(editModal(c));
    case 'save': {
      const date = parseWhen(i.fields.getTextInputValue('data'));
      const deadline = parseWhen(i.fields.getTextInputValue('prazo'));
      const [min, max] = i.fields.getTextInputValue('vagas').split(/[-a\s]+/).map((n) => parseInt(n, 10));
      if (!date) return i.reply({ embeds: [error('Data inválida. Use **dd/mm hh:mm**, ex: `28/12 20:00`.')], flags: EPH });
      if (!deadline) return i.reply({ embeds: [error('Prazo inválido. Use **dd/mm hh:mm**, ex: `27/12 23:59`.')], flags: EPH });
      if (!min || !max || min > max || max > 64) return i.reply({ embeds: [error('Vagas inválidas. Use por exemplo `16-32`.')], flags: EPH });
      const yt = i.fields.getTextInputValue('youtube').trim();
      if (yt && !/^https?:\/\//.test(yt)) return i.reply({ embeds: [error('O link do YouTube precisa começar com https://')], flags: EPH });
      g.camp = { ...(c ?? fromDefaults(i.user.id) ?? { title: config.camp?.title ?? 'CAMPEONATO X1', status: 'inscricoes', inscritos: [], rounds: [], createdAt: Date.now(), by: i.user.id }),
        date, deadline, min, max, premio: i.fields.getTextInputValue('premio').trim(), youtube: yt || null };
      db.save();
      await refreshSignup(guild);
      return respond(staffPanel(guild));
    }
    case 'pubann':
    case 'pubrules':
    case 'pubsignup': {
      if (!c) return i.reply({ embeds: [error('Crie o campeonato primeiro.')], flags: EPH });
      const key = { pubann: 'camp_anuncios', pubrules: 'camp_regras', pubsignup: 'camp_inscricao' }[action];
      const ch = guild.channels.cache.get(g.channels[key]);
      if (!ch) {
        return i.update({ content: null, files: [], attachments: [], embeds: [base().setDescription('Em qual canal publicar? (fica salvo para as próximas vezes)')], components: [
          row(new ChannelSelectMenuBuilder().setCustomId(`camp:setch:${key}:${action}`).setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setPlaceholder('Escolha o canal')),
          row(btn('camp:panel', 'Voltar', '⬅️'))] });
      }
      return publish(i, action, ch);
    }
    case 'setch': {
      g.channels[a] = i.values[0];
      db.save();
      return publish(i, b, guild.channels.cache.get(i.values[0]));
    }
    case 'close':
    case 'open':
      c.status = action === 'close' ? 'fechado' : 'inscricoes';
      db.save();
      await refreshSignup(guild);
      return respond(staffPanel(guild));
    case 'draw': {
      if (c.rounds.length) return respond({ ...bracketView(c), content: null });
      if (approved(c).length < 2) return i.reply({ embeds: [error('Precisa de pelo menos 2 inscritos aprovados.')], flags: EPH });
      if (pendingList(c).length) return i.reply({ embeds: [error(`Ainda tem **${pendingList(c).length}** inscrição(ões) aguardando análise. Aprove ou recuse antes de sortear.`)], flags: EPH });
      c.status = 'andamento';
      const r = drawPhase(c);
      db.save();
      await refreshSignup(guild);
      await postBracket(guild, c, r);
      return respond(staffPanel(guild));
    }
    case 'win': {
      const r = c?.rounds[Number(a)];
      if (!r || Number(a) !== c.rounds.length - 1) return i.reply({ embeds: [error('Essa fase já passou.')], flags: EPH });
      const [n, uid] = i.values[0].split(':');
      const m = r.matches.find((x) => String(x.n) === n);
      if (!m || m.winner) return i.reply({ embeds: [error('Esse jogo já tem vencedor.')], flags: EPH });
      m.winner = uid;
      db.save();
      await i.update({ embeds: [bracketEmbed(c, r)], components: bracketComponents(c, r) });
      const ch = guild.channels.cache.get(r.channelId) ?? i.channel;
      return ch.send({ embeds: [base().setDescription(`🏆 **Jogo ${m.n} (${r.name}):** <@${uid}> venceu ${mention(c, uid === m.a ? m.b : m.a)}!`)] }).catch(() => null);
    }
    case 'next': {
      const last = c.rounds.at(-1);
      if (last.matches.some((m) => !m.winner)) return i.reply({ embeds: [error('Ainda tem jogo sem vencedor nesta fase.')], flags: EPH });
      await i.update({ components: [] });
      const r = drawPhase(c);
      db.save();
      return postBracket(guild, c, r, i.channel);
    }
    case 'champion': {
      const final = c.rounds.at(-1);
      const champ = final.matches[0].winner;
      const vice = final.matches[0].a === champ ? final.matches[0].b : final.matches[0].a;
      const semi = c.rounds.find((r) => r.players > 2 && r.players <= 4);
      const third = semi ? semi.matches.filter((m) => !m.bye).map((m) => (m.winner === m.a ? m.b : m.a)) : [];
      c.status = 'finalizado';
      c.podium = { champ, vice, third };
      db.save();
      await i.update({ components: [] });
      const ch = guild.channels.cache.get(g.channels.camp_anuncios) ?? i.channel;
      const embed = base().setTitle(`👑 TEMOS UM CAMPEÃO! — ${c.title}`)
        .setDescription([
          `🥇 **Campeão:** ${mention(c, champ)}`,
          `🥈 **Vice:** ${mention(c, vice)}`,
          third.length ? `🥉 **3º lugar:** ${third.map((u) => mention(c, u)).join(' e ')}` : null,
          line,
          c.premio ? `🎁 **Premiação:**\n${c.premio}` : null,
          '',
          `Parabéns ao novo **rei do X1** da ${config.brand.name}! 🚓💨`
        ].filter((l) => l !== null).join('\n'));
      await ch.send(withBanner({ content: '@everyone', embeds: [embed], allowedMentions: { parse: ['everyone', 'users'] } }, embed, 'campeonato')).catch(() => null);
      sendLog(guild, base().setDescription(`👑 ${c.title}: campeão <@${champ}>`));
      return;
    }
    case 'reset':
      return i.update({ content: null, files: [], attachments: [], embeds: [base().setDescription('🗑️ Encerrar este campeonato e liberar para criar um novo?\nO cargo de participante será **tirado de todos os inscritos**.')], components: [
        row(btn('camp:resetok', 'Sim, encerrar', '🗑️', ButtonStyle.Danger), btn('camp:panel', 'Cancelar', '⬅️'))] });
    case 'resetok': {
      await i.deferUpdate();
      if (c && g.roles.camp_participante) {
        for (const p of c.inscritos) await (await guild.members.fetch(p.userId).catch(() => null))?.roles.remove(g.roles.camp_participante).catch(() => null);
      }
      g.campHistory ??= [];
      if (c) g.campHistory.push({ title: c.title, date: c.date, podium: c.podium ?? null, players: c.inscritos.length });
      g.camp = null;
      g.campDisabled = true; // só cria outro quando clicarem em "Criar campeonato"
      db.save();
      return i.editReply(staffPanel(guild));
    }
  }
}

function reviewEmbed(c, entry, user) {
  return base()
    .setAuthor({ name: `Inscrição • ${user?.username ?? entry.userId}`, iconURL: user?.displayAvatarURL?.() })
    .setTitle(`✍️ Nova inscrição — ${c.title}`)
    .addFields(
      { name: `${e.user} Discord`, value: `<@${entry.userId}>\n\`${entry.userId}\``, inline: true },
      { name: '🎮 Nick no MTA', value: `**${entry.nick}**`, inline: true },
      { name: '🆔 ID na cidade', value: `**#${entry.gameId}**`, inline: true },
      { name: `${e.clock} Conta do Discord criada`, value: user?.createdTimestamp ? ts(user.createdTimestamp, 'R') : '—', inline: true },
      { name: '👥 Vagas', value: `${approved(c).length}/${c.max} aprovados`, inline: true }
    )
    .setThumbnail(user?.displayAvatarURL?.({ size: 256 }) ?? null);
}

const reviewButtons = (entry) => [row(
  btn(`camp:ap:${entry.userId}`, 'Aprovar', e.check, ButtonStyle.Success),
  btn(`camp:fix:${entry.userId}`, 'Corrigir e aprovar', '✏️', ButtonStyle.Primary),
  btn(`camp:rj:${entry.userId}`, 'Recusar', e.cross, ButtonStyle.Danger))];

async function closeReview(guild, entry, text) {
  if (!entry.review) return;
  const msg = await guild.channels.cache.get(entry.review.channelId)?.messages.fetch(entry.review.messageId).catch(() => null);
  if (!msg) return;
  await msg.edit({ content: null, embeds: [...msg.embeds, base().setDescription(text)], components: [] }).catch(() => null);
}

/** Aprova a inscrição: dá o cargo, avisa na DM, atualiza a lista */
async function approve(guild, c, entry, by, note) {
  const g = camp(guild.id);
  entry.status = 'aprovado';
  entry.approvedBy = by?.id ?? null;
  db.save();
  const member = await guild.members.fetch(entry.userId).catch(() => null);
  if (g.roles.camp_participante) await member?.roles.add(g.roles.camp_participante, 'Inscrição aprovada no campeonato').catch(() => null);
  if (by) await closeReview(guild, entry, `${e.approved} **Aprovado** por ${by}${note ? `\n${note}` : ''}`);
  (await guild.client.users.fetch(entry.userId).catch(() => null))?.send({ embeds: [base().setTitle(`${e.approved} Inscrição aprovada — ${c.title}`)
    .setDescription(`Você está no campeonato com o nick **${entry.nick}** \`#${entry.gameId}\`.${note ? `\n${note}` : ''}\n\n📅 ${fmtDate(c.date)}${g.channels.camp_chat ? `\n💬 Fique de olho em <#${g.channels.camp_chat}>.` : ''}`)] }).catch(() => null);
  await refreshSignup(guild);
}

function bracketView(c) {
  const r = c.rounds.at(-1);
  return { embeds: [bracketEmbed(c, r)], components: bracketComponents(c, r), files: [], attachments: [] };
}

async function postBracket(guild, c, r, fallback) {
  const g = camp(guild.id);
  const ch = guild.channels.cache.get(g.channels.camp_chaves ?? g.channels.camp_anuncios) ?? fallback;
  if (!ch) return;
  const embed = bracketEmbed(c, r);
  const payload = withBanner({ content: c.inscritos.length ? r.matches.flatMap((m) => (m.bye ? [m.bye] : [m.a, m.b])).map((u) => `<@${u}>`).join(' ') : null, embeds: [embed], components: bracketComponents(c, r), allowedMentions: { parse: ['users'] } }, embed, 'chaves');
  const msg = await ch.send(payload).catch(() => null);
  r.channelId = ch.id;
  r.messageId = msg?.id;
  db.save();
}

async function publish(i, action, ch) {
  const c = get(i.guild.id);
  c.inscricaoChannelId ??= camp(i.guild.id).channels.camp_inscricao ?? null; // o anúncio já mostra o canal de inscrição
  const payload = action === 'pubann' ? announceMessage(c) : action === 'pubrules' ? rulesMessage(c) : signupMessage(c);
  const msg = await ch.send(payload).catch((err) => err);
  if (msg instanceof Error) return i.update({ content: null, files: [], attachments: [], embeds: [error(`Não consegui publicar em ${ch}: ${msg.message}`)], components: [row(btn('camp:panel', 'Voltar', '⬅️'))] });
  if (action === 'pubsignup') { c.signupMsg = { channelId: ch.id, messageId: msg.id }; c.inscricaoChannelId = ch.id; db.save(); }
  if (action === 'pubann') { c.announceMsg = { channelId: ch.id, messageId: msg.id }; db.save(); }
  return i.update({ ...staffPanel(i.guild), embeds: [success(`Publicado em ${ch}.`), ...staffPanel(i.guild).embeds] });
}

module.exports = { handle, staffPanel, tick, announceMessage, rulesMessage, signupMessage, parseWhen, drawPhase, phaseName };
