/**
 * CANAL DE RANKINGS — mensagens fixas que o bot edita sozinho (não spamma o canal)
 */
const config = require('../../config');
const db = require('../database');
const ticketStats = require('./ticketStats');

const BOARDS = {
  tickets: (guild) => ticketStats.rankingEmbed(guild, 30),
  apoiadores: (guild) => ticketStats.supportersEmbed(guild, 0),
  fugas: (guild) => require('./fugas').rankingEmbed(guild, 'geral')
};

let running = false;
async function update(client) {
  if (running) return;
  running = true;
  try {
    for (const guild of client.guilds.cache.values()) {
      const g = db.guild(guild.id);
      const ch = g.channels.rankings && guild.channels.cache.get(g.channels.rankings);
      if (!ch) continue;
      g.rankingMessages ??= {};
      for (const key of config.rankingBoard ?? Object.keys(BOARDS)) {
        if (!BOARDS[key]) continue;
        const payload = BOARDS[key](guild);
        const em = payload.embeds[0];
        em.setDescription(`${em.data.description ?? ''}\n\n-# 🔄 Atualiza sozinho • última atualização <t:${Math.floor(Date.now() / 1000)}:R>`);
        const msg = g.rankingMessages[key] && (await ch.messages.fetch(g.rankingMessages[key]).catch(() => null));
        if (msg) {
          if (payload.files && msg.attachments.size) delete payload.files; // banner já está na mensagem
          await msg.edit(payload).catch((err) => console.error('[Rankings]', err.message));
        } else {
          const sent = await ch.send(payload).catch((err) => console.error('[Rankings]', err.message));
          if (sent) { g.rankingMessages[key] = sent.id; db.save(); }
        }
      }
    }
  } finally {
    running = false;
  }
}

/** Pede uma atualização em breve (junta vários eventos seguidos numa só edição) */
let timer = null;
function touch(client) {
  clearTimeout(timer);
  timer = setTimeout(() => update(client).catch(() => null), 20_000);
}

module.exports = { update, touch, BOARDS };
