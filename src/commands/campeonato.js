const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const perms = require('../utils/permissions');
const camp = require('../handlers/camp');

module.exports = {
  data: new SlashCommandBuilder().setName('campeonato').setDescription('🏆 Gerenciar o Campeonato X1 (por botões)'),
  async execute(i) {
    if (!(await perms.check(i, 'moderador'))) return;
    await i.reply({ ...camp.staffPanel(i.guild), flags: MessageFlags.Ephemeral });
  }
};
