export const TAMANHO_PALAVRA = 5;
export const MAX_TENTATIVAS = 6;

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
