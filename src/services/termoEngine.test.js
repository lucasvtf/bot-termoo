import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFeedback, estadoDaPartida, tentativasPorPalavra } from './termoEngine.js';

test('tentativa igual à palavra → tudo verde', () => {
  assert.deepEqual(calcularFeedback('PRATO', 'PRATO'), [
    'verde', 'verde', 'verde', 'verde', 'verde',
  ]);
});

test('nenhuma letra em comum → tudo cinza', () => {
  assert.deepEqual(calcularFeedback('BOLSA', 'FICHE'), [
    'cinza', 'cinza', 'cinza', 'cinza', 'cinza',
  ]);
});

test('letra certa em posição errada → amarelo', () => {
  assert.deepEqual(calcularFeedback('TOPAR', 'PRATO'), [
    'amarelo', 'amarelo', 'amarelo', 'amarelo', 'amarelo',
  ]);
});

test('letra repetida na tentativa, uma só ocorrência na palavra → só uma marcação, resto cinza', () => {
  assert.deepEqual(calcularFeedback('ARARA', 'RATOS'), [
    'amarelo', 'amarelo', 'cinza', 'cinza', 'cinza',
  ]);
});

test('letra repetida onde a palavra já teve as duas ocorrências consumidas por verdes → resto cinza, não amarelo', () => {
  assert.deepEqual(calcularFeedback('EEEEE', 'LEVES'), [
    'cinza', 'verde', 'cinza', 'verde', 'cinza',
  ]);
});

test('estado: termo clássico — acerto encerra, 6 erros encerram', () => {
  assert.deepEqual(estadoDaPartida(['CASAS', 'PRATO'], ['PRATO']), { resolvidaEm: [2], venceu: true, finalizado: true });
  const seis = ['CASAS', 'BOLAS', 'MESAS', 'GATOS', 'LIVRO', 'CARRO'];
  assert.deepEqual(estadoDaPartida(seis, ['PRATO']), { resolvidaEm: [null], venceu: false, finalizado: true });
  assert.deepEqual(estadoDaPartida(seis.slice(0, 5), ['PRATO']), { resolvidaEm: [null], venceu: false, finalizado: false });
});

test('estado: dueto só vence com as duas, limite de 7', () => {
  assert.deepEqual(estadoDaPartida(['PRATO', 'CASAS'], ['CASAS', 'PRATO']), { resolvidaEm: [2, 1], venceu: true, finalizado: true });
  const uma = ['PRATO', 'BOLAS', 'MESAS', 'GATOS', 'LIVRO', 'CARRO'];
  assert.deepEqual(estadoDaPartida(uma, ['PRATO', 'CASAS']), { resolvidaEm: [1, null], venceu: false, finalizado: false });
  assert.equal(estadoDaPartida([...uma, 'FESTA'], ['PRATO', 'CASAS']).finalizado, true);
});

test('estado: quarteto tem limite de 9', () => {
  const oito = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'];
  assert.equal(estadoDaPartida(oito, ['W', 'X', 'Y', 'Z']).finalizado, false);
  assert.equal(estadoDaPartida([...oito, 'A9'], ['W', 'X', 'Y', 'Z']).finalizado, true);
});

test('grid de cada palavra congela depois de acertada', () => {
  const t = ['BOLAS', 'PRATO', 'MESAS', 'CASAS'];
  assert.deepEqual(tentativasPorPalavra(t, ['PRATO', 'CASAS']), [
    ['BOLAS', 'PRATO'],
    ['BOLAS', 'PRATO', 'MESAS', 'CASAS'],
  ]);
  assert.deepEqual(tentativasPorPalavra(['BOLAS'], ['PRATO']), [['BOLAS']]);
});
