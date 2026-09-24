import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularStreaks, calcularMaiorStreak } from './streaks.js';
import { diaAnterior } from '../utils/datas.js';

const HOJE = '2026-09-24';

test('diaAnterior atravessa virada de mês', () => {
  assert.equal(diaAnterior('2026-10-01'), '2026-09-30');
});

test('sem partidas → streaks zerados', () => {
  assert.deepEqual(calcularStreaks([], HOJE), { streakAcertos: 0, streakJogos: 0 });
});

test('última partida há 5 dias → streaks zerados', () => {
  const partidas = [
    { data: '2026-09-19', venceu: true },
    { data: '2026-09-18', venceu: true },
    { data: '2026-09-17', venceu: true },
  ];
  assert.deepEqual(calcularStreaks(partidas, HOJE), { streakAcertos: 0, streakJogos: 0 });
});

test('jogou até ontem e ainda não jogou hoje → streak continua', () => {
  const partidas = [
    { data: '2026-09-23', venceu: true },
    { data: '2026-09-22', venceu: true },
  ];
  assert.deepEqual(calcularStreaks(partidas, HOJE), { streakAcertos: 2, streakJogos: 2 });
});

test('buraco no meio → para de contar no buraco', () => {
  const partidas = [
    { data: '2026-09-24', venceu: true },
    { data: '2026-09-23', venceu: true },
    { data: '2026-09-21', venceu: true },
  ];
  assert.deepEqual(calcularStreaks(partidas, HOJE), { streakAcertos: 2, streakJogos: 2 });
});

test('derrota zera acertos mas mantém dias jogando', () => {
  const partidas = [
    { data: '2026-09-24', venceu: true },
    { data: '2026-09-23', venceu: true },
    { data: '2026-09-22', venceu: false },
  ];
  assert.deepEqual(calcularStreaks(partidas, HOJE), { streakAcertos: 2, streakJogos: 3 });
});

test('maior streak: pega a maior sequência, quebrando em derrota e em buraco', () => {
  const partidas = [
    { data: '2026-09-24', venceu: true },
    { data: '2026-09-23', venceu: true },
    { data: '2026-09-22', venceu: false },
    { data: '2026-09-21', venceu: true },
    { data: '2026-09-20', venceu: true },
    { data: '2026-09-19', venceu: true },
    { data: '2026-09-17', venceu: true },
  ];
  assert.equal(calcularMaiorStreak(partidas), 3);
});

test('maior streak sem vitórias → 0', () => {
  assert.equal(calcularMaiorStreak([{ data: '2026-09-24', venceu: false }]), 0);
});
