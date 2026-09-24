import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularEstatisticas, montarEstatisticas } from './estatisticas.js';

const HOJE = '2026-09-24';

test('estatísticas combinam totais, média, streaks e distribuição', () => {
  const partidas = [
    { data: '2026-09-24', venceu: true, num_tentativas: 3 },
    { data: '2026-09-23', venceu: true, num_tentativas: 4 },
    { data: '2026-09-22', venceu: false, num_tentativas: 6 },
    { data: '2026-09-21', venceu: true, num_tentativas: 2 },
  ];
  const s = calcularEstatisticas(partidas, HOJE);
  assert.equal(s.jogos, 4);
  assert.equal(s.pctVitorias, 75);
  assert.equal(s.media, 3);
  assert.equal(s.streakAtual, 2);
  assert.equal(s.maiorStreak, 2);
  assert.deepEqual(s.distribuicao, { 1: 0, 2: 1, 3: 1, 4: 1, 5: 0, 6: 0, X: 1 });
});

test('texto sem vitórias mostra média como —', () => {
  const s = calcularEstatisticas([{ data: '2026-09-24', venceu: false, num_tentativas: 6 }], HOJE);
  assert.match(montarEstatisticas(s), /Vitórias: \*\*0%\*\* · Média: \*\*—\*\*/);
});
