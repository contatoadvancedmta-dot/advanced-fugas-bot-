/**
 * STATUS DO SERVIDOR FIVEM — mensagem que se atualiza sozinha
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, e, line } = require('../utils/embeds');
const { withBanner } = require('../utils/banner');

let last = { online: false, players: [], max: 0 };

async function fetchStatus() {
  const { ip } = config.fivem;
  if (!ip) return { online: false, configured: false, players: [], max: 0 };
  try {
    const opts = { signal: AbortSignal.timeout(5000) };
    const [dyn, players] = await Promise.all([
      fetch(`http://${ip}/dynamic.json`, opts).then((r) => r.json()),
      fetch(`http://${ip}/players.json`, opts).then((r) => r.json())
    ]);
    last = { online: true, configured: true, players, max: Number(dyn.sv_maxclients) || 0, hostname: dyn.hostname };
  } catch {
    last = { online: false, configured: true, players: [], max: 0 };
  }
  return last;
}

function bar(n, max, size = 14) {
  const filled = max ? Math.round((n / max) * size) : 0;
  return `\`${'█'.repeat(filled)}${'░'.repeat(size - filled)}\``;
}

function statusMessage(s) {
  const n = s.players.length;
  const embed = base(s.online ? config.colors.success : config.colors.error)
    .setTitle(`${e.server} Status — ${config.brand.name}`)
    .setThumbnail(config.brand.logo);

  if (!s.configured) {
    embed.setDescription(`${e.warn} Configure o IP do servidor em \`config.js\` → \`fivem.ip\`.`);
  } else if (!s.online) {
    embed.setDescription(`${e.offline} **Servidor OFFLINE**\n${line}\nA cidade está fora do ar no momento. Fique de olho nos anúncios!`);
  } else {
    const list = s.players.sort((a, b) => a.id - b.id).slice(0, 30).map((p) => `\`${String(p.id).padStart(3, ' ')}\` ${p.name}`).join('\n');
    embed.setDescription(`${e.online} **Servidor ONLINE**\n${line}`)
      .addFields(
        { name: `${e.user} Jogadores`, value: `**${n}/${s.max}**\n${bar(n, s.max)}`, inline: true },
        { name: `${e.clock} Atualizado`, value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      );
    if (config.brand.connect) embed.addFields({ name: `${e.car} Conectar`, value: `\`\`\`${config.brand.connect}\`\`\`` });
    if (list) embed.addFields({ name: `Na cidade agora${n > 30 ? ` (30 de ${n})` : ''}`, value: list.slice(0, 1024) });
  }
  const components = config.fivem.joinUrl ? [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('Entrar na cidade').setEmoji(e.car).setStyle(ButtonStyle.Link).setURL(config.fivem.joinUrl)
  )] : [];
  return withBanner({ embeds: [embed], components }, embed, 'status');
}

/** Atualiza a mensagem de status em todos os servidores (chamado em intervalo) */
async function tick(client) {
  if (!config.fivem.ip) return;
  const s = await fetchStatus();
  for (const guild of client.guilds.cache.values()) {
    const g = db.guild(guild.id);
    const channel = g.channels.status && guild.channels.cache.get(g.channels.status);
    if (!channel) continue;
    const payload = statusMessage(s);
    const msg = g.status.messageId && (await channel.messages.fetch(g.status.messageId).catch(() => null));
    if (msg) {
      // não reenviar o arquivo a cada minuto: reaproveita o banner que já está na mensagem
      if (payload.files && msg.attachments.some((a) => a.name === 'status.png')) delete payload.files; // anexo já está lá
      await msg.edit(payload).catch(() => null);
    }
    else {
      const sent = await channel.send(payload).catch(() => null);
      if (sent) { g.status.messageId = sent.id; db.save(); }
    }
  }
}

module.exports = { fetchStatus, statusMessage, tick, getLast: () => last };
