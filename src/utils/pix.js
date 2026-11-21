/**
 * Gerador de PIX "copia e cola" (BR Code / EMV padrão Banco Central) + QR Code
 * Funciona com qualquer chave: CPF, CNPJ, e-mail, telefone (+55...) ou aleatória.
 */
const QRCode = require('qrcode');

const field = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

// remove acentos e caracteres que o padrão não aceita
const clean = (s, max) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .\-@+]/g, '').toUpperCase().slice(0, max);

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * @param {{key:string, name:string, city:string, amount?:number, txid?:string, description?:string}} o
 */
function payload({ key, name, city, amount, txid, description }) {
  const account = field('00', 'br.gov.bcb.pix') + field('01', key.trim()) +
    (description ? field('02', clean(description, 40)) : '');
  let p = field('00', '01') +
    field('26', account) +
    field('52', '0000') +
    field('53', '986') +
    (amount ? field('54', Number(amount).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', clean(name, 25)) +
    field('60', clean(city, 15)) +
    field('62', field('05', (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'));
  p += '6304';
  return p + crc16(p);
}

async function qrBuffer(code) {
  return QRCode.toBuffer(code, { width: 420, margin: 2, errorCorrectionLevel: 'M' });
}

module.exports = { payload, qrBuffer, crc16 };
