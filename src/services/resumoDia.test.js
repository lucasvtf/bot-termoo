import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resumirPartidas, montarAnuncio, calcularCampeoes, faixaDeTentativas,
} from './resumoDia.js';

const p = (id, venceu, n) => ({ usuario_id: id, venceu, num_tentativas: n });

test('resumo conta jogadores, acertos, mais rápidos e distribuição', () => {
  const r = resumirPartidas([p('1', true, 3), p('2', true, 2), p('3', false, 6), p('4', true, 2)]);
  assert.equal(r.jogaram, 4);
  assert.equal(r.acertaram, 3);
  assert.equal(r.melhor, 2);
  assert.deepEqual(r.maisRapidos, ['2', '4']);
  assert.deepEqual(r.distribuicao, { 1: 0, 2: 2, 3: 1, 4: 0, 5: 0, 6: 0, X: 1 });
});

test('ninguém acertou → sem mais rápido', () => {
  const r = resumirPartidas([p('1', false, 6)]);
  assert.equal(r.melhor, null);
  assert.deepEqual(r.maisRapidos, []);
});

const secao = (nome, palavras, partidas) => ({
  nome, palavras, resumo: resumirPartidas(partidas, faixaDeTentativas(palavras.length)),
});

test('anúncio: uma seção por modo, modo sem jogadores vira uma linha', () => {
  const txt = montarAnuncio([
    secao('Termo', ['PRATO'], [p('1', true, 2), p('2', false, 6)]),
    secao('Dueto', ['CASAS', 'BOLAS'], []),
  ]);
  assert.match(txt, /\*\*Termo\*\* · palavra de ontem: `PRATO`/);
  assert.match(txt, /2 pessoas jogaram · 1 acertou \(50%\)/);
  assert.match(txt, /Mais rápido: <@1> em \*\*2\*\* tentativas/);
  assert.match(txt, /\*\*Dueto\*\* · palavras de ontem: `CASAS`, `BOLAS`\nNinguém jogou\./);
  const linhasHist = txt.split('```')[1].trim().split('\n');
  assert.equal(linhasHist.length, 7);
  assert.equal(linhasHist.at(-1), 'X │ ██████████ 1');
});

test('histograma do quarteto vai de 4 a 9', () => {
  const r = resumirPartidas([p('1', true, 4), p('2', true, 9)], faixaDeTentativas(4));
  assert.deepEqual(Object.keys(r.distribuicao), ['4', '5', '6', '7', '8', '9', 'X']);
});

test('muitos empatados → corta a lista', () => {
  const partidas = ['1', '2', '3', '4', '5', '6', '7'].map((id) => p(id, true, 3));
  const txt = montarAnuncio([secao('Termo', ['PRATO'], partidas)]);
  assert.match(txt, /<@4> e mais 3 em/);
});

test('pior caso (3 modos cheios + campeões) cabe no limite de 2000 caracteres do Discord', () => {
  const muitos = [...Array(40)].map((_, i) => p(String(1e17 + i), true, (i % 6) + 1));
  const secoes = ['Termo', 'Dueto', 'Quarteto'].map((n) => secao(n, ['PRATO'], muitos));
  const campeoes = ['Termo', 'Dueto', 'Quarteto'].map((nome) => ({
    nome, campeoes: { ids: muitos.slice(0, 5).map((x) => x.usuario_id), vitorias: 7, media: 2 },
  }));
  const txt = montarAnuncio(secoes, campeoes);
  assert.ok(txt.length <= 2000, `${txt.length} caracteres`);
});

test('campeão: mais vitórias, desempate pela menor média (média vem como string do pg)', () => {
  const c = calcularCampeoes([
    { usuario_id: '1', vitorias: 5, media: '3.4000' },
    { usuario_id: '2', vitorias: 5, media: '3.2000' },
    { usuario_id: '3', vitorias: 4, media: '2.0000' },
  ]);
  assert.deepEqual(c, { ids: ['2'], vitorias: 5, media: 3.2 });
});

test('campeões empatados e ninguém venceu', () => {
  const c = calcularCampeoes([
    { usuario_id: '1', vitorias: 3, media: '3.0000' },
    { usuario_id: '2', vitorias: 3, media: '3.0000' },
  ]);
  assert.deepEqual(c.ids, ['1', '2']);
  assert.equal(calcularCampeoes([{ usuario_id: '1', vitorias: 0, media: null }]), null);
});

test('anúncio de segunda inclui os campeões de cada modo que teve vencedor', () => {
  const txt = montarAnuncio([secao('Termo', ['PRATO'], [])], [
    { nome: 'Termo', campeoes: { ids: ['9'], vitorias: 6, media: 3.5 } },
    { nome: 'Dueto', campeoes: null },
  ]);
  assert.match(txt, /👑 \*\*Campeões da semana\*\*\nTermo: <@9> — 6 vitórias, média 3\.50/);
  assert.ok(!txt.includes('Dueto:'));
});
