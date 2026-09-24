import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TAMANHO_PALAVRA } from './termoEngine.js';
import { normalizar } from '../utils/normalizar.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const carregar = (arquivo) => JSON.parse(readFileSync(join(__dirname, '..', 'data', arquivo), 'utf8'));

// Candidatas a palavra do dia (curadas)
export const RESPOSTAS = carregar('palavras-respostas.json');
// Tudo que é aceito como tentativa (amplo)
const PALAVRAS_VALIDAS = new Set(carregar('palavras-validas.json'));

// Só normaliza e checa o formato (5 letras A-Z). Retorna { palavra } ou { erro }.
export function validarFormato(entrada) {
  const palavra = normalizar(entrada);
  if (palavra.length !== TAMANHO_PALAVRA || !/^[A-Z]+$/.test(palavra)) {
    return { erro: `Palavra inválida — precisa ter ${TAMANHO_PALAVRA} letras.` };
  }
  return { palavra };
}

// Formato + precisa estar na lista de palavras válidas. Retorna { palavra } ou { erro }.
export function validarPalavra(entrada) {
  const resultado = validarFormato(entrada);
  if (resultado.erro) return resultado;
  if (!PALAVRAS_VALIDAS.has(resultado.palavra)) {
    return { erro: `\`${resultado.palavra}\` não é uma palavra reconhecida.` };
  }
  return resultado;
}
