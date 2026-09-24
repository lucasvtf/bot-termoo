import { diaAnterior } from '../utils/datas.js';

// partidasOrdenadasDesc: partidas finalizadas do usuário, da mais recente pra mais antiga ({ data, venceu }).
// O streak só está "vivo" se a última partida for de hoje ou de ontem (quem ainda não jogou hoje não perde).
export function calcularStreaks(partidasOrdenadasDesc, hoje) {
  const maisRecente = partidasOrdenadasDesc[0]?.data;
  if (maisRecente !== hoje && maisRecente !== diaAnterior(hoje)) {
    return { streakAcertos: 0, streakJogos: 0 };
  }

  let streakAcertos = 0;
  let streakJogos = 0;
  let acertosAindaValendo = true;
  let dataEsperada = null;

  for (const p of partidasOrdenadasDesc) {
    if (dataEsperada !== null && p.data !== dataEsperada) break;
    streakJogos += 1;
    if (acertosAindaValendo && p.venceu) {
      streakAcertos += 1;
    } else {
      acertosAindaValendo = false;
    }
    dataEsperada = diaAnterior(p.data);
  }

  return { streakAcertos, streakJogos };
}

// Maior sequência de vitórias em dias consecutivos, em todo o histórico.
export function calcularMaiorStreak(partidasOrdenadasDesc) {
  let maior = 0;
  let atual = 0;
  let dataEsperada = null;

  for (const p of partidasOrdenadasDesc) {
    if (!p.venceu) {
      atual = 0;
      dataEsperada = null;
      continue;
    }
    if (dataEsperada !== null && p.data !== dataEsperada) atual = 0;
    atual += 1;
    maior = Math.max(maior, atual);
    dataEsperada = diaAnterior(p.data);
  }

  return maior;
}
