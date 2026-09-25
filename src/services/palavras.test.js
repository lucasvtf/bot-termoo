import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortearPalavras } from './palavras.js';

const LISTA = ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', 'EEEEE', 'FFFFF'];

test('sorteia a quantidade pedida, sem repetir', () => {
  for (let i = 0; i < 50; i++) {
    const r = sortearPalavras(4, { nuncaUsar: new Set(), evitar: new Set() }, LISTA);
    assert.equal(r.length, 4);
    assert.equal(new Set(r).size, 4);
  }
});

test('prefere inéditas e nunca usa banidas/do dia', () => {
  for (let i = 0; i < 50; i++) {
    const r = sortearPalavras(2, { nuncaUsar: new Set(['AAAAA']), evitar: new Set(['BBBBB', 'CCCCC', 'DDDDD']) }, LISTA);
    assert.deepEqual([...r].sort(), ['EEEEE', 'FFFFF']);
  }
});

test('se as inéditas não bastam, repete antigas mas nunca banidas/do dia', () => {
  for (let i = 0; i < 50; i++) {
    const r = sortearPalavras(4, { nuncaUsar: new Set(['AAAAA', 'BBBBB']), evitar: new Set(['CCCCC', 'DDDDD', 'EEEEE']) }, LISTA);
    assert.deepEqual([...r].sort(), ['CCCCC', 'DDDDD', 'EEEEE', 'FFFFF']);
  }
});
