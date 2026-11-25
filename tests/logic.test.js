import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultState, normalizeState, addDays, diffDays, treatmentStatus, treatmentById,
  itemsForDate, dayScore, streak, tripAlert, packingList, nextWeeklyDate, weekday, timelineRange,
} from '../js/logic.js';

const ids = (date, st) => itemsForDate(date, st).map((i) => i.id);

test('aritmética de fechas sin desfases (cambios de hora y fin de año)', () => {
  assert.equal(addDays('2026-10-24', 1), '2026-10-25'); // cambio de hora en Europa
  assert.equal(addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(diffDays('2026-03-28', '2026-03-30'), 2);
  assert.equal(diffDays('2026-10-24', '2026-10-26'), 2);
  assert.equal(diffDays('2026-11-30', '2026-11-24'), -6);
  assert.equal(weekday('2026-11-24'), 2); // martes
});

test('día X de N y fin automático con las fechas por defecto', () => {
  const st = defaultState();
  const s = (id, d) => treatmentStatus(treatmentById(id), d, st);
  assert.deepEqual([s('itra', '2026-11-23').day, s('itra', '2026-11-24').day], [1, 2]);
  assert.equal(s('itra', '2026-11-29').day, 7);
  assert.equal(s('itra', '2026-11-30').state, 'ended');
  assert.equal(s('itra', '2026-11-22').state, 'pending');
  assert.equal(s('dermo', '2026-11-30').day, 7);
  assert.equal(s('dermo', '2026-12-01').state, 'ended');
  assert.equal(s('betnate', '2026-11-25').day, 2);
  assert.equal(s('betnate', '2026-11-26').state, 'ended');
  assert.equal(s('keomed', '2026-12-08').day, 15);
});

test('Keomed: 15 días diario y luego semanal el mismo día de la semana', () => {
  const st = defaultState();
  const k = treatmentById('keomed');
  const active = [];
  for (let d = '2026-11-24'; d <= '2027-01-31'; d = addDays(d, 1)) {
    if (treatmentStatus(k, d, st).state === 'active') active.push(d);
  }
  assert.equal(active.slice(0, 15).length, 15);
  assert.equal(active[14], '2026-12-08');
  const weekly = active.slice(15);
  assert.deepEqual(weekly.slice(0, 3), ['2026-12-15', '2026-12-22', '2026-12-29']);
  assert.ok(weekly.every((d) => weekday(d) === weekday('2026-11-24')));
  assert.equal(treatmentStatus(k, '2026-12-15', st).session, 1);
  assert.equal(treatmentStatus(k, '2026-12-22', st).session, 2);
  assert.equal(treatmentStatus(k, '2026-12-10', st).state, 'rest');
  assert.equal(treatmentStatus(k, '2026-12-10', st).next, '2026-12-15');
  assert.equal(nextWeeklyDate(k, st, '2026-12-09'), '2026-12-15');
});

test('al cambiar una fecha de inicio todo se recalcula', () => {
  const st = defaultState();
  st.settings.starts.keomed = '2026-12-03'; // jueves
  const k = treatmentById('keomed');
  assert.equal(treatmentStatus(k, '2026-11-24', st).state, 'pending');
  assert.equal(treatmentStatus(k, '2026-12-03', st).day, 1);
  assert.equal(treatmentStatus(k, '2026-12-17', st).day, 15);
  assert.equal(treatmentStatus(k, '2026-12-24', st).phase, 'weekly');
  assert.equal(weekday('2026-12-24'), 4);
  assert.ok(!ids('2026-11-24', st).includes('c_keomed'));

  st.settings.starts.itra = '2026-12-01';
  assert.ok(!ids('2026-11-24', st).includes('d_itra'));
  assert.ok(ids('2026-12-07', st).includes('d_itra'));
  assert.ok(!ids('2026-12-08', st).includes('d_itra'));

  // El aviso de viaje recalcula los productos activos.
  const names = packingList(st).map((p) => p.name);
  assert.ok(names.includes('Itraconazol 100 mg'));
  assert.ok(names.includes('Keomed 2% champú'));

  const r = timelineRange(st, '2026-11-24');
  assert.ok(r.to >= '2026-12-17');
});

test('productos por comprar salen pero no cuentan; opcional no cuenta', () => {
  const st = defaultState();
  const items = itemsForDate('2026-11-24', st);
  const eff = items.find((i) => i.id === 'm_effaclar');
  assert.equal(eff.missing, true);
  assert.equal(eff.counted, false);
  assert.equal(items.find((i) => i.id === 'm_isdin').counted, false);
  st.settings.owned.effaclar = '2026-11-26';
  assert.equal(itemsForDate('2026-11-25', st).find((i) => i.id === 'm_effaclar').counted, false);
  assert.equal(itemsForDate('2026-11-26', st).find((i) => i.id === 'm_effaclar').counted, true);
});

test('porcentaje del día y racha ≥ 80 %', () => {
  const st = defaultState();
  const d = '2026-11-24';
  const counted = itemsForDate(d, st).filter((i) => i.counted);
  // 24/11: L'Oréal, Dermosopal x2, Betnate, Keomed, Itraconazol, Azelac + 6 hábitos = 13 + agua
  assert.equal(counted.length, 13);
  assert.equal(dayScore(d, st).total, 14);
  assert.equal(dayScore(d, st).pct, 0);
  const fill = (date) => {
    const done = {};
    for (const i of itemsForDate(date, st)) if (i.counted) done[i.id] = true;
    st.log[date] = { done, water: 8 };
  };
  fill('2026-11-22'); fill('2026-11-23'); fill('2026-11-24');
  assert.equal(dayScore(d, st).pct, 100);
  assert.equal(streak(st, '2026-11-24'), 3);
  st.log['2026-11-25'] = { done: {}, water: 4 }; // hoy aún incompleto: no rompe la racha
  assert.equal(streak(st, '2026-11-25'), 3);
  st.log['2026-11-24'].water = 0;
  delete st.log['2026-11-24'].done.h_h1;
  delete st.log['2026-11-24'].done.h_h2;
  assert.ok(dayScore(d, st).pct < 80);
  assert.equal(streak(st, '2026-11-24'), 2);
});

test('aviso de maleta 4 días antes del viaje', () => {
  const st = defaultState();
  assert.equal(tripAlert(st, '2026-11-25'), null);
  const a = tripAlert(st, '2026-11-26');
  assert.equal(a.phase, 'before');
  assert.equal(a.daysLeft, 4);
  const names = a.items.map((p) => p.name);
  assert.ok(names.includes('Keomed 2% champú'));
  assert.ok(names.includes('Dermosopal crema')); // termina el 30/11, primer día de viaje
  assert.ok(!names.includes('Itraconazol 100 mg')); // termina el 29/11
  assert.ok(!names.includes('Betnate loción capilar'));
  assert.equal(tripAlert(st, '2026-12-05').phase, 'during');
  assert.equal(tripAlert(st, '2026-12-06'), null);
  st.settings.trip.show = false;
  assert.equal(tripAlert(st, '2026-11-28'), null);
});

test('importar valida y completa datos', () => {
  const st = defaultState();
  st.log['2026-11-24'] = { done: { d_itra: true, bad: 'x' }, water: 3 };
  const round = normalizeState(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(round.log['2026-11-24'], { done: { d_itra: true }, water: 3 });
  assert.throws(() => normalizeState({ foo: 1 }));
  const partial = normalizeState({ settings: { starts: { itra: '2026-13-40' } }, habits: [], log: {} });
  assert.equal(partial.settings.starts.itra, '2026-11-23');
});
