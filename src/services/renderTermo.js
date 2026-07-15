import { createCanvas } from '@napi-rs/canvas';
import { calcularFeedback, MAX_TENTATIVAS, TAMANHO_PALAVRA } from './termoEngine.js';

export const CORES = {
  verde: '#538d4e',
  amarelo: '#b59f3b',
  cinza: '#3a3a3c',
  fundo: '#121213',
  bordaVazia: '#3a3a3c',
  teclaNeutra: '#818384',
};

const PRIORIDADE = { cinza: 0, amarelo: 1, verde: 2 };

const TILE_PADRAO = 50;
const GAP_TILE_PADRAO = 8;
const PAD = 24;

const TECLADO_LINHAS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const TECLA_LARGURA = 34;
const TECLA_ALTURA = 44;
const GAP_TECLA = 5;

function statusLetras(tentativas, palavraCerta) {
  const status = {};
  for (const t of tentativas) {
    const feedback = calcularFeedback(t, palavraCerta);
    for (let i = 0; i < t.length; i++) {
      const letra = t[i];
      if (!status[letra] || PRIORIDADE[feedback[i]] > PRIORIDADE[status[letra]]) status[letra] = feedback[i];
    }
  }
  return status;
}

function desenharGrid(ctx, largura, y, tentativas, palavraCerta, { revelarLetras, numLinhas, tile, gap }) {
  const gridLargura = TAMANHO_PALAVRA * tile + (TAMANHO_PALAVRA - 1) * gap;
  const x0 = (largura - gridLargura) / 2;
  const fonte = Math.round(tile * 0.52);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let linha = 0; linha < numLinhas; linha++) {
    const tentativa = tentativas[linha];
    const feedback = tentativa ? calcularFeedback(tentativa, palavraCerta) : null;
    for (let col = 0; col < TAMANHO_PALAVRA; col++) {
      const x = x0 + col * (tile + gap);
      const yy = y + linha * (tile + gap);
      if (feedback) {
        ctx.fillStyle = CORES[feedback[col]];
        ctx.fillRect(x, yy, tile, tile);
        if (revelarLetras) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${fonte}px Arial`;
          ctx.fillText(tentativa[col], x + tile / 2, yy + tile / 2 + 2);
        }
      } else {
        ctx.strokeStyle = CORES.bordaVazia;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, yy + 1, tile - 2, tile - 2);
      }
    }
  }

  return numLinhas * tile + (numLinhas - 1) * gap;
}

function desenharTeclado(ctx, largura, y, status) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  TECLADO_LINHAS.forEach((linhaTeclas, i) => {
    const linhaLargura = linhaTeclas.length * (TECLA_LARGURA + GAP_TECLA) - GAP_TECLA;
    const x0 = (largura - linhaLargura) / 2;
    const yy = y + i * (TECLA_ALTURA + GAP_TECLA);
    linhaTeclas.split('').forEach((letra, j) => {
      const x = x0 + j * (TECLA_LARGURA + GAP_TECLA);
      ctx.fillStyle = status[letra] ? CORES[status[letra]] : CORES.teclaNeutra;
      ctx.fillRect(x, yy, TECLA_LARGURA, TECLA_ALTURA);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(letra, x + TECLA_LARGURA / 2, yy + TECLA_ALTURA / 2 + 1);
    });
  });

  return TECLADO_LINHAS.length * (TECLA_ALTURA + GAP_TECLA) - GAP_TECLA;
}

function larguraTeclado() {
  return Math.max(...TECLADO_LINHAS.map((l) => l.length * (TECLA_LARGURA + GAP_TECLA) - GAP_TECLA));
}

export function renderTermoImagem(tentativas, palavraCerta, {
  revelarLetras = true,
  comTeclado = true,
  preencherRestante = true,
  tile = TILE_PADRAO,
  gap = GAP_TILE_PADRAO,
} = {}) {
  const numLinhas = preencherRestante ? MAX_TENTATIVAS : Math.max(tentativas.length, 1);
  const gridLargura = TAMANHO_PALAVRA * tile + (TAMANHO_PALAVRA - 1) * gap;
  const gridAltura = numLinhas * tile + (numLinhas - 1) * gap;
  const tecladoAltura = comTeclado ? TECLADO_LINHAS.length * (TECLA_ALTURA + GAP_TECLA) - GAP_TECLA : 0;

  const largura = Math.max(gridLargura, comTeclado ? larguraTeclado() : 0) + PAD * 2;
  const altura = PAD + gridAltura + (comTeclado ? PAD + tecladoAltura : 0) + PAD;

  const canvas = createCanvas(largura, altura);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = CORES.fundo;
  ctx.fillRect(0, 0, largura, altura);

  const alturaGridUsada = desenharGrid(ctx, largura, PAD, tentativas, palavraCerta, {
    revelarLetras, numLinhas, tile, gap,
  });

  if (comTeclado) {
    const status = statusLetras(tentativas, palavraCerta);
    desenharTeclado(ctx, largura, PAD + alturaGridUsada + PAD, status);
  }

  return canvas.toBuffer('image/png');
}

export function renderTermoImagemPublica(tentativas, palavraCerta) {
  return renderTermoImagem(tentativas, palavraCerta, {
    revelarLetras: false,
    comTeclado: false,
    preencherRestante: false,
    tile: 28,
    gap: 5,
  });
}
