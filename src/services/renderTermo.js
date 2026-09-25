import { createCanvas } from '@napi-rs/canvas';
import {
  calcularFeedback, MAX_TENTATIVAS, TAMANHO_PALAVRA, estadoDaPartida, tentativasPorPalavra,
} from './termoEngine.js';
import { maxTentativas } from './modos.js';

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

function desenharGrid(ctx, largura, y, tentativas, palavraCerta, { revelarLetras, numLinhas, tile, gap, x: xFixo }) {
  const gridLargura = TAMANHO_PALAVRA * tile + (TAMANHO_PALAVRA - 1) * gap;
  const x0 = xFixo ?? (largura - gridLargura) / 2;
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

// ---------- Dueto / Quarteto ----------

// Grids lado a lado (Dueto) ou em 2×2 (Quarteto), menores pra caber tudo numa imagem.
const LAYOUT_MULTI = {
  2: { colunas: 2, tile: 40, gap: 6, espaco: 28 },
  4: { colunas: 2, tile: 30, gap: 4, espaco: 20 },
};

// Tecla dividida em N partes, uma por palavra, na mesma posição do grid dela:
// Dueto = metade esquerda/direita; Quarteto = quadrantes (↖ ↗ ↙ ↘).
function desenharTecladoMulti(ctx, largura, y, statusPorPalavra, colunas) {
  const n = statusPorPalavra.length;
  const linhas = Math.ceil(n / colunas);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  TECLADO_LINHAS.forEach((linhaTeclas, i) => {
    const linhaLargura = linhaTeclas.length * (TECLA_LARGURA + GAP_TECLA) - GAP_TECLA;
    const x0 = (largura - linhaLargura) / 2;
    const yy = y + i * (TECLA_ALTURA + GAP_TECLA);
    linhaTeclas.split('').forEach((letra, j) => {
      const x = x0 + j * (TECLA_LARGURA + GAP_TECLA);
      const segL = TECLA_LARGURA / colunas;
      const segA = TECLA_ALTURA / linhas;
      statusPorPalavra.forEach((status, k) => {
        const c = k % colunas;
        const l = Math.floor(k / colunas);
        ctx.fillStyle = status[letra] ? CORES[status[letra]] : CORES.teclaNeutra;
        ctx.fillRect(x + c * segL, yy + l * segA, segL, segA);
      });
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillText(letra, x + TECLA_LARGURA / 2, yy + TECLA_ALTURA / 2 + 1);
      ctx.shadowBlur = 0;
    });
  });
}

// Imagem da partida em qualquer modo: 1 palavra usa o layout clássico do Termo.
export function renderPartida(tentativas, palavras) {
  if (palavras.length === 1) return renderTermoImagem(tentativas, palavras[0]);

  const { colunas, tile, gap, espaco } = LAYOUT_MULTI[palavras.length];
  const linhasDeGrids = Math.ceil(palavras.length / colunas);
  const numLinhas = maxTentativas(palavras.length);
  const gridLargura = TAMANHO_PALAVRA * tile + (TAMANHO_PALAVRA - 1) * gap;
  const gridAltura = numLinhas * tile + (numLinhas - 1) * gap;
  const areaLargura = colunas * gridLargura + (colunas - 1) * espaco;
  const areaAltura = linhasDeGrids * gridAltura + (linhasDeGrids - 1) * espaco;
  const tecladoAltura = TECLADO_LINHAS.length * (TECLA_ALTURA + GAP_TECLA) - GAP_TECLA;

  const largura = Math.max(areaLargura, larguraTeclado()) + PAD * 2;
  const altura = PAD + areaAltura + PAD + tecladoAltura + PAD;
  const canvas = createCanvas(largura, altura);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = CORES.fundo;
  ctx.fillRect(0, 0, largura, altura);

  // Cada grid só mostra as tentativas até a palavra dele ser acertada (depois "congela")
  const porPalavra = tentativasPorPalavra(tentativas, palavras);
  const { resolvidaEm } = estadoDaPartida(tentativas, palavras);
  const areaX = (largura - areaLargura) / 2;

  palavras.forEach((palavra, i) => {
    const x = areaX + (i % colunas) * (gridLargura + espaco);
    const y = PAD + Math.floor(i / colunas) * (gridAltura + espaco);
    desenharGrid(ctx, largura, y, porPalavra[i], palavra, { revelarLetras: true, numLinhas, tile, gap, x });
    if (resolvidaEm[i] !== null) {
      ctx.strokeStyle = CORES.verde;
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 6, y - 6, gridLargura + 12, gridAltura + 12);
    }
  });

  const statusPorPalavra = palavras.map((palavra, i) => statusLetras(porPalavra[i], palavra));
  desenharTecladoMulti(ctx, largura, PAD + areaAltura + PAD, statusPorPalavra, colunas);

  return canvas.toBuffer('image/png');
}
