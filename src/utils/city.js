/** IP da cidade salvo pela Central de Controle (vale por cima do config.js) */
const config = require('../../config');
const db = require('../database');

function applySaved() {
  const c = db.global().cidade;
  if (!c?.ip) return;
  config.fivem.ip = c.ip;
  config.brand.connect = `mtasa://${c.ip}`;
  if (c.link) config.fivem.joinUrl = c.link;
}

module.exports = { applySaved };
