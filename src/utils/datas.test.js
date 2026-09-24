import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inicioDaSemana, inicioDoMes, nomeDoMes, formatarDiaMes } from './datas.js';

test('início da semana é a segunda-feira', () => {
  assert.equal(inicioDaSemana('2026-09-24'), '2026-09-21'); // quinta
  assert.equal(inicioDaSemana('2026-09-21'), '2026-09-21'); // a própria segunda
  assert.equal(inicioDaSemana('2026-09-27'), '2026-09-21'); // domingo fecha a semana
  assert.equal(inicioDaSemana('2026-10-01'), '2026-09-28'); // atravessa o mês
});

test('mês', () => {
  assert.equal(inicioDoMes('2026-09-24'), '2026-09-01');
  assert.equal(nomeDoMes('2026-09-24'), 'Setembro');
  assert.equal(formatarDiaMes('2026-09-21'), '21/09');
});
