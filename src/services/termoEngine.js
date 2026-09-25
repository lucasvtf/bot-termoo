export const TAMANHO_PALAVRA = 5;
import { maxTentativas } from './modos.js';

// Limite do Termo clássico (1 palavra). Pros outros modos use maxTentativas(n) de modos.js.
export const MAX_TENTATIVAS = maxTentativas(1);

export function calcularFeedback(tentativa, palavraCerta) {
  const t = tentativa.toUpperCase();
  const p = palavraCerta.toUpperCase();
  const feedback = new Array(TAMANHO_PALAVRA).fill('cinza');
  const pool = {};

  for (let i = 0; i < TAMANHO_PALAVRA; i++) {
    if (t[i] === p[i]) {
      feedback[i] = 'verde';
    } else {
      pool[p[i]] = (pool[p[i]] ?? 0) + 1;
    }
  }

  for (let i = 0; i < TAMANHO_PALAVRA; i++) {
    if (feedback[i] === 'verde') continue;
    const letra = t[i];
    if (pool[letra] > 0) {
      feedback[i] = 'amarelo';
      pool[letra] -= 1;
    }
  }

  return feedback;
}

// Estado de uma partida com N palavras simultâneas (N = 1 no Termo clássico).
// resolvidaEm[i]: em qual tentativa (1-based) a palavra i foi acertada, ou null.
export function estadoDaPartida(tentativas, palavras) {
  const resolvidaEm = palavras.map((p) => {
    const i = tentativas.indexOf(p);
    return i === -1 ? null : i + 1;
  });
  const venceu = resolvidaEm.every((n) => n !== null);
  const finalizado = venceu || tentativas.length >= maxTentativas(palavras.length);
  return { resolvidaEm, venceu, finalizado };
}

// Tentativas que aparecem no grid de cada palavra: depois de acertada, o grid "congela".
export function tentativasPorPalavra(tentativas, palavras) {
  const { resolvidaEm } = estadoDaPartida(tentativas, palavras);
  return palavras.map((_, i) => tentativas.slice(0, resolvidaEm[i] ?? tentativas.length));
}
