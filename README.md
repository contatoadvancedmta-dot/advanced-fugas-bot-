# 🔥 Bot Advanced Fugas

Bot oficial do servidor **Advanced Fugas** — embeds estilizadas, emojis personalizados e tudo por **botões**.

## ✨ Funcionalidades

| Sistema | Como funciona |
|---|---|
| 👑 **Gerenciador de staff** | `/admin painel` → botões Adicionar / Remover / Lista. Escolhe o membro e o nível (Suporte, Moderador, Admin) por menu. Dá/remove os cargos sozinho e avisa na DM. Só **donos** usam. |
| 💡 **Sugestões** | Botão "Enviar sugestão" ou `/sugestao` → formulário. Vai para o canal com votos 👍/👎, barra de aprovação e tópico de debate. Staff clica em Aprovar/Recusar, escreve o motivo e o autor recebe na DM. |
| 🎫 **Tickets** | Menu de categorias → canal privado com painel: **Assumir**, **Notificar membro** (DM), **Gerar PIX** (QR Code + copia e cola + confirmar pagamento), menu para **adicionar/remover membros**, **Fechar** com motivo. Transcript em **HTML**, resumo na DM e **avaliação ⭐ do atendimento**. |
| 💸 **PIX** | Gera cobrança no padrão do Banco Central com a chave configurada (F1 Loja), valor e produto. O dinheiro cai direto na conta da chave; a staff confirma o pagamento por botão. |
| ✔️ **Verificação** | Botão que dá o cargo de verificado. |
| 👋 **Boas-vindas / saída** | Embed automática + cargo automático (autorole). |
| 📋 **Logs** | Mensagens apagadas/editadas, entradas, saídas, staff, tickets, sugestões. |
| 🛡️ **Moderação** | `/mod` ou **clique direito → Apps → Ficha de moderação**: ficha completa com botões (Avisar, Castigar, Expulsar, Banir, Anotação, Histórico, Tirar castigo, Limpar avisos). **Casos numerados**, `/caso`, **ban temporário** com desban automático, `/desbanir`, `/modstats`, `/trancar`, `/modolento`. |
| 🚨 **Denúncias** | **Clique direito numa mensagem → Apps → Denunciar mensagem** → vai para a staff com botões Abrir ficha / Apagar / Resolvido. |
| 📨 **Recurso de ban** | O banido recebe na DM o botão **Recorrer banimento** → a staff aceita (desbane + envia convite) ou nega. |
| 🤖 **AutoMod** | Convites, menções em massa, **flood** (castigo automático), CAPS, links fora da lista, palavras proibidas. 3 infrações = aviso automático. |
| 🛑 **Anti-raid** | Muitas entradas em segundos ativa o modo raid: alerta a staff e expulsa contas novas. Contas novas são sinalizadas nos logs. |
| 📢 **Anúncios** | `/anuncio criar` abre um **construtor com prévia**: modelos prontos (manutenção, evento, atualização...), cor, menção, canal, imagem, botão de link, **publicar ou agendar** (`30m`, `21:30`, `25/12 20:00`). Publica automaticamente para seguidores em canais de anúncio. |
| 📖 **Ajuda** | `/ajuda` com botões por categoria. |
| 😎 **Emojis próprios** | 43 emojis laranja do Advanced em `assets/emojis`. O bot envia sozinho ao ligar (Emojis do Aplicativo — não gasta vaga do servidor) e já usa em tudo. `/emojis adicionar` troca qualquer um por uma arte sua. |
| 📝 **Whitelist** | Botão → formulário com 5 perguntas → staff aprova/reprova por botão. Aprovado ganha cargo e apelido `Nome \| ID`; resultado vai na DM. Tempo de espera para tentar de novo. |
| 🔨 **Moderação** | `/banir`, `/expulsar`, `/castigo`, `/aviso dar/ver/limpar`. Com 3 avisos leva castigo automático. DM + logs. |
| 🎁 **Sorteios** | `/sorteio criar` com botão Participar, cargo requisito e encerramento automático. `/sorteio resortear`. |
| 🖥️ **Status da cidade** | Mensagem que se atualiza sozinha com jogadores online do FiveM e botão "Entrar na cidade". `/status`. |
| 📈 **Níveis** | XP por mensagem, aviso de subir de nível, cargos por nível, `/rank` e `/top`. |

