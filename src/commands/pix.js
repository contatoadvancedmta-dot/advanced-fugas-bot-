/**
 * /pix — configura o PIX dos tickets pelo Discord (somente donos)
 */
const {
  SlashCommandBuilder, MessageFlags, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, AttachmentBuilder
} = require('discord.js');
const db = require('../database');
const perms = require('../utils/permissions');
const pix = require('../utils/pix');
const { base, success, error, e } = require('../utils/embeds');
const { sendLog } = require('../utils/logger');

const EPH = MessageFlags.Ephemeral;
const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Esconde o meio da chave para mostrar com segurança */
const mask = (k) => (!k ? '—' : k.length <= 8 ? k : `${k.slice(0, 4)}••••${k.slice(-4)}`);

function configEmbed(guildId) {
  const cfg = pix.getConfig(guildId);
  const saved = db.guild(guildId).pix ?? {};
  return base()
    .setTitle(`${e.money} Configuração do PIX`)
    .setDescription(cfg.key ? `${e.approved} PIX **ativo** — o botão **Gerar PIX** dos tickets já funciona.` : `${e.warn} PIX **não configurado**. Use \`/pix configurar\`.`)
    .addFields(
      { name: 'Tipo de chave', value: saved.keyType ? pix.KEY_TYPES[saved.keyType] : cfg.key ? 'definido no config.js' : '—', inline: true },
      { name: 'Chave', value: `\`${mask(cfg.key)}\``, inline: true },
      { name: 'Recebedor', value: cfg.receiverName || '—', inline: true },
      { name: 'Cidade', value: cfg.city || '—', inline: true },
      { name: 'Nome da loja', value: cfg.storeName || '—', inline: true },
      { name: 'Atualizado', value: saved.updatedAt ? `<t:${Math.floor(saved.updatedAt / 1000)}:R> por <@${saved.updatedBy}>` : '—', inline: true }
    );
}

function configModal(guildId) {
  const cfg = pix.getConfig(guildId);
  const saved = db.guild(guildId).pix ?? {};
  const text = (id, value, placeholder, max) => new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short)
    .setRequired(true).setMaxLength(max).setPlaceholder(placeholder).setValue(value || '');
  return new ModalBuilder().setCustomId('pixcfg:save').setTitle('Configurar PIX').addLabelComponents(
    new LabelBuilder().setLabel('Tipo de chave').setStringSelectMenuComponent(
      new StringSelectMenuBuilder().setCustomId('tipo').setRequired(true).setPlaceholder('Escolha o tipo da chave')
        .addOptions(Object.entries(pix.KEY_TYPES).map(([value, label]) => ({ label, value, default: value === saved.keyType })))),
    new LabelBuilder().setLabel('Chave PIX').setDescription('CPF/CNPJ com ou sem pontos, telefone com DDD, e-mail ou chave aleatória')
      .setTextInputComponent(text('chave', cfg.key, 'Ex: pagamentos@f1loja.com', 80)),
    new LabelBuilder().setLabel('Nome do recebedor').setDescription('Como aparece no banco (sem acentos, até 25 letras)')
      .setTextInputComponent(text('nome', cfg.receiverName, 'Ex: F1 LOJA', 25)),
    new LabelBuilder().setLabel('Cidade do recebedor').setTextInputComponent(text('cidade', cfg.city, 'Ex: SAO PAULO', 15)),
    new LabelBuilder().setLabel('Nome da loja (aparece na cobrança)').setTextInputComponent(text('loja', cfg.storeName, 'Ex: F1 Loja', 40))
  );
}

/** Formulário enviado */
async function handleModal(interaction) {
  if (!(await perms.check(interaction, 'owner'))) return;
  const type = interaction.fields.getStringSelectValues('tipo')?.[0];
  let key;
  try {
    key = pix.normalizeKey(type, interaction.fields.getTextInputValue('chave'));
  } catch (err) {
    return interaction.reply({ embeds: [error(`${err.message}\nUse \`/pix configurar\` de novo.`, 'Chave inválida')], flags: EPH });
  }
  const g = db.guild(interaction.guild.id);
  g.pix = {
    keyType: type, key,
    receiverName: interaction.fields.getTextInputValue('nome').trim(),
    city: interaction.fields.getTextInputValue('cidade').trim(),
    storeName: interaction.fields.getTextInputValue('loja').trim(),
    updatedBy: interaction.user.id, updatedAt: Date.now()
  };
  db.save();
  sendLog(interaction.guild, base().setTitle(`${e.money} PIX atualizado`).setDescription(`${interaction.user} alterou a chave PIX (${pix.KEY_TYPES[type]} \`${mask(key)}\`)`));
  await interaction.reply({ embeds: [success('PIX configurado! Use `/pix testar` para conferir no app do banco.', 'Salvo'), configEmbed(interaction.guild.id)], flags: EPH });
}

module.exports = {
  data: new SlashCommandBuilder().setName('pix').setDescription('💸 Configura o PIX dos tickets (somente donos)')
    .addSubcommand((s) => s.setName('configurar').setDescription('Abre o formulário para definir a chave PIX'))
    .addSubcommand((s) => s.setName('ver').setDescription('Mostra a configuração atual'))
    .addSubcommand((s) => s.setName('testar').setDescription('Gera um QR de teste (só você vê) para conferir no banco')
      .addNumberOption((o) => o.setName('valor').setDescription('Valor do teste (padrão R$ 1,00)').setMinValue(0.01).setMaxValue(10000)))
    .addSubcommand((s) => s.setName('remover').setDescription('Apaga a chave configurada pelo Discord')),
  handleModal,

  async execute(i) {
    if (!(await perms.check(i, 'owner'))) return;
    const sub = i.options.getSubcommand();
    if (sub === 'configurar') return i.showModal(configModal(i.guild.id));
    if (sub === 'ver') return i.reply({ embeds: [configEmbed(i.guild.id)], flags: EPH });
    if (sub === 'remover') {
      delete db.guild(i.guild.id).pix;
      db.save();
      return i.reply({ embeds: [success('Chave PIX removida. O botão **Gerar PIX** dos tickets fica desativado até configurar de novo.')], flags: EPH });
    }
    // testar
    const cfg = pix.getConfig(i.guild.id);
    if (!cfg.key) return i.reply({ embeds: [error('Configure primeiro com `/pix configurar`.')], flags: EPH });
    const value = i.options.getNumber('valor') ?? 1;
    const code = pix.payload({ key: cfg.key, name: cfg.receiverName, city: cfg.city, amount: value, txid: 'TESTE', description: 'Teste do bot' });
    const file = new AttachmentBuilder(await pix.qrBuffer(code), { name: 'pix-teste.png' });
    const embed = base()
      .setTitle(`${e.money} PIX de teste • ${cfg.storeName}`)
      .setDescription(`Abra o app do banco, escaneie o QR e **confira se o nome do recebedor está certo**.\n${e.warn} **Não precisa pagar** — é só para conferir.\n\n**Valor:** ${brl(value)}\n\`\`\`${code}\`\`\``)
      .setImage('attachment://pix-teste.png');
    await i.reply({ embeds: [embed], files: [file], flags: EPH });
  }
};
