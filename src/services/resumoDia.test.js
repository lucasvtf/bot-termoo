import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumirPartidas, montarAnuncio, calcularCampeoes } from './resumoDia.js';

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

test('anúncio sem jogadores', () => {
  const txt = montarAnuncio('PRATO', resumirPartidas([]));
  assert.match(txt, /A palavra de ontem era `PRATO`/);
  assert.match(txt, /Ninguém jogou ontem/);
});

test('anúncio com jogadores tem porcentagem, menções e histograma com X por último', () => {
  const txt = montarAnuncio('PRATO', resumirPartidas([p('1', true, 2), p('2', false, 6)]));
  assert.match(txt, /2 pessoas jogaram · 1 acertou \(50%\)/);
  assert.match(txt, /Mais rápido: <@1> em \*\*2\*\* tentativas/);
  const linhasHist = txt.split('```')[1].trim().split('\n');
  assert.equal(linhasHist.length, 7);
  assert.equal(linhasHist.at(-1), 'X │ ██████████ 1');
});

test('muitos empatados → corta a lista', () => {
  const partidas = ['1', '2', '3', '4', '5', '6', '7'].map((id) => p(id, true, 3));
  const txt = montarAnuncio('PRATO', resumirPartidas(partidas));
  assert.match(txt, /<@4> e mais 3 em/);
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

test('anúncio de segunda inclui o campeão, mesmo sem ninguém ter jogado ontem', () => {
  const txt = montarAnuncio('PRATO', resumirPartidas([]), { ids: ['9'], vitorias: 6, media: 3.5 });
  assert.match(txt, /Ninguém jogou ontem/);
  assert.match(txt, /👑 \*\*Campeão da semana:\*\* <@9> — 6 vitórias, média 3\.50/);
});
