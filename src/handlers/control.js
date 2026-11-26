/**
 * CENTRAL DE CONTROLE — configura o bot inteiro por botões e menus (sem digitar comando).
 * Abre com /central ou pelo painel "Central de Controle" (botão Abrir).
 */
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  UserSelectMenuBuilder, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle, MessageFlags, AttachmentBuilder
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, e, line } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { withBanner } = require('../utils/banner');

const EPH = MessageFlags.Ephemeral;
const setup = () => require('../commands/setup');
const painel = () => require('../commands/painel');
const row = (...c) => new ActionRowBuilder().addComponents(...c);
const btn = (id, label, emoji, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
const back = (to = 'cp:home', label = 'Voltar') => btn(to, label, '⬅️');

/* ───────────── Menu principal ───────────── */

function home(guild) {
  const g = db.guild(guild.id);
  const { SECTIONS, ROLES } = setup();
  const allCh = Object.values(SECTIONS).flatMap((s) => Object.keys(s.items));
  const chOk = allCh.filter((k) => g.channels[k]).length;
  const rolesOk = Object.keys(ROLES).filter((k) => g.roles[k]).length;
  const pixOk = !!require('../utils/pix').getConfig(guild.id).key;
  const facs = Object.keys(g.clas ?? {}).length;
  const embed = base()
    .setTitle(`🎛️ Central de Controle — ${config.brand.name}`)
    .setDescription([
      'Configure tudo por aqui, só com botões. Escolha uma área:',
      line,
      `${chOk === allCh.length ? e.check : e.warn} **Canais:** ${chOk}/${allCh.length} configurados`,
      `${rolesOk >= 3 ? e.check : e.warn} **Cargos:** ${rolesOk}/${Object.keys(ROLES).length} configurados`,
      `${config.fivem.ip ? e.check : e.warn} **Cidade:** ${config.fivem.ip ? `\`${config.fivem.ip}\`` : 'IP não definido'}`,
      `${pixOk ? e.check : e.warn} **PIX:** ${pixOk ? 'ativo' : 'não configurado'}`,
      `🏴 **Clãs:** ${facs}`
    ].join('\n'));
  return {
    content: null, embeds: [embed], files: [], attachments: [],
    components: [
      row(btn('cp:ch', 'Canais', '📁', ButtonStyle.Primary), btn('cp:role', 'Cargos', '👥', ButtonStyle.Primary), btn('cp:panel', 'Enviar painéis', '🧩', ButtonStyle.Primary), btn('cp:city', 'Cidade', '🏙️', ButtonStyle.Primary)),
      row(btn('cp:pix', 'PIX', '💸'), btn('cp:fac', 'Clãs', '🏴'), btn('cp:ann', 'Anúncio', '📢'), btn('cp:team', 'Equipe', '👑')),
      row(btn('cp:view', 'Ver tudo que está configurado', '📋'))
    ]
  };
}

/** Mensagem fixa com o botão "Abrir central" (para deixar num canal da staff) */
function panel() {
  const embed = base().setTitle(`🎛️ Central de Controle — ${config.brand.name}`)
    .setDescription(`Configure canais, cargos, painéis, cidade, PIX, clãs e equipe **só com botões**.\n${line}\n${e.lock} Só a administração consegue abrir.`);
  return withBanner({ embeds: [embed], components: [row(btn('cp:open', 'Abrir central', '🎛️', ButtonStyle.Primary))] }, embed, 'staff');
}

const page = (title, desc, components) => ({ content: null, embeds: [base().setTitle(title).setDescription(desc)], components, files: [], attachments: [] });
const done = (text, to) => ({ content: null, embeds: [success(text, 'Pronto')], components: [row(back(to, 'Continuar'), back('cp:home', 'Menu'))], files: [], attachments: [] });

/* ───────────── Telas ───────────── */

function channelSections(guild) {
  const g = db.guild(guild.id);
  const { SECTIONS } = setup();
  return page('📁 Canais', 'Escolha a área que você quer configurar:', [
    row(new StringSelectMenuBuilder().setCustomId('cp:chsec').setPlaceholder('Escolha a área').addOptions(Object.entries(SECTIONS).map(([k, s]) => {
      const keys = Object.keys(s.items);
      return { label: s.title.replace(/^\S+\s/, '').slice(0, 100), value: k, emoji: s.title.split(' ')[0], description: `${keys.filter((x) => g.channels[x]).length}/${keys.length} configurados` };
    }))),
    row(back())
  ]);
}

function channelItems(guild, section) {
  const g = db.guild(guild.id);
  const sec = setup().SECTIONS[section];
  return page(sec.title, `Escolha o que configurar:${section === 'staff' ? `\n${e.lock} Canais da staff são **trancados** automaticamente para só a equipe ver.` : ''}`, [
    row(new StringSelectMenuBuilder().setCustomId(`cp:chitem:${section}`).setPlaceholder('Escolha o item').addOptions(Object.entries(sec.items).map(([k, label]) => {
      const ch = g.channels[k] && guild.channels.cache.get(g.channels[k]);
      return { label: label.slice(0, 100), value: k, emoji: ch ? '✅' : '❌', description: ch ? `#${ch.name}`.slice(0, 100) : 'não configurado' };
    }))),
    row(back('cp:ch'))
  ]);
}

