import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFeedback } from './termoEngine.js';

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
