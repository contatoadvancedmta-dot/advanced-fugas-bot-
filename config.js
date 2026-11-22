/**
 * ╔══════════════════════════════════════════════╗
 * ║        ADVANCED FUGAS — CONFIGURAÇÃO          ║
 * ╚══════════════════════════════════════════════╝
 *
 * EMOJIS PERSONALIZADOS:
 *  1. Envie o emoji no Discord com uma barra antes:  \:advanced_check:
 *  2. O Discord mostra algo como  <:advanced_check:123456789012345678>
 *  3. Cole aqui no lugar do emoji padrão.
 *  Emoji animado fica assim: <a:nome:ID>
 */
module.exports = {
  // IDs dos DONOS (acesso total, gerenciam os administradores)
  owners: [
    // '123456789012345678',
  ],

  brand: {
    name: 'Advanced Fugas',
    footer: 'Advanced Fugas • Sistema Oficial',
    logo: 'auto', // 'auto' = usa o ícone do servidor (ou a foto do bot). Ou coloque um link de imagem
    banner: null, // URL de banner reserva (usado só se faltar o arquivo em assets/banners)
    site: null,   // ex: 'https://advancedfugas.com'
    connect: 'mtasa://191.96.78.19:22575' // endereço para entrar na cidade
  },

  /**
   * EMBEDS INVISÍVEIS: a barrinha lateral fica da mesma cor do fundo do Discord (some).
   * Coloque false para voltar a usar as cores (laranja, verde, vermelho...).
   */
  invisibleEmbeds: true,
  invisibleColor: 0x2b2d31, // cor do fundo das embeds no tema escuro do Discord

  // Banners de assets/banners são enviados junto com os painéis (false = desliga)
  banners: true,

  colors: {
    primary: 0xf97316,  // laranja Advanced
    success: 0x22c55e,
    error: 0xef4444,
    warning: 0xf59e0b,
    info: 0x3b82f6,
    dark: 0x2b2d31
  },

  emojis: {
    logo: '🔥',
    check: '✅',
    cross: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    crown: '👑',
    shield: '🛡️',
    staff: '🛠️',
    support: '🎧',
    suggestion: '💡',
    up: '👍',
    down: '👎',
    pending: '🟡',
    approved: '🟢',
    rejected: '🔴',
    ticket: '🎫',
    lock: '🔒',
    claim: '🙋',
    welcome: '👋',
    leave: '🚪',
    announce: '📢',
    rules: '📜',
    verify: '✔️',
    car: '🚔',
    money: '💰',
    bug: '🐛',
    report: '🚨',
    trash: '🗑️',
    log: '📋',
    arrow: '➜',
    dot: '•',
    user: '👤',
    clock: '⏰',
    star: '⭐',
    whitelist: '📝',
    ban: '🔨',
    mute: '🔇',
    gift: '🎁',
    server: '🖥️',
    online: '🟢',
    offline: '🔴',
    trophy: '🏆',
    level: '📈',
    alert: '🛑'
  },

  /**
   * EMOJIS PRÓPRIOS DO ADVANCED (automático)
   * Todo .png/.gif da pasta assets/emojis é enviado como emoji do bot ao ligar
   * (Emojis do Aplicativo — não ocupa vaga de emoji do servidor).
   * O nome do arquivo é a chave acima. Ex: check.png substitui o emoji "check".
   * Para usar sua própria arte: troque o arquivo e rode /emojis sincronizar
   * ou use /emojis adicionar direto pelo Discord.
   */
  emojiSync: true,

  // Níveis de staff (maior número = mais poder). "owner" é fixo pelos IDs acima.
  levels: {
    suporte: { weight: 1, label: 'Suporte', emoji: 'support' },
    moderador: { weight: 2, label: 'Moderador', emoji: 'shield' },
    admin: { weight: 3, label: 'Administrador', emoji: 'staff' }
  },

  // Categorias das sugestões (aparecem no formulário)
  suggestionCategories: [
    { id: 'mapa', label: 'Mapa / Rotas de fuga', emoji: '🗺️' },
    { id: 'veiculos', label: 'Veículos', emoji: '🚗' },
    { id: 'policia', label: 'Polícia', emoji: '🚓' },
    { id: 'economia', label: 'Economia / Empregos', emoji: '💰' },
    { id: 'eventos', label: 'Eventos', emoji: '🎉' },
    { id: 'discord', label: 'Discord / Bot', emoji: '💬' },
    { id: 'outros', label: 'Outros', emoji: '📌' }
  ],

  // Categorias de ticket
  ticketTypes: [
    { id: 'suporte', label: 'Suporte Geral', description: 'Dúvidas e ajuda no servidor', emoji: 'support' },
    { id: 'denuncia', label: 'Denúncia', description: 'Denunciar jogador ou staff', emoji: 'report' },
    { id: 'doacao', label: 'Doações / VIP', description: 'Compras, VIPs e benefícios', emoji: 'money' },
    { id: 'bug', label: 'Reportar Bug', description: 'Encontrou um bug na cidade?', emoji: 'bug' }
  ],

  /**
   * PIX (usado no botão "Gerar PIX" dos tickets)
   * Coloque a chave PIX da F1 Loja (CPF, CNPJ, e-mail, telefone +55... ou chave aleatória).
   * O bot gera o QR Code e o "copia e cola" com o valor certo — o dinheiro cai direto na conta da chave.
   */
  pix: {
    key: '',                       // ex: 'pagamentos@f1loja.com' ou '12345678000199'
    receiverName: 'F1 LOJA',       // nome do recebedor (aparece no app do banco, máx 25)
    city: 'SAO PAULO',             // cidade do recebedor (máx 15)
    storeName: 'F1 Loja'           // nome exibido na embed
  },

  timezoneOffset: -3, // fuso usado nos agendamentos (Brasília = -3)

  // Modelos prontos do /anuncio
  announceTemplates: {
    livre: { label: 'Em branco', emoji: 'announce', color: 'laranja', title: '', text: '' },
    online: { label: 'Cidade online', emoji: 'online', color: 'verde', title: 'A CIDADE ESTÁ ONLINE!',
      text: 'Os portões estão abertos! Entre agora e comece sua fuga.\n\n**Conectar:** mtasa://191.96.78.19:22575' },
    reinicio: { label: 'Reinício', emoji: 'clock', color: 'amarelo', title: 'Reinício programado',
      text: 'A cidade vai reiniciar em **10 minutos**.\nGuarde seus veículos e finalize suas ações para não perder nada.' },
    manutencao: { label: 'Manutenção', emoji: 'staff', color: 'vermelho', title: 'Cidade em manutenção',
      text: 'Estamos realizando melhorias no servidor.\n\n**Previsão de retorno:** --:--\nAcompanhe as novidades por aqui!' },
    atualizacao: { label: 'Atualização', emoji: 'level', color: 'laranja', title: 'Nova atualização na cidade',
      text: '**Novidades:**\n• \n• \n\n**Correções:**\n• \n\nBom jogo a todos!' },
    evento: { label: 'Evento', emoji: 'gift', color: 'roxo', title: 'EVENTO NA CIDADE!',
      text: '**Quando:** --/-- às --:--\n**Onde:** \n**Prêmio:** \n\nNão fiquem de fora!' },
    whitelist: { label: 'Whitelist aberta', emoji: 'whitelist', color: 'verde', title: 'Whitelist aberta!',
      text: 'As vagas para novos cidadãos estão abertas.\nFaça sua whitelist no canal de whitelist e boa sorte!' }
  },

  // Status que o bot fica alternando
  presence: [
    'Advanced Fugas 🚔',
    '{members} fugitivos online',
    'Use /ajuda',
    '{players} jogadores na cidade',
    'Envie sua sugestão com /sugestao'
  ],

  // Perguntas da whitelist (máximo 5 — limite do formulário do Discord)
  whitelist: {
    cooldownHours: 2, // tempo para tentar de novo após reprovação
    nickname: '{nome} | {id}', // apelido aplicado ao aprovar (null = não muda)
    questions: [
      { id: 'nome', label: 'Nome e sobrenome do personagem', style: 'short', max: 40 },
      { id: 'id', label: 'Seu ID na cidade (passaporte)', style: 'short', max: 10 },
      { id: 'idade', label: 'Sua idade real', style: 'short', max: 3 },
      { id: 'historia', label: 'Conte a história do seu personagem', style: 'long', max: 1000 },
      { id: 'regras', label: 'O que é RDM, VDM e Metagaming?', style: 'long', max: 600 }
    ]
  },

  moderation: {
    warnLimit: 3,          // ao chegar nesse nº de avisos ativos o membro leva castigo automático
    warnPunishMinutes: 60,
    appeals: true          // banidos recebem botão "Recorrer" na DM
  },

  // Anti-raid: muitas entradas em pouco tempo = modo raid
  antiraid: {
    enabled: true,
    joins: 8,              // entradas...
    seconds: 10,           // ...em X segundos ativa o modo raid
    raidMinutes: 10,       // duração do modo raid
    minAccountDays: 3,     // contas mais novas que isso são marcadas como suspeitas
    kickNewDuringRaid: true // durante o raid expulsa contas novas automaticamente
  },

  // Status da cidade (atualiza sozinho no canal de status)
  fivem: {
    game: 'mta',                 // 'mta' (MTA:SA) ou 'fivem'
    ip: '191.96.78.19:22575',    // IP:porta do jogo
    joinUrl: 'https://contatoadvancedmta-dot.github.io/advanced-fugas-bot-/', // página que abre o MTA (GitHub Pages)
    updateSeconds: 60
  },

  // Sistema de níveis por mensagens
  xp: {
    enabled: true,
    min: 15,
    max: 25,
    cooldownSeconds: 60,
    roles: {
      // nível: 'ID do cargo'  ex: 10: '123456789012345678'
    }
  },

  automod: {
    antiInvite: true,      // apaga convites de outros servidores
    antiMassMention: 5,    // apaga mensagens com X+ menções (0 = desligado)
    antiSpam: { messages: 6, seconds: 5, timeoutMinutes: 5 }, // flood = castigo
    antiCaps: { percent: 70, minLength: 15 },                 // CAPS LOCK excessivo
    antiLink: {
      enabled: false,      // true = apaga links que não estejam na lista abaixo
      allowed: ['youtube.com', 'youtu.be', 'twitch.tv', 'tiktok.com', 'tenor.com', 'imgur.com', 'medal.tv', 'discord.com']
    },
    badWords: [],          // palavras proibidas, ex: ['palavra1', 'palavra2']
    strikes: { limit: 3, minutes: 10 } // 3 infrações em 10 min = aviso automático
  }
};
