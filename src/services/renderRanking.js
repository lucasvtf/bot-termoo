import { createCanvas } from '@napi-rs/canvas';
import { CORES } from './renderTermo.js';

const LARGURA = 640;
const PAD = 20;
const ALTURA_TITULO = 50;
const ALTURA_BANNER = 40;
const ALTURA_CABECALHO = 28;
const ALTURA_LINHA = 50;
const RAIO_BADGE = 16;

const COR_FUNDO = '#121213';
const COR_LINHA_ALT = '#1c1c1e';
const COR_TEXTO = '#ffffff';
const COR_TEXTO_MUTED = '#818384';
const COR_TEXTO_MUTED_2 = '#5c5c5e';
const COR_BANNER_FUNDO = '#1a2a1c';
const CORES_MEDALHA = ['#d4af37', '#c0c0c0', '#cd7f32'];
const COR_BADGE_PADRAO = '#3a3a3c';

function colX(offsetDaDireita) {
  return LARGURA - PAD - offsetDaDireita;
}

const COL_MEDIA = colX(0);
const COL_VITORIAS = colX(90);
const COL_DIAS = colX(185);
const COL_STREAK = colX(280);

function truncar(ctx, texto, larguraMax) {
  if (ctx.measureText(texto).width <= larguraMax) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > larguraMax) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

function mesmasPontuacoes(a, b) {
  return a.vitorias === b.vitorias && a.mediaTentativas === b.mediaTentativas;
}

export function renderRankingImagem(stats, { destaqueStreak = null } = {}) {
  const alturaBanner = destaqueStreak ? ALTURA_BANNER : 0;
  const altura = ALTURA_TITULO + alturaBanner + ALTURA_CABECALHO + stats.length * ALTURA_LINHA + PAD;
  const canvas = createCanvas(LARGURA, altura);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COR_FUNDO;
  ctx.fillRect(0, 0, LARGURA, altura);

  ctx.fillStyle = COR_TEXTO;
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Ranking do Termo', PAD, ALTURA_TITULO / 2 + 4);

  if (destaqueStreak) {
    const yBanner = ALTURA_TITULO;
    ctx.fillStyle = COR_BANNER_FUNDO;
    ctx.fillRect(0, yBanner, LARGURA, ALTURA_BANNER);
    ctx.fillStyle = CORES.verde;
    ctx.fillRect(0, yBanner, 4, ALTURA_BANNER);

    const cyBanner = yBanner + ALTURA_BANNER / 2;
    ctx.textAlign = 'left';
    ctx.font = '600 14px Arial';
    ctx.fillStyle = COR_TEXTO_MUTED;
    const rotulo = 'Maior streak atual  ';
    ctx.fillText(rotulo, PAD, cyBanner + 1);
    const larguraRotulo = ctx.measureText(rotulo).width;

    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = COR_TEXTO;
    const nome = `${destaqueStreak.username}`;
    ctx.fillText(nome, PAD + larguraRotulo, cyBanner + 1);
    const larguraNome = ctx.measureText(nome).width;

    ctx.font = '600 14px Arial';
    ctx.fillStyle = CORES.verde;
    ctx.fillText(` — ${destaqueStreak.valor} dias seguidos`, PAD + larguraRotulo + larguraNome, cyBanner + 1);
  }

  const yCabecalho0 = ALTURA_TITULO + alturaBanner;
  ctx.fillStyle = COR_TEXTO_MUTED;
  ctx.font = '13px Arial';
  ctx.textAlign = 'right';
  const yCabecalho = yCabecalho0 + ALTURA_CABECALHO / 2;
  ctx.fillText('streak', COL_STREAK, yCabecalho);
  ctx.fillText('dias', COL_DIAS, yCabecalho);
  ctx.fillText('vitórias', COL_VITORIAS, yCabecalho);
  ctx.fillText('média', COL_MEDIA, yCabecalho);

  const posicoes = stats.map((_, i) => i + 1);
  for (let i = 1; i < stats.length; i++) {
    if (mesmasPontuacoes(stats[i], stats[i - 1])) posicoes[i] = posicoes[i - 1];
  }

  const yLinhas0 = yCabecalho0 + ALTURA_CABECALHO;
  stats.forEach((s, i) => {
    const posicao = posicoes[i];
    const y = yLinhas0 + i * ALTURA_LINHA;
    const cy = y + ALTURA_LINHA / 2;

    if (i % 2 === 1) {
      ctx.fillStyle = COR_LINHA_ALT;
      ctx.fillRect(0, y, LARGURA, ALTURA_LINHA);
    }

    const cx = PAD + RAIO_BADGE;
    ctx.beginPath();
    ctx.arc(cx, cy, RAIO_BADGE, 0, Math.PI * 2);
    ctx.fillStyle = CORES_MEDALHA[posicao - 1] ?? COR_BADGE_PADRAO;
    ctx.fill();
    ctx.fillStyle = posicao <= 3 ? '#121213' : COR_TEXTO;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(posicao), cx, cy + 1);

    const nomeX = PAD + RAIO_BADGE * 2 + 14;
    const nomeMaxLargura = COL_STREAK - 70 - nomeX;
    ctx.textAlign = 'left';
    ctx.fillStyle = COR_TEXTO;
    ctx.font = '600 17px Arial';
    ctx.fillText(truncar(ctx, s.username, nomeMaxLargura), nomeX, cy + 1);

    // vitórias e média são o critério de ranqueamento: mais destaque
    ctx.textAlign = 'right';
    ctx.font = 'bold 17px Arial';
    ctx.fillStyle = CORES.amarelo;
    ctx.fillText(String(s.vitorias), COL_VITORIAS, cy + 1);

    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = COR_TEXTO;
    ctx.fillText(s.mediaTentativas !== null ? s.mediaTentativas.toFixed(2) : '—', COL_MEDIA, cy + 1);

    // streak e dias são "conquistas": menor destaque, não influenciam a posição
    ctx.font = '13px Arial';
    ctx.fillStyle = s.streakAcertos > 0 ? CORES.verde : COR_TEXTO_MUTED_2;
    ctx.fillText(String(s.streakAcertos), COL_STREAK, cy + 1);

    ctx.fillStyle = COR_TEXTO_MUTED_2;
    ctx.fillText(String(s.streakJogos), COL_DIAS, cy + 1);
  });

  return canvas.toBuffer('image/png');
}
