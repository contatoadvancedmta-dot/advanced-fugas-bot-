const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, MessageFlags, ChannelType
} = require('discord.js');
const config = require('../../config');
const db = require('../database');
const { base, success, error, progressBar, e } = require('../utils/embeds');
const perms = require('../utils/permissions');
const { sendLog } = require('../utils/logger');

const EPH = MessageFlags.Ephemeral;

// getters para pegar o emoji atualizado (os emojis do bot são carregados ao ligar)
const STATUS = {
  pendente: { label: 'Em votação', get emoji() { return e.pending; }, color: config.colors.warning },
  aprovada: { label: 'Aprovada', get emoji() { return e.approved; }, color: config.colors.success },
  recusada: { label: 'Recusada', get emoji() { return e.rejected; }, color: config.colors.error }
};

/** Modal que o jogador preenche */
function modal() {
  return new ModalBuilder()
    .setCustomId('sug:submit')
    .setTitle('💡 Nova sugestão — Advanced')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('titulo').setLabel('Título da sugestão')
          .setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true)
          .setPlaceholder('Ex: Adicionar nova rota de fuga no porto')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('descricao').setLabel('Descreva sua ideia')
          .setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)
          .setPlaceholder('Explique com detalhes como funcionaria e por que melhora o servidor.')
      )
    );
}

function buildEmbed(sug, guild) {
  const s = STATUS[sug.status];
  const up = sug.up.length, down = sug.down.length;
  const embed = base(s.color)
    .setAuthor({ name: `Sugestão #${sug.id} • ${sug.authorTag}`, iconURL: sug.authorAvatar })
    .setTitle(`${e.suggestion} ${sug.title}`)
    .setDescription(`>>> ${sug.description}`)
    .addFields(
      { name: `${e.up} A favor`, value: `\`${up}\``, inline: true },
      { name: `${e.down} Contra`, value: `\`${down}\``, inline: true },
      { name: `${s.emoji} Status`, value: `**${s.label}**`, inline: true },
      { name: 'Aprovação da comunidade', value: progressBar(up, down) }
    )
    .setThumbnail(sug.authorAvatar);
  if (sug.reviewer) {
    embed.addFields({
      name: `${e.staff} Resposta da staff`,
      value: `${sug.reason || '*Sem motivo informado.*'}\n${e.arrow} por <@${sug.reviewer}>`
    });
  }
  return embed;
}

function buildButtons(sug) {
  const closed = sug.status !== 'pendente';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`sug:up:${sug.id}`).setEmoji(e.up)
        .setLabel(String(sug.up.length)).setStyle(ButtonStyle.Success).setDisabled(closed),
      new ButtonBuilder().setCustomId(`sug:down:${sug.id}`).setEmoji(e.down)
        .setLabel(String(sug.down.length)).setStyle(ButtonStyle.Danger).setDisabled(closed),
      new ButtonBuilder().setCustomId(`sug:approve:${sug.id}`).setEmoji(e.check)
        .setLabel('Aprovar').setStyle(ButtonStyle.Secondary).setDisabled(closed),
      new ButtonBuilder().setCustomId(`sug:reject:${sug.id}`).setEmoji(e.cross)
        .setLabel('Recusar').setStyle(ButtonStyle.Secondary).setDisabled(closed)
    )
  ];
}

async function submit(interaction) {
  const g = db.guild(interaction.guild.id);
  const channel = g.channels.sugestoes && interaction.guild.channels.cache.get(g.channels.sugestoes);
  if (!channel) {
    return interaction.reply({ embeds: [error('O canal de sugestões ainda não foi configurado. Peça para um admin usar `/setup canal`.')], flags: EPH });
  }

  const sug = {
    id: ++g.suggestionCounter,
    title: interaction.fields.getTextInputValue('titulo'),
    description: interaction.fields.getTextInputValue('descricao'),
    authorId: interaction.user.id,
    authorTag: interaction.user.username,
    authorAvatar: interaction.user.displayAvatarURL(),
    up: [], down: [],
    status: 'pendente',
    createdAt: Date.now()
  };

  const msg = await channel.send({ embeds: [buildEmbed(sug)], components: buildButtons(sug) });
  sug.messageId = msg.id;
  sug.channelId = channel.id;
  g.suggestions[sug.id] = sug;
  db.save();

  if (channel.type === ChannelType.GuildText) {
    msg.startThread({ name: `💬 Sugestão #${sug.id} — Debate`, autoArchiveDuration: 10080 }).catch(() => null);
  }

  await interaction.reply({
    embeds: [success(`Sua sugestão **#${sug.id}** foi enviada em ${channel}!\nA comunidade já pode votar. ${e.star}`, 'Sugestão enviada')],
    flags: EPH
  });
}

