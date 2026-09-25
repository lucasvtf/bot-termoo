// Estatísticas pessoais do /termo-stats (lógica pura, testada em estatisticas.test.js)
import { calcularStreaks, calcularMaiorStreak } from './streaks.js';
import { resumirPartidas, histograma, faixaDeTentativas } from './resumoDia.js';

// partidasOrdenadasDesc: finalizadas do usuário, mais recente primeiro ({ data, venceu, num_tentativas })
// numPalavras: 1 (Termo), 2 (Dueto) ou 4 (Quarteto) — define a faixa do histograma.
export function calcularEstatisticas(partidasOrdenadasDesc, hoje, numPalavras = 1) {
  const { jogaram, acertaram, distribuicao } = resumirPartidas(partidasOrdenadasDesc, faixaDeTentativas(numPalavras));
  const tentativasVitorias = partidasOrdenadasDesc.filter((p) => p.venceu).map((p) => p.num_tentativas);
  const media = tentativasVitorias.length > 0
    ? tentativasVitorias.reduce((a, b) => a + b, 0) / tentativasVitorias.length
    : null;

  return {
    jogos: jogaram,
    pctVitorias: jogaram > 0 ? Math.round((acertaram / jogaram) * 100) : 0,
    media,
    streakAtual: calcularStreaks(partidasOrdenadasDesc, hoje).streakAcertos,
    maiorStreak: calcularMaiorStreak(partidasOrdenadasDesc),
    distribuicao,
  };
}

export function montarEstatisticas(s) {
  return [
    `Jogos: **${s.jogos}** · Vitórias: **${s.pctVitorias}%** · Média: **${s.media !== null ? s.media.toFixed(1) : '—'}**`,
    `Streak atual: **${s.streakAtual}** · Maior streak: **${s.maiorStreak}**`,
    '```',
    histograma(s.distribuicao),
    '```',
  ].join('\n');
}
