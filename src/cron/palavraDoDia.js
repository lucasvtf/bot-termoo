import cron from 'node-cron';
import { garantirPalavraDoDia } from '../services/palavraDoDia.js';
import { anunciarDiaAnterior } from '../services/anuncioDiario.js';
import { dataDeHoje } from '../utils/datas.js';

export function registerPalavraDoDia(client) {
  cron.schedule('0 0 * * *', () => rodarPalavraDoDia(client).catch((e) => console.error('[palavraDoDia]', e)), {
    timezone: 'America/Sao_Paulo',
  });
  console.log('[cron] palavraDoDia registrado (00:00 BRT)');

  // No startup também: se o bot estava fora do ar à meia-noite, o anúncio sai agora
  // (idempotente — se já saiu, não faz nada).
  rodarPalavraDoDia(client).catch((e) => console.error('[palavraDoDia:startup]', e));
}

export async function rodarPalavraDoDia(client) {
  const dia = await garantirPalavraDoDia(dataDeHoje());
  console.log(`[palavraDoDia] palavra do dia ${dia.data} sorteada`);
  await anunciarDiaAnterior(client);
}