async function vote(interaction, sug, type) {
  const uid = interaction.user.id;
  const other = type === 'up' ? 'down' : 'up';
  sug[other] = sug[other].filter((id) => id !== uid);
  let text;
  if (sug[type].includes(uid)) {
    sug[type] = sug[type].filter((id) => id !== uid);
    text = 'Seu voto foi **removido**.';
  } else {
    sug[type].push(uid);
    text = `Você votou ${type === 'up' ? `**a favor** ${e.up}` : `**contra** ${e.down}`}.`;
  }
  db.save();
  await interaction.update({ embeds: [buildEmbed(sug)], components: buildButtons(sug) });
  await interaction.followUp({ embeds: [success(text, 'Voto registrado')], flags: EPH });
}

async function askReason(interaction, sug, action) {
  if (!(await perms.check(interaction, 'moderador'))) return;
  const m = new ModalBuilder()
    .setCustomId(`sug:reason:${action}:${sug.id}`)
    .setTitle(`${action === 'approve' ? 'Aprovar' : 'Recusar'} sugestão #${sug.id}`)
    .addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('motivo').setLabel('Motivo / resposta (opcional)')
        .setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
    ));
  await interaction.showModal(m);
}

async function review(interaction, sug, action) {
  sug.status = action === 'approve' ? 'aprovada' : 'recusada';
  sug.reviewer = interaction.user.id;
  sug.reason = interaction.fields.getTextInputValue('motivo');
  db.save();

  const channel = interaction.guild.channels.cache.get(sug.channelId);
  const msg = channel && (await channel.messages.fetch(sug.messageId).catch(() => null));
  if (msg) await msg.edit({ embeds: [buildEmbed(sug)], components: buildButtons(sug) });

  const st = STATUS[sug.status];
  await interaction.reply({ embeds: [success(`Sugestão **#${sug.id}** marcada como ${st.emoji} **${st.label}**.`)], flags: EPH });

  // Avisa o autor na DM
  const author = await interaction.client.users.fetch(sug.authorId).catch(() => null);
  author?.send({
    embeds: [base(st.color)
      .setTitle(`${st.emoji} Sua sugestão foi ${st.label.toLowerCase()}!`)
      .setDescription(`**${sug.title}**\n\n${sug.reason ? `> ${sug.reason}` : ''}`)
      .addFields({ name: 'Servidor', value: interaction.guild.name, inline: true })]
  }).catch(() => null);

  sendLog(interaction.guild, base(st.color).setTitle(`${e.log} Sugestão revisada`)
    .setDescription(`**#${sug.id}** — ${sug.title}\n${st.emoji} ${st.label} por ${interaction.user}`));
}

/** Roteador de customIds "sug:..." */
async function handle(interaction) {
  const [, action, a, b] = interaction.customId.split(':');
  if (action === 'open') return interaction.showModal(modal());
  if (action === 'submit') return submit(interaction);

  const g = db.guild(interaction.guild.id);
  const id = action === 'reason' ? b : a;
  const sug = g.suggestions[id];
  if (!sug) return interaction.reply({ embeds: [error('Sugestão não encontrada.')], flags: EPH });
  if (sug.status !== 'pendente') return interaction.reply({ embeds: [error('Essa sugestão já foi revisada.')], flags: EPH });

  if (action === 'up' || action === 'down') return vote(interaction, sug, action);
  if (action === 'approve' || action === 'reject') return askReason(interaction, sug, action);
  if (action === 'reason') return review(interaction, sug, a);
}

module.exports = { handle, modal };
