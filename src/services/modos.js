// Modos de jogo. Cada modo tem sua palavra (ou palavras) do dia, suas partidas e seu ranking.
// Limite de tentativas = número de palavras + 5 (Termo 6, Dueto 7, Quarteto 9), como no term.ooo.
export const MODOS = {
  termo: { nome: 'Termo', palavras: 1 },
  dueto: { nome: 'Dueto', palavras: 2 },
  quarteto: { nome: 'Quarteto', palavras: 4 },
};

export const MODO_PADRAO = 'termo';

export function maxTentativas(numPalavras) {
  return numPalavras + 5;
}

export function maxTentativasDoModo(modo) {
  return maxTentativas(MODOS[modo].palavras);
}
