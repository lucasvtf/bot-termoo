// Testes de ponta a ponta: executam os comandos de verdade (com uma interação do Discord simulada)
// contra um Postgres de TESTE. Rodam no CI com um Postgres temporário.
// Localmente: TEST_DATABASE_URL=postgresql://... npm run test:e2e  (o banco é APAGADO a cada execução)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const URL_TESTE = process.env.TEST_DATABASE_URL;
const ehLocal = URL_TESTE && /@(localhost|127\.0\.0\.1)[:/]|host=\//.test(URL_TESTE);
const pular = !ehLocal && 'defina TEST_DATABASE_URL apontando pra um Postgres LOCAL (nunca o de produção)';

let pool; let cmd; let pd; let anunciarDiaAnterior; let datas;
const canal = [];

function interacao({ strings = {}, sub = null, userId = '100', nome = 'Jogador' } = {}) {
  const res = {};
  const registrar = (m) => {
    res.content = typeof m === 'string' ? m : m.content;
    res.arquivos = m.files?.length ?? 0;
    res.embeds = m.embeds ?? [];
  };
  return {
    res,
    user: { id: userId, username: nome.toLowerCase(), displayName: nome },
    member: { displayName: nome },
    options: {
      getString: (k) => strings[k] ?? null,
      getSubcommand: () => sub,
      getUser: () => null,
      getMember: () => null,
    },
    client: { channels: { fetch: async () => ({ send: async (m) => canal.push(m.content) }) } },
    deferReply: async () => {},
    editReply: async (m) => registrar(m),
    reply: async (m) => registrar(m),
    followUp: async (m) => registrar(m),
  };
}

async function rodar(nomeCmd, opts) {
  const i = interacao(opts);
  await cmd[nomeCmd].execute(i);
  return i.res;
}

before(async () => {
  if (pular) return;
  process.env.DATABASE_URL = URL_TESTE;
  process.env.CANAL_TERMO = 'canal-teste';
  process.env.ADMIN_USER_IDS = '999';
  ({ pool } = await import('../../src/db/pool.js'));
  await pool.query('DROP TABLE IF EXISTS termo_partidas, termo_dias, termo_banidas, usuarios CASCADE');
  await pool.query(readFileSync(new URL('../../src/db/schema.sql', import.meta.url), 'utf8'));
  cmd = {};
  for (const n of ['termo', 'dueto', 'quarteto', 'termo-ranking', 'termo-stats', 'admin-termo']) {
    cmd[n] = await import(`../../src/commands/${n}.js`);
  }
  pd = await import('../../src/services/palavraDoDia.js');
  ({ anunciarDiaAnterior } = await import('../../src/services/anuncioDiario.js'));
  datas = await import('../../src/utils/datas.js');
});

after(async () => { await pool?.end(); });

const hoje = () => datas.dataDeHoje();
const palavrasDe = async (modo) => (await pd.garantirPalavraDoDia(hoje(), modo)).palavras;

test('palavras do dia dos 3 modos: quantidades certas e nenhuma repetida', { skip: pular }, async () => {
  const todas = [...await palavrasDe('termo'), ...await palavrasDe('dueto'), ...await palavrasDe('quarteto')];
  assert.equal(todas.length, 7);
  assert.equal(new Set(todas).size, 7);
});

test('admin: rerolar quarteto antes de alguém jogar funciona; não-admin é barrado', { skip: pular }, async () => {
  const antes = await palavrasDe('quarteto');
  const r = await rodar('admin-termo', { sub: 'rerolar', strings: { modo: 'quarteto' }, userId: '999' });
  assert.match(r.content, /Novas palavras do Quarteto sorteadas/);
  assert.notDeepEqual(await palavrasDe('quarteto'), antes);
  const barrado = await rodar('admin-termo', { sub: 'rerolar', userId: '100' });
  assert.match(barrado.content, /só pra admin/);
});

test('/termo: inválida, erro, repetida, acerto, depois de vencer', { skip: pular }, async () => {
  const [certa] = await palavrasDe('termo');
  const chute = certa === 'CASAS' ? 'BOLAS' : 'CASAS';
  assert.match((await rodar('termo', { strings: { palavra: 'XYZWQ' } })).content, /não é uma palavra reconhecida/);
  let r = await rodar('termo', { strings: { palavra: chute } });
  assert.equal(r.content, 'Tentativa 1 de 6.');
  assert.equal(r.arquivos, 1);
  r = await rodar('termo', { strings: { palavra: chute } });
  assert.match(r.content, /já tentou/);
  r = await rodar('termo', { strings: { palavra: certa } });
  assert.equal(r.content, 'Você acertou em 2/6!');
  r = await rodar('termo', { strings: { palavra: chute } });
  assert.equal(r.content, 'Você já venceu hoje!');
  assert.deepEqual(canal.splice(0), ['✅ <@100> acertou o Termo de hoje em 2/6']);
});

test('/dueto: uma palavra não vence; as duas vencem', { skip: pular }, async () => {
  const [a, b] = await palavrasDe('dueto');
  let r = await rodar('dueto', { strings: { palavra: a } });
  assert.equal(r.content, 'Tentativa 1 de 7. 1/2 palavras acertadas.');
  assert.equal(r.arquivos, 1);
  r = await rodar('dueto', { strings: { palavra: b } });
  assert.equal(r.content, 'Você acertou o Dueto em 2/7!');
  assert.deepEqual(canal.splice(0), ['✅ <@100> acertou o Dueto de hoje em 2/7']);
});

test('/quarteto: 9 erros encerram e revelam as 4 palavras', { skip: pular }, async () => {
  const certas = await palavrasDe('quarteto');
  const erradas = ['CASAS', 'BOLAS', 'MESAS', 'GATOS', 'LIVRO', 'CARRO', 'FESTA', 'PORTA', 'NOITE', 'TERRA', 'PRAIA']
    .filter((p) => !certas.includes(p)).slice(0, 9);
  let r;
  for (const p of erradas) r = await rodar('quarteto', { strings: { palavra: p }, userId: '200', nome: 'Outro' });
  assert.match(r.content, /^Suas tentativas acabaram\. As palavras eram /);
  for (const p of certas) assert.ok(r.content.includes(p));
  assert.deepEqual(canal.splice(0), ['❌ <@200> não acertou o Quarteto de hoje']);
});

test('admin: rerolar dueto é recusado depois que alguém começou', { skip: pular }, async () => {
  const r = await rodar('admin-termo', { sub: 'rerolar', strings: { modo: 'dueto' }, userId: '999' });
  assert.match(r.content, /já começaram o Dueto/);
});

test('/termo-ranking e /termo-stats respondem', { skip: pular }, async () => {
  const rk = await rodar('termo-ranking', { strings: {} });
  assert.equal(rk.arquivos, 1);
  const st = await rodar('termo-stats', {});
  assert.equal(st.embeds.length, 1);
});

test('anúncio da meia-noite sai uma vez só', { skip: pular }, async () => {
  const ontem = datas.diaAnterior(hoje());
  const { palavras: [palavraOntem] } = await pd.garantirPalavraDoDia(ontem, 'termo');
  const cliente = { channels: { fetch: async () => ({ send: async (m) => canal.push(m.content) }) } };
  await anunciarDiaAnterior(cliente);
  await anunciarDiaAnterior(cliente);
  assert.equal(canal.length, 1);
  assert.match(canal.splice(0)[0], new RegExp(`A palavra de ontem era \`${palavraOntem}\``));
});
