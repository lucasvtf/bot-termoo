import cron from 'node-cron';
import { garantirPalavraDoDia, dataDeHoje } from '../services/palavraDoDia.js';

export function registerPalavraDoDia() {
  cron.schedule('0 0 * * *', () => rodarPalavraDoDia().catch((e) => console.error('[palavraDoDia]', e)), {
    timezone: 'America/Sao_Paulo',
  });
  console.log('[cron] palavraDoDia registrado (00:00 BRT)');
}

export async function rodarPalavraDoDia() {
  const dia = await garantirPalavraDoDia(dataDeHoje());
  console.log(`[palavraDoDia] palavra do dia ${dia.data}: ${dia.palavra}`);
}
