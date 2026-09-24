// Fuso do jogo: define quando o dia vira (palavra nova + anúncio). Configurável via .env.
export const FUSO = process.env.FUSO_HORARIO || 'Europe/Lisbon';

// 'YYYY-MM-DD' de hoje no fuso do jogo
export function dataDeHoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
}

export function diaAnterior(dataStr) {
  const d = new Date(`${dataStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Segunda-feira da semana de dataStr ('YYYY-MM-DD')
export function inicioDaSemana(dataStr) {
  const d = new Date(`${dataStr}T00:00:00Z`);
  const diasDesdeSegunda = (d.getUTCDay() + 6) % 7; // domingo=0 → 6
  d.setUTCDate(d.getUTCDate() - diasDesdeSegunda);
  return d.toISOString().slice(0, 10);
}

export function inicioDoMes(dataStr) {
  return `${dataStr.slice(0, 7)}-01`;
}

export function nomeDoMes(dataStr) {
  return MESES[Number(dataStr.slice(5, 7)) - 1];
}

// '2026-09-21' → '21/09'
export function formatarDiaMes(dataStr) {
  return `${dataStr.slice(8, 10)}/${dataStr.slice(5, 7)}`;
}
