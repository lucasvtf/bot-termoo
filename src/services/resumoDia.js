// Lógica pura do anúncio diário (sem banco/Discord) — testada em resumoDia.test.js
import { MAX_TENTATIVAS } from './termoEngine.js';

const LARGURA_BARRA = 10;
const MAX_NOMES = 5;

// partidas: [{ usuario_id, venceu, num_tentativas }] — só as finalizadas do dia
export function resumirPartidas(partidas) {
  const distribuicao = {};
  for (let i = 1; i <= MAX_TENTATIVAS; i++) distribuicao[i] = 0;
  distribuicao.X = 0;

  for (const p of partidas) {
    if (p.venceu) distribuicao[p.num_tentativas] += 1;
    else distribuicao.X += 1;
  }

  const vencedores = partidas.filter((p) => p.venceu);
  const melhor = vencedores.length > 0 ? Math.min(...vencedores.map((p) => p.num_tentativas)) : null;
  const maisRapidos = vencedores.filter((p) => p.num_tentativas === melhor).map((p) => String(p.usuario_id));

  return { jogaram: partidas.length, acertaram: vencedores.length, melhor, maisRapidos, distribuicao };
}

function listar(itens) {
  const visiveis = itens.length > MAX_NOMES ? itens.slice(0, MAX_NOMES - 1) : itens;
  const resto = itens.length - visiveis.length;
  if (resto > 0) return `${visiveis.join(', ')} e mais ${resto}`;
  if (visiveis.length === 1) return visiveis[0];
  return `${visiveis.slice(0, -1).join(', ')} e ${visiveis[visiveis.length - 1]}`;
}

export function histograma(distribuicao) {
  const maior = Math.max(...Object.values(distribuicao));
  return Object.entries(distribuicao)
    .sort(([a], [b]) => (a === 'X') - (b === 'X') || a - b) // 1..6 e depois X
    .map(([rotulo, n]) => {
      const tamanho = n === 0 ? 0 : Math.max(1, Math.round((n / maior) * LARGURA_BARRA));
      return `${rotulo} │ ${'█'.repeat(tamanho)}${tamanho > 0 ? ' ' : ''}${n}`;
    })
    .join('\n');
}

// linhas: [{ usuario_id, vitorias, media }] da semana. Mesmo critério do ranking:
// mais vitórias, desempate pela menor média. Retorna null se ninguém venceu.
export function calcularCampeoes(linhas) {
  const validas = linhas
    .map((l) => ({ id: String(l.usuario_id), vitorias: Number(l.vitorias), media: l.media === null ? null : Number(l.media) }))
    .filter((l) => l.vitorias > 0);
  if (validas.length === 0) return null;

  const maxVitorias = Math.max(...validas.map((l) => l.vitorias));
  const comMax = validas.filter((l) => l.vitorias === maxVitorias);
  const melhorMedia = Math.min(...comMax.map((l) => l.media));
  const ids = comMax.filter((l) => Math.abs(l.media - melhorMedia) < 1e-9).map((l) => l.id);
  return { ids, vitorias: maxVitorias, media: melhorMedia };
}

export function montarAnuncio(palavraOntem, resumo, campeoes = null) {
  const linhas = [
    '**🟩 Novo Termo disponível!** Use `/termo` pra jogar.',
    '',
    `**A palavra de ontem era \`${palavraOntem}\`**`,
  ];

  const { jogaram, acertaram, melhor, maisRapidos, distribuicao } = resumo;
  if (jogaram === 0) {
    linhas.push('Ninguém jogou ontem.');
  } else {
    linhas.push(...linhasResumo(jogaram, acertaram, melhor, maisRapidos, distribuicao));
  }

  if (campeoes) {
    const rotulo = campeoes.ids.length === 1 ? 'Campeão da semana' : 'Campeões da semana';
    const vit = `${campeoes.vitorias} ${campeoes.vitorias === 1 ? 'vitória' : 'vitórias'}`;
    linhas.push('', `👑 **${rotulo}:** ${listar(campeoes.ids.map((id) => `<@${id}>`))} — ${vit}, média ${campeoes.media.toFixed(2)}`);
  }

  return linhas.join('\n');
}

function linhasResumo(jogaram, acertaram, melhor, maisRapidos, distribuicao) {
  const linhas = [];

  const pct = Math.round((acertaram / jogaram) * 100);
  linhas.push(
    `${jogaram} ${jogaram === 1 ? 'pessoa jogou' : 'pessoas jogaram'} · `
    + `${acertaram} ${acertaram === 1 ? 'acertou' : 'acertaram'} (${pct}%)`,
  );

  if (melhor !== null) {
    const rotulo = maisRapidos.length === 1 ? 'Mais rápido' : 'Mais rápidos';
    const mencoes = listar(maisRapidos.map((id) => `<@${id}>`));
    linhas.push(`🏆 ${rotulo}: ${mencoes} em **${melhor}** ${melhor === 1 ? 'tentativa' : 'tentativas'}`);
  }

  linhas.push('```', histograma(distribuicao), '```');
  return linhas;
}