function rolesPage(guild) {
  const g = db.guild(guild.id);
  const { ROLES } = setup();
  return page('👥 Cargos', 'Escolha qual cargo configurar:', [
    row(new StringSelectMenuBuilder().setCustomId('cp:rolekey').setPlaceholder('Escolha o cargo').addOptions(Object.entries(ROLES).slice(0, 25).map(([k, label]) => {
      const r = g.roles[k] && guild.roles.cache.get(g.roles[k]);
      return { label: label.slice(0, 100), value: k, emoji: r ? '✅' : '❌', description: r ? `@${r.name}`.slice(0, 100) : 'não configurado' };
    }))),
    row(back())
  ]);
}

function panelsPage() {
  return page('🧩 Enviar painéis', 'Escolha o painel e depois o canal onde ele vai ficar:', [
    row(new StringSelectMenuBuilder().setCustomId('cp:pansel').setPlaceholder('Escolha o painel').addOptions(painel().PANEL_CHOICES().slice(0, 25).map((c) => ({ label: c.name.replace(/^\S+\s/, '').slice(0, 100), value: c.value, emoji: c.name.split(' ')[0] })))),
    row(back())
  ]);
}

function cityPage(guild) {
  const g = db.guild(guild.id);
  return page('🏙️ Cidade', [
    `**IP:** ${config.fivem.ip ? `\`${config.fivem.ip}\`` : '`não definido`'}`,
    `**Conectar:** ${config.brand.connect ? `\`${config.brand.connect}\`` : '—'}`,
    `**Contadores:** ${g.channels.contador ? `<#${g.channels.contador}>` : 'não criados'}`
  ].join('\n'), [
    row(btn('cp:cityip', 'Definir IP', '🌐', ButtonStyle.Primary), btn('cp:counters', 'Criar contadores', '📊')),
    row(back())
  ]);
}

function pixPage(guild) {
  const pixCmd = require('../commands/pix');
  return { content: null, files: [], attachments: [], embeds: [pixCmd.configEmbed(guild.id)], components: [
    row(btn('cp:pixcfg', 'Configurar chave', '💸', ButtonStyle.Primary), btn('cp:pixtest', 'Gerar QR de teste', '🧪'), btn('cp:pixdel', 'Remover chave', '🗑️', ButtonStyle.Danger)),
    row(new StringSelectMenuBuilder().setCustomId('cp:pixstyle').setPlaceholder('🎨 Visual do QR Code').addOptions(Object.entries(QR_PRESETS).map(([k, p]) => ({ label: p.label, value: k, emoji: p.emoji })))),
    row(back())
  ] };
}

const QR_PRESETS = {
  laranja_bolinhas: { label: 'Laranja Advanced • bolinhas', emoji: '🟠', qr: { dark: '#c2410c', light: '#ffffff', style: 'redondo', logo: 'bot', frame: '#f97316' } },
  laranja: { label: 'Laranja Advanced • clássico', emoji: '🧡', qr: { dark: '#9a3412', light: '#ffffff', style: 'quadrado', logo: 'bot', frame: '#f97316' } },
  preto: { label: 'Preto clássico', emoji: '⬛', qr: { dark: '#111111', light: '#ffffff', style: 'quadrado', logo: 'bot', frame: '#f97316' } },
  servidor: { label: 'Com o ícone do servidor', emoji: '🚔', qr: { dark: '#9a3412', light: '#ffffff', style: 'redondo', logo: 'servidor', frame: '#f97316' } },
  simples: { label: 'Simples (sem logo e sem moldura)', emoji: '⚪', qr: { dark: '#111111', light: '#ffffff', style: 'quadrado', logo: 'nenhuma', frame: null } }
};

function facPage(guild) {
  const clas = require('./clas');
  const all = Object.values(clas.clans(guild.id));
  const comps = [row(btn('cp:faccreate', 'Registrar clã', '➕', ButtonStyle.Success))];
  if (all.length) {
    comps.push(row(new StringSelectMenuBuilder().setCustomId('cp:facpick').setPlaceholder('Gerenciar um clã').addOptions(all.slice(0, 25).map((c) => ({
      label: `[${c.sigla}] ${c.nome}`.slice(0, 100), value: c.id, emoji: '🏴', description: `${c.membros.length} membros • ${c.wins}V/${c.losses}D` })))));
  }
  comps.push(row(back()));
  return page('🏴 Clãs', all.length ? all.map((c) => `🏴 **[${c.sigla}] ${c.nome}** — líder <@${c.liderId}> • ${c.membros.length} membros • ${c.wins}V/${c.losses}D`).join('\n').slice(0, 3500) : 'Nenhum clã ainda. Registre aqui ou pelo botão **Registrar clã** do ticket de Clãs.', comps);
}

function facManage(guild, c, note) {
  const clas = require('./clas');
  if (!c) return facPage(guild);
  const embeds = [clas.infoEmbed(c)];
  if (note) embeds.unshift(base().setDescription(note.slice(0, 4000)));
  return { content: null, files: [], attachments: [], embeds, components: [
    row(new UserSelectMenuBuilder().setCustomId(`cp:facadd:${c.id}`).setPlaceholder('➕ Dar a tag do clã').setMaxValues(10)),
    row(new UserSelectMenuBuilder().setCustomId(`cp:facrem:${c.id}`).setPlaceholder('➖ Tirar a tag do clã').setMaxValues(10)),
    row(new UserSelectMenuBuilder().setCustomId(`cp:faclead:${c.id}`).setPlaceholder('👑 Trocar o líder').setMaxValues(1)),
    row(back('cp:fac'), btn(`cp:facdel:${c.id}`, 'Excluir clã', '🗑️', ButtonStyle.Danger))
  ] };
}

/* ───────────── Roteador "cp:..." ───────────── */

const OWNER_ONLY = new Set(['pix', 'pixcfg', 'pixtest', 'pixdel', 'pixstyle', 'team', 'cityip', 'cityipm']);

async function handle(i) {
  const [, action, a, b] = i.customId.split(':');
  if (!(await perms.check(i, OWNER_ONLY.has(action) ? 'owner' : 'admin'))) return;
  const guild = i.guild;
  const g = db.guild(guild.id);

  switch (action) {
    case 'open': return i.reply({ ...home(guild), flags: EPH });
    case 'home': return i.update(home(guild));
    case 'view': return i.update({ content: null, embeds: [setup().configEmbed(guild)], components: [row(back())], files: [], attachments: [] });

    /* canais */
    case 'ch': return i.update(channelSections(guild));
    case 'chsec': return i.update(channelItems(guild, i.values[0]));
    case 'chitem': {
      const tipo = i.values[0];
      const label = setup().SECTIONS[a].items[tipo];
      return i.update(page(`📁 ${label}`, `Escolha o canal para **${label}**:`, [
        row(new ChannelSelectMenuBuilder().setCustomId(`cp:chset:${a}:${tipo}`).setPlaceholder('Escolha o canal').setChannelTypes(...setup().TYPES_FOR[a])),
        row(back(`cp:chback:${a}`))
      ]));
    }
    case 'chback': return i.update(channelItems(guild, a));
    case 'chset': {
      await i.deferUpdate();
      const ch = guild.channels.cache.get(i.values[0]);
      const notes = await setup().applyChannel(i, a, b, ch, true);
      return i.editReply(done(notes.join('\n'), `cp:chback:${a}`));
    }

    /* cargos */
    case 'role': return i.update(rolesPage(guild));
    case 'rolekey': return i.update(page(`👥 ${setup().ROLES[i.values[0]]}`, 'Escolha o cargo:', [
      row(new RoleSelectMenuBuilder().setCustomId(`cp:roleset:${i.values[0]}`).setPlaceholder('Escolha o cargo')), row(back('cp:role'))]));
    case 'roleset': {
      g.roles[a] = i.values[0];
      db.save();
      let extra = '';
      if ([...Object.keys(config.levels), 'staff', 'ticket'].includes(a)) {
        await i.deferUpdate();
        const n = await require('./tickets').syncStaffAccess(guild);
        extra = `\n${e.ticket} Esse cargo agora vê os tickets${n ? ` (inclusive os **${n}** abertos)` : ''}.`;
        return i.editReply(done(`**${setup().ROLES[a]}** → <@&${i.values[0]}>${extra}`, 'cp:role'));
      }
      return i.update(done(`**${setup().ROLES[a]}** → <@&${i.values[0]}>`, 'cp:role'));
    }

    /* painéis */
    case 'panel': return i.update(panelsPage());
    case 'pansel': return i.update(page('🧩 Onde enviar?', 'Escolha o canal:', [
      row(new ChannelSelectMenuBuilder().setCustomId(`cp:panch:${i.values[0]}`).setPlaceholder('Escolha o canal').setChannelTypes(0, 5)), row(back('cp:panel'))]));
    case 'panch': {
      if (a === 'staff' && !(await perms.check(i, 'owner'))) return;
      await i.deferUpdate();
      const ch = guild.channels.cache.get(i.values[0]);
      await painel().sendPanel(guild, a, ch);
      return i.editReply(done(`Painel enviado em ${ch}.`, 'cp:panel'));
    }

    /* cidade */
    case 'city': return i.update(cityPage(guild));
    case 'cityip': return i.showModal(new ModalBuilder().setCustomId('cp:cityipm').setTitle('IP da cidade').addLabelComponents(
      new LabelBuilder().setLabel('IP:PORTA do MTA').setTextInputComponent(new TextInputBuilder().setCustomId('ip').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('191.96.78.19:22003').setValue(config.fivem.ip ?? '')),
      new LabelBuilder().setLabel('Link https do botão Entrar (opcional)').setTextInputComponent(new TextInputBuilder().setCustomId('link').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.fivem.joinUrl ?? ''))));
    case 'cityipm': {
      const ip = i.fields.getTextInputValue('ip').trim().replace(/^mtasa:\/\//, '');
      const link = i.fields.getTextInputValue('link').trim();
      if (!/^[\w.-]+:\d{2,5}$/.test(ip)) return i.reply({ embeds: [error('Use o formato **IP:PORTA**, ex: `191.96.78.19:22003`.')], flags: EPH });
      if (link && !/^https:\/\//.test(link)) return i.reply({ embeds: [error('O link precisa começar com https://')], flags: EPH });
      db.global().cidade = { ip, link: link || null };
      db.save();
      require('../utils/city').applySaved();
      require('./fivem').tick(i.client).catch(() => null);
      return i.update(cityPage(guild));
    }
    case 'counters': {
      await i.deferUpdate();
      const status = config.fivem.ip ? await require('./fivem').fetchStatus() : null;
      const created = await require('./counters').create(guild, status);
      return i.editReply(done(`Contadores criados no topo do servidor:\n${created.map((c) => `${e.arrow} ${c}`).join('\n')}`, 'cp:city'));
    }

    /* pix */
    case 'pix': return i.update(pixPage(guild));
    case 'pixcfg': return i.showModal(require('../commands/pix').configModal(guild.id));
    case 'pixdel':
      delete g.pix;
      db.save();
      return i.update(pixPage(guild));
    case 'pixstyle': {
      g.pix ??= {};
      g.pix.qr = { ...QR_PRESETS[i.values[0]].qr };
      db.save();
      return pixTest(i, true);
    }
    case 'pixtest': return pixTest(i);

    /* facções */
    case 'fac': return i.update(facPage(guild));
    case 'faccreate': return i.showModal(require('./clas').registerModal(i.user.id).setCustomId('cp:faccm'));
    case 'faccm': {
      const clas = require('./clas');
      await i.deferUpdate();
      const lider = i.fields.getSelectedUsers('lider')?.first();
      const r = await clas.create(guild, i.user, { nome: i.fields.getTextInputValue('nome'), sigla: i.fields.getTextInputValue('sigla'), liderId: lider?.id, createChannel: i.fields.getStringSelectValues('canal')?.[0] === 'sim' });
      if (r.error) return i.editReply(facManage(guild, null)).then(() => i.followUp({ embeds: [error(r.error)], flags: EPH }));
      return i.editReply(facManage(guild, r.c, `${e.check} Clã registrado! ${r.roleCreated ? `Cargo <@&${r.c.roleId}> **criado**` : r.c.roleId ? `Cargo existente <@&${r.c.roleId}> usado` : 'Sem cargo'} e entregue ao líder.`));
    }
    case 'facpick': return i.update(facManage(guild, require('./clas').clans(guild.id)[i.values[0]]));
    case 'facadd':
    case 'facrem': {
      const clas = require('./clas');
      const c = clas.clans(guild.id)[a];
      if (!c) return i.update(facPage(guild));
      await i.deferUpdate();
      const out = [];
      for (const uid of i.values) {
        const r = await clas.setMember(guild, c, uid, action === 'facadd');
        out.push(r.error ? `${e.cross} ${r.error}` : `${e.check} ${r.text}`);
      }
      return i.editReply(facManage(guild, c, out.join('\n')));
    }
    case 'faclead': {
      const clas = require('./clas');
      const c = clas.clans(guild.id)[a];
      if (!c) return i.update(facPage(guild));
      await i.deferUpdate();
      const r = await clas.setLeader(guild, c, i.values[0]);
      return i.editReply(facManage(guild, c, r.error ? `${e.cross} ${r.error}` : `${e.check} ${r.text}`));
    }
    case 'facdel': return i.update(page('🗑️ Excluir clã?', 'Isso apaga o clã. O cargo é **apagado se foi o bot que criou**; se já existia, só é tirado dos membros. Tem certeza?', [
      row(btn(`cp:facdelok:${a}`, 'Sim, excluir', '🗑️', ButtonStyle.Danger), back(`cp:facback:${a}`, 'Cancelar'))]));
    case 'facback': return i.update(facManage(guild, require('./clas').clans(guild.id)[a]));
    case 'facdelok': {
      const clas = require('./clas');
      const c = clas.clans(guild.id)[a];
      await i.deferUpdate();
      if (c) await clas.remove(guild, c);
      return i.editReply(facPage(guild));
    }

    /* anúncio */
    case 'ann': return i.update(page('📢 Novo anúncio', 'Escolha um modelo para começar:', [
      row(new StringSelectMenuBuilder().setCustomId('cp:anntpl').setPlaceholder('Escolha o modelo').addOptions(Object.entries(config.announceTemplates).map(([k, t]) => ({ label: t.label, value: k })))),
      row(back())]));
    case 'anntpl': {
      const ann = require('./announce');
      return i.showModal(ann.textModal(ann.newDraft(i, i.values[0])));
    }

    /* equipe */
    case 'team': {
      const p = require('./admin').panel();
      return i.update({ content: null, attachments: [], ...p, components: [...p.components, row(back())] });
    }
  }
}

async function pixTest(i, styleChanged = false) {
  const pix = require('../utils/pix');
  const cfg = pix.getConfig(i.guild.id);
  const code = pix.payload({ key: cfg.key || 'exemplo@advanced.com', name: cfg.receiverName || 'ADVANCED', city: cfg.city || 'SAO PAULO', amount: 1, txid: 'TESTE' });
  await i.deferUpdate();
  const file = new AttachmentBuilder(await pix.qrBuffer(code, i.guild), { name: 'qr.png' });
  const embed = base().setTitle(styleChanged ? '🎨 Visual do QR salvo!' : '🧪 QR de teste')
    .setDescription(`${cfg.key ? 'Escaneie no app do banco e confira o **nome do recebedor** (não precisa pagar).' : `${e.warn} Chave ainda não configurada — este QR usa uma chave de exemplo.`}`)
    .setImage('attachment://qr.png');
  await i.editReply({ content: null, embeds: [embed], files: [file], attachments: [], components: [row(back('cp:pix'), back('cp:home', 'Menu'))] });
}

module.exports = { handle, home, panel };
