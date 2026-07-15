# Termo Bot — bot de Discord

Bot pra jogar **Termo** (o Wordle em português) direto no Discord, com
**palavra do dia**, tentativas privadas e ranking automático.

---

## Como funciona

- Todo dia (00:00 BRT) o bot sorteia uma **palavra do dia**, igual pra todo
  mundo no servidor.
- Cada jogador tem até **6 tentativas** por dia, uma por dia — como o Termo
  original.
- As tentativas são respondidas de forma **privada** (só quem jogou vê), pra
  não estragar o jogo pros outros. O resultado sai como **imagem**, com o
  grid de cores e o teclado mostrando o que já foi descoberto.
- Quando alguém **termina** (acerta ou esgota as tentativas), sai um resumo
  público no canal configurado — só com o grid de cores, sem revelar as
  letras, igual ao compartilhamento do Wordle/Termo real.

---

## Comandos

### Pra todos

| Comando                     | O que faz                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `/termo palavra:<5 letras>` | Registra uma tentativa da palavra do dia. Resposta privada com o grid + teclado em imagem.    |
| `/termo-ranking`            | Ranking em imagem: streak de acertos, streak de dias jogando, vitórias e média de tentativas. |

### Admin (restrito por `ADMIN_USER_IDS` no `.env`)

| Comando                                           | O que faz                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin-termo rerolar`                            | Sorteia uma nova palavra do dia, descartando a atual. Recusa se alguém já finalizou a de hoje.                                                   |
| `/admin-termo definir-palavra palavra:<5 letras>` | Define manualmente a palavra do dia.                                                                                                             |
| `/admin-termo banir-palavra palavra:<5 letras>`   | Bane uma palavra permanentemente do sorteio (persistido no banco). Se for a palavra de hoje e ninguém tiver terminado, já sorteia outra na hora. |

---

## Automação (cron)

| Cron             | Quando    | O que faz                                                                                                                                                |
| ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **palavraDoDia** | 00:00 BRT | Garante que existe uma palavra sorteada pro dia. Idempotente — se o bot reiniciar ou o cron atrasar, o `/termo` também garante a palavra na hora (lazy). |

---

## Setup local

### Pré-requisitos

- Node.js 18+
- Conta no [Neon](https://neon.tech) (PostgreSQL gratuito)
- App criado no [Discord Developer Portal](https://discord.com/developers/applications) (bot + escopos `bot` e `applications.commands`)

### Instalação

```bash
npm install
cp .env.example .env
# preenche o .env com seus tokens e IDs
npm run db:migrate
npm run deploy
npm start
```

### Variáveis de ambiente

| Variável            | Pra quê                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `DISCORD_TOKEN`     | Token do bot.                                                      |
| `DISCORD_CLIENT_ID` | Application ID.                                                    |
| `DISCORD_GUILD_ID`  | ID do servidor onde os comandos são registrados.                   |
| `DATABASE_URL`      | Connection string do Postgres (Neon).                              |
| `ADMIN_USER_IDS`    | IDs Discord (separados por vírgula) que podem usar `/admin-termo`. |
| `CANAL_TERMO`       | Canal onde sai o resumo público de quem terminou o dia.            |

---

## Scripts npm

| Comando              | Pra quê                                                    |
| -------------------- | ---------------------------------------------------------- |
| `npm start`          | Sobe o bot.                                                |
| `npm run deploy`     | Registra os slash commands no `DISCORD_GUILD_ID`.          |
| `npm run db:migrate` | Aplica o schema (idempotente, pode rodar várias vezes).    |
| `npm test`           | Roda os testes da lógica de feedback (`calcularFeedback`). |

---

## Estrutura do projeto

```
termo-bot/
├── package.json
└── src/
    ├── index.js                   inicialização do bot, carga dinâmica de comandos, cron
    ├── deploy-commands.js         registra slash commands na guild
    ├── commands/
    │   ├── termo.js               joga a tentativa do dia
    │   ├── termo-ranking.js       ranking em imagem
    │   └── admin-termo.js         rerolar / definir-palavra / banir-palavra
    ├── services/
    │   ├── termoEngine.js         calcularFeedback (lógica pura, testada)
    │   ├── termoEngine.test.js
    │   ├── palavraDoDia.js        sorteio/persistência da palavra do dia + banimento
    │   ├── renderTermo.js         desenha o grid + teclado em PNG (@napi-rs/canvas)
    │   └── renderRanking.js       desenha o ranking em PNG
    ├── cron/
    │   ├── index.js
    │   └── palavraDoDia.js        00:00 BRT
    ├── db/
    │   ├── pool.js                pool pg + SSL automático
    │   ├── schema.sql             4 tabelas
    │   ├── migrate.js
    │   └── usuarios.js            upsert
    ├── data/
    │   ├── palavras-respostas.json   candidatas a palavra do dia (curadas)
    │   └── palavras-validas.json     palavras aceitas como tentativa (amplo)
    └── utils/
        ├── admin.js                requireAdmin
        └── normalizar.js           uppercase + remove acento
```

---

## Modelo de dados

- **`usuarios`**: `id` (Discord), `username`, `created_at`.
- **`termo_dias`**: `id`, `data` (única, fuso America/Sao_Paulo), `palavra`.
- **`termo_partidas`**: `id`, `usuario_id`, `dia_id`, `tentativas` (JSONB),
  `num_tentativas`, `venceu`, `finalizado`. Única por `(usuario_id, dia_id)`.
- **`termo_banidas`**: `palavra` (PK), `banida_por`, `created_at` — palavras
  banidas do sorteio via `/admin-termo banir-palavra`.

Estatísticas de ranking (vitórias, streaks, média) são calculadas por query
em cima de `termo_partidas`, sem coluna denormalizada.

---

## Sobre as listas de palavras

- **`palavras-respostas.json`** (1364 palavras): candidatas a palavra do dia.
  Curada a partir de uma lista de frequência real de uso em português
  ([hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords))
  cruzada com um dicionário aberto, com uma limpeza manual removendo nomes
  próprios, estrangeirismos e termos sensíveis/ofensivos.
- **`palavras-validas.json`** (17411 palavras): o que é aceito como
  tentativa. Vem de [AlfredoFilho/Palavras_PT-BR](https://github.com/AlfredoFilho/Palavras_PT-BR)
  (1,9M palavras incluindo conjugações), filtrado pra 5 letras. É
  intencionalmente mais permissivo que a lista de respostas — não precisa
  ser "bonita", só precisa reconhecer palavras reais.
- Todo o texto é normalizado sem acento (`AVIAO`, não `AVIÃO`) pra evitar
  ambiguidade de digitação.
- Se uma palavra do dia sair ruim, use `/admin-termo banir-palavra` — ela
  nunca mais é sorteada, e se for a palavra de hoje e ninguém tiver
  terminado, o bot já sorteia outra na hora.

---
