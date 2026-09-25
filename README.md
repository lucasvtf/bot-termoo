# Termo Bot — bot de Discord

Bot pra jogar **Termo** (o Wordle em português) direto no Discord, com
**palavra do dia**, tentativas privadas e ranking automático.

---

## Como funciona

- Todo dia (00:00 no fuso do jogo — Lisboa por padrão) o bot sorteia uma **palavra do dia**, igual pra todo
  mundo no servidor.
- Cada jogador tem até **6 tentativas** por dia, como no Termo original.
  Palavra repetida não gasta tentativa.
- As tentativas são respondidas de forma **privada** (só quem jogou vê), pra
  não estragar o jogo pros outros. O resultado sai como **imagem**, com o
  grid de cores e o teclado mostrando o que já foi descoberto.
- Quando alguém **termina** (acerta ou esgota as tentativas), sai só uma linha
  no canal configurado (`✅ @Fulano acertou o Termo de hoje em 3/6`) — **sem
  grid**, porque as cores entregariam dicas pra quem ainda vai jogar.
- À **meia-noite** sai o anúncio do novo Termo com a palavra de ontem, quantos
  jogaram/acertaram, quem acertou mais rápido e a distribuição de tentativas.
  Na segunda-feira, inclui também o **campeão da semana**.

---

## Comandos

### Pra todos

| Comando                     | O que faz                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `/termo palavra:<5 letras>` | Registra uma tentativa da palavra do dia. Resposta privada com o grid + teclado em imagem.    |
| `/dueto palavra:<5 letras>` | Dueto: 2 palavras ao mesmo tempo, 7 tentativas. Cada chute vale pras duas; o grid de uma palavra congela quando ela é acertada. |
| `/quarteto palavra:<5 letras>` | Quarteto: 4 palavras ao mesmo tempo, 9 tentativas. Teclado dividido em quadrantes, um por palavra. |
| `/termo-ranking [periodo]`  | Ranking em imagem (vitórias e média). `periodo`: semana (seg–dom), mês ou geral (padrão). Streaks são sempre do histórico todo. |
| `/termo-stats [usuario]`    | Estatísticas pessoais (suas ou de outra pessoa): jogos, % vitórias, média, streak atual e máximo, distribuição de tentativas. |

### Admin (restrito por `ADMIN_USER_IDS` no `.env`)

| Comando                                           | O que faz                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin-termo rerolar [modo]`                     | Sorteia novas palavras do dia do modo (padrão Termo). Recusa se alguém já **começou** esse modo hoje.                                              |
| `/admin-termo definir-palavra palavra:<5 letras>` | Define manualmente a palavra do dia. Mesma trava do rerolar.                                                                                     |
| `/admin-termo banir-palavra palavra:<5 letras>`   | Bane uma palavra permanentemente do sorteio. Se for a palavra de hoje e ninguém tiver começado, já sorteia outra na hora.                         |

---

## Automação (cron)

| Cron             | Quando    | O que faz                                                                                                                                                |
| ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **palavraDoDia** | 00:00 (fuso do jogo) | Garante a palavra do dia e posta o anúncio do dia anterior (+ campeão da semana às segundas). Também roda no startup: se o bot estava fora do ar à meia-noite, o anúncio sai quando ele volta. Idempotente — a coluna `termo_dias.anunciado` garante que cada dia é anunciado uma vez só. |

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

Ao atualizar o bot: rode `npm run db:migrate` sempre que o `schema.sql` mudar
e `npm run deploy` sempre que um comando for criado ou tiver opções alteradas.

### Variáveis de ambiente

| Variável            | Pra quê                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `DISCORD_TOKEN`     | Token do bot.                                                      |
| `DISCORD_CLIENT_ID` | Application ID.                                                    |
| `DISCORD_GUILD_ID`  | ID do servidor onde os comandos são registrados.                   |
| `DATABASE_URL`      | Connection string do Postgres (Neon).                              |
| `ADMIN_USER_IDS`    | IDs Discord (separados por vírgula) que podem usar `/admin-termo`. |
| `CANAL_TERMO`       | Canal dos avisos de quem terminou e do anúncio da meia-noite.      |
| `FUSO_HORARIO`      | Opcional. Fuso do jogo (quando o dia vira). Padrão `Europe/Lisbon`. |

---

## Scripts npm

| Comando              | Pra quê                                                    |
| -------------------- | ---------------------------------------------------------- |
| `npm start`          | Sobe o bot.                                                |
| `npm run deploy`     | Registra os slash commands no `DISCORD_GUILD_ID`.          |
| `npm run db:migrate` | Aplica o schema (idempotente, pode rodar várias vezes).    |
| `npm run test:e2e`   | Testes de ponta a ponta dos comandos contra um Postgres de teste (`TEST_DATABASE_URL`, só aceita banco local — o banco é apagado). Rodam no CI. |
| `npm test`           | Roda os testes da lógica pura (feedback, streaks, resumo do dia, estatísticas, datas). |
| `npm run db:reset-ranking -- --confirmar` | Apaga o histórico de partidas (mantém usuários, banidas e palavra do dia). |
| `npm run db:reset -- --confirmar`         | Apaga tudo.                                                                |

---

## Estrutura do projeto

```
termo-bot/
├── package.json
└── src/
    ├── index.js                   inicialização do bot, carga dinâmica de comandos, cron
    ├── deploy-commands.js         registra slash commands na guild
    ├── commands/
    │   ├── termo.js               joga a tentativa do dia (incremento atômico no banco)
    │   ├── termo-ranking.js       ranking em imagem (semana / mês / geral)
    │   ├── termo-stats.js         estatísticas pessoais
    │   └── admin-termo.js         rerolar / definir-palavra / banir-palavra
    ├── services/
    │   ├── termoEngine.js         calcularFeedback (lógica pura, testada)
    │   ├── palavras.js            listas de palavras + validarFormato / validarPalavra
    │   ├── palavraDoDia.js        sorteio/persistência da palavra do dia + banimento
    │   ├── streaks.js             streak atual e maior streak (testado)
    │   ├── estatisticas.js        cálculo e texto do /termo-stats (testado)
    │   ├── resumoDia.js           resumo do dia, histograma e campeão da semana (testado)
    │   ├── anuncioDiario.js       posta o anúncio da meia-noite (idempotente)
    │   ├── renderTermo.js         desenha o grid + teclado em PNG (@napi-rs/canvas)
    │   ├── renderRanking.js       desenha o ranking em PNG
    │   └── *.test.js
    ├── cron/
    │   ├── index.js
    │   └── palavraDoDia.js        00:00 no fuso do jogo + execução no startup
    ├── db/
    │   ├── pool.js                pool pg + SSL automático + handler de erro de conexão
    │   ├── schema.sql             4 tabelas (idempotente)
    │   ├── migrate.js
    │   └── usuarios.js            upsert
    ├── data/
    │   ├── palavras-respostas.json   candidatas a palavra do dia (curadas)
    │   └── palavras-validas.json     palavras aceitas como tentativa (amplo)
    └── utils/
        ├── admin.js                requireAdmin
        ├── datas.js                hoje/ontem/início da semana e do mês (fuso do jogo)
        └── normalizar.js           uppercase + remove acento
```

---

## Modelo de dados

- **`usuarios`**: `id` (Discord), `username`, `nome_exibicao` (apelido no
  servidor, atualizado a cada `/termo`), `created_at`.
- **`termo_dias`**: `id`, `data` (única, no fuso do jogo), `palavra`,
  `anunciado` (se o anúncio da meia-noite desse dia já saiu).
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