## 🚀 Instalação

1. Crie o bot em https://discord.com/developers/applications
   - Aba **Bot** → ative **Server Members Intent** e **Message Content Intent**.
2. Convide com permissão de **Administrador** (escopos `bot` + `applications.commands`).
3. No terminal:

```bash
npm install
```

```bash
cp .env.example .env
```

Preencha o `.env` com `DISCORD_TOKEN`, `CLIENT_ID` e `GUILD_ID`.

```bash
npm run deploy
```

```bash
npm start
```

## ⚙️ Configuração no Discord

```
/setup canal tipo:Canal de sugestões    canal:#sugestões
/setup canal tipo:Canal de logs         canal:#logs
/setup canal tipo:Canal de boas-vindas  canal:#bem-vindo
/setup canal tipo:Categoria dos tickets canal:TICKETS
/setup cargo tipo:Cargo de Moderador    cargo:@Moderador
/setup cargo tipo:Cargo de verificado   cargo:@Cidadão
/setup canal tipo:Canal de análise da whitelist (staff) canal:#analise-wl
/setup canal tipo:Canal de resultados da whitelist      canal:#resultado-wl
/setup cargo tipo:Cargo de whitelist aprovada           cargo:@Whitelist
/setup canal tipo:Canal de status da cidade             canal:#status
/setup canal tipo:Canal de logs/transcripts dos tickets canal:#logs-tickets
/setup canal tipo:Canal de denúncias (staff)            canal:#denuncias
/setup canal tipo:Canal de recursos de banimento (staff) canal:#recursos
/setup canal tipo:Canal público de punições             canal:#punicoes
/setup ver
```

Depois envie os painéis:

```
/painel tipo:Sugestões    canal:#sugestões
/painel tipo:Tickets      canal:#abrir-ticket
/painel tipo:Verificação  canal:#verificação
/painel tipo:Regras       canal:#regras
/painel tipo:Whitelist    canal:#whitelist
/painel tipo:Gerenciador de staff canal:#painel-donos
```

> O cargo do bot precisa ficar **acima** dos cargos de staff na lista de cargos.

## 🎨 Personalizar

Tudo fica em **`config.js`**:
- `invisibleEmbeds: true` → embeds **sem barra colorida** (ficam da cor do fundo do Discord). `false` volta as cores.
- **Banners**: ficam em `assets/banners/` (tickets, whitelist, regras, verificacao, sugestoes, staff, status, anuncio, sorteio, ranking, boasvindas). Para usar sua arte, substitua o PNG com o mesmo nome (tamanho ideal 1800×600). `banners: false` desliga.
- **Perfil do bot**: `assets/banners/avatar-bot.png` (foto) e `perfil-bot.png` (banner do perfil) — envie no Developer Portal → Bot.
- `owners` → IDs dos donos.
- **Emojis**: troque as imagens em `assets/emojis/` (o nome do arquivo é a chave, ex: `ticket.png`) e rode `/emojis sincronizar reenviar:true` — ou use `/emojis adicionar` pelo Discord. Também pode colar `<:nome:id>` direto em `emojis` no config.
- `pix.key` → **chave PIX da F1 Loja** (obrigatório para o botão Gerar PIX). `pix.receiverName` / `pix.city`.
- `announceTemplates` → modelos de anúncio. `automod` / `antiraid` → regras automáticas.
- `fivem.ip` / `fivem.joinUrl` → status da cidade. `whitelist.questions` → perguntas. `xp.roles` → cargos por nível.
- `colors`, `brand.logo`, `brand.banner`, `brand.connect`, `ticketTypes`, `presence`, `automod`.

Os dados ficam salvos em `data/db.json`.
