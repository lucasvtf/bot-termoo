const DIACRITICOS_RE = /\p{Diacritic}/gu;

export function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS_RE, '')
    .toUpperCase()
    .trim();
}
