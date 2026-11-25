// Lógica pura (sin DOM): fechas en hora local, calendario de tratamientos y puntuación.
// Se usa en el navegador y en los tests de Node.

/* ---------- Fechas ----------
   Todas las fechas se guardan como texto "AAAA-MM-DD" y se interpretan en hora local.
   Las diferencias se calculan con Date.UTC sobre los componentes, así los cambios de
   horario (verano/invierno) y la zona horaria nunca desplazan un día. */

const pad = (n) => String(n).padStart(2, '0');

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(dt) {
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toISO(parseISO(s)) === s;
}

export function todayISO(now = new Date()) {
  return toISO(now);
}

export function addDays(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
}

/** Días de a hasta b (b − a). */
export function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function weekday(s) {
  return parseISO(s).getDay();
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fmtShort(s) {
  const d = parseISO(s);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
export function fmtLong(s) {
  const d = parseISO(s);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
export function weekdayInitial(s) {
  return DIAS_CORTO[weekday(s)][0].toUpperCase();
}
export function weekdayName(s) {
  return DIAS[weekday(s)];
}

/* ---------- Definición del tratamiento ---------- */

export const PRODUCTS = {
  effaclar: { name: 'Effaclar crema lavante' },
  mineral89: { name: 'Vichy Mineral 89 sérum' },
};

export const TREATMENTS = [
  { id: 'cara', name: 'Rutina facial', short: 'Cara', kind: 'continuous', color: 'teal' },
  { id: 'itra', name: 'Itraconazol 100 mg', short: 'Itraconazol', days: 7, color: 'violet' },
  { id: 'dermo', name: 'Dermosopal crema', short: 'Dermosopal', days: 7, color: 'amber' },
  { id: 'betnate', name: 'Betnate loción', short: 'Betnate', days: 2, color: 'rose' },
  { id: 'keomed', name: 'Keomed 2% champú', short: 'Keomed', days: 15, weekly: true, color: 'blue' },
];

export const SECTIONS = [
  { id: 'manana', name: 'Mañana', icon: '☀️' },
  { id: 'cuero', name: 'Cuero cabelludo', icon: '🧴' },
  { id: 'dia', name: 'Durante el día', icon: '💊' },
  { id: 'noche', name: 'Noche', icon: '🌙' },
  { id: 'habitos', name: 'Hábitos', icon: '✅' },
];

export const ITEMS = [
  { id: 'm_effaclar', t: 'cara', section: 'manana', name: 'Effaclar crema lavante', note: 'Limpieza', product: 'effaclar', pack: 'Effaclar crema lavante' },
  { id: 'm_loreal', t: 'cara', section: 'manana', name: "Hidratante L'Oréal Men vitamina C", pack: "Hidratante L'Oréal Men vitamina C" },
  { id: 'm_isdin', t: 'cara', section: 'manana', name: 'ISDIN Ultra 100', note: 'Días de mucho sol · opcional', optional: true, pack: 'ISDIN Ultra 100' },
  { id: 'm_dermo', t: 'dermo', section: 'manana', name: 'Dermosopal crema', note: 'Detrás de las orejas', pack: 'Dermosopal crema' },
  { id: 'c_betnate', t: 'betnate', section: 'cuero', name: 'Betnate loción capilar', note: 'En el cuero cabelludo', pack: 'Betnate loción capilar' },
  { id: 'c_keomed', t: 'keomed', section: 'cuero', name: 'Keomed 2% champú', note: 'Dejar actuar 3 min', timer: 180, pack: 'Keomed 2% champú' },
  { id: 'd_itra', t: 'itra', section: 'dia', name: 'Itraconazol 100 mg', note: '1 cápsula', pack: 'Itraconazol 100 mg' },
  { id: 'n_effaclar', t: 'cara', section: 'noche', name: 'Effaclar crema lavante', note: 'Limpieza', product: 'effaclar', pack: 'Effaclar crema lavante' },
  { id: 'n_azelac', t: 'cara', section: 'noche', name: 'Azelac', note: '3 gotas', pack: 'Azelac' },
  { id: 'n_m89', t: 'cara', section: 'noche', name: 'Vichy Mineral 89 sérum', note: '1 pump', product: 'mineral89', pack: 'Vichy Mineral 89 sérum' },
  { id: 'n_dermo', t: 'dermo', section: 'noche', name: 'Dermosopal crema', note: 'Detrás de las orejas', pack: 'Dermosopal crema' },
];

const DEFAULT_HABITS = ['Vitamina D + K2', 'Omega 3', 'Magnesio', 'Creatina', 'Proteína', 'Deporte'];

export function defaultState() {
  return {
    version: 1,
    settings: {
      starts: { cara: '2026-11-24', itra: '2026-11-23', dermo: '2026-11-24', betnate: '2026-11-24', keomed: '2026-11-24' },
      owned: { effaclar: null, mineral89: null }, // fecha desde la que lo tengo, o null = por comprar
      waterGoal: 8,
      trip: { show: true, name: 'Costa Rica', start: '2026-11-30', end: '2026-12-05' },
    },
    habits: DEFAULT_HABITS.map((name, i) => ({ id: 'h' + (i + 1), name, added: '2000-01-01', removed: null })),
    log: {},
  };
}

/** Completa/limpia un estado (p. ej. importado) para que siempre tenga la forma esperada. */
export function normalizeState(raw) {
  const def = defaultState();
  if (!raw || typeof raw !== 'object') throw new Error('El archivo no tiene un formato válido.');
  if (!raw.settings || !raw.log || !Array.isArray(raw.habits)) throw new Error('Faltan datos: no parece una copia de esta app.');
  const s = raw.settings;
  const out = def;
  for (const k of Object.keys(out.settings.starts)) {
    if (isISODate(s.starts?.[k])) out.settings.starts[k] = s.starts[k];
  }
  for (const k of Object.keys(out.settings.owned)) {
    const v = s.owned?.[k];
    out.settings.owned[k] = isISODate(v) ? v : null;
  }
  const goal = Number(s.waterGoal);
  if (Number.isFinite(goal) && goal >= 1 && goal <= 30) out.settings.waterGoal = Math.round(goal);
  if (s.trip) {
    out.settings.trip.show = !!s.trip.show;
    if (typeof s.trip.name === 'string') out.settings.trip.name = s.trip.name.slice(0, 40);
    if (isISODate(s.trip.start)) out.settings.trip.start = s.trip.start;
    if (isISODate(s.trip.end)) out.settings.trip.end = s.trip.end;
  }
  out.habits = raw.habits
    .filter((h) => h && typeof h.id === 'string' && typeof h.name === 'string')
    .map((h) => ({
      id: h.id,
      name: h.name.slice(0, 60),
      added: isISODate(h.added) ? h.added : '2000-01-01',
      removed: isISODate(h.removed) ? h.removed : null,
    }));
  out.log = {};
  for (const [date, entry] of Object.entries(raw.log)) {
    if (!isISODate(date) || !entry || typeof entry !== 'object') continue;
    const done = {};
    for (const [k, v] of Object.entries(entry.done || {})) if (v === true) done[k] = true;
    const water = Math.max(0, Math.min(50, Math.round(Number(entry.water) || 0)));
    out.log[date] = { done, water };
  }
  return out;
}

/* ---------- Calendario ---------- */

export const treatmentById = (id) => TREATMENTS.find((t) => t.id === id);

/** Fin (inclusive) de la fase diaria, o null si es continuo. */
export function dailyEnd(t, st) {
  const start = st.settings.starts[t.id];
  if (t.kind === 'continuous') return null;
  return addDays(start, t.days - 1);
}

/**
 * Estado de un tratamiento en una fecha:
 *  { state: 'pending' | 'active' | 'rest' | 'ended', day, total, phase, session }
 *  - 'rest': en mantenimiento semanal pero hoy no toca.
 */
export function treatmentStatus(t, date, st) {
  const start = st.settings.starts[t.id];
  const n = diffDays(start, date); // 0 = día 1
  if (n < 0) return { state: 'pending', startsIn: -n };
  if (t.kind === 'continuous') return { state: 'active', day: n + 1, phase: 'continuous' };
  if (n < t.days) return { state: 'active', day: n + 1, total: t.days, phase: 'daily' };
  if (t.weekly) {
    // Después de la fase diaria: 1 vez por semana, el mismo día de la semana que el día 1.
    const firstWeekly = Math.ceil(t.days / 7) * 7;
    if (n % 7 === 0) return { state: 'active', phase: 'weekly', session: (n - firstWeekly) / 7 + 1 };
    const next = addDays(date, 7 - (n % 7));
    return { state: 'rest', phase: 'weekly', next };
  }
  return { state: 'ended' };
}

/** Siguiente fecha (>= date) en la que toca un tratamiento semanal. */
export function nextWeeklyDate(t, st, from) {
  const start = st.settings.starts[t.id];
  let n = Math.max(diffDays(start, from), t.days);
  while (n % 7 !== 0) n++;
  return addDays(start, n);
}

export function isProductOwned(productId, date, st) {
  const since = st.settings.owned[productId];
  return !!since && diffDays(since, date) >= 0;
}

export function habitActive(h, date) {
  return diffDays(h.added, date) >= 0 && (!h.removed || diffDays(h.removed, date) < 0);
}

/** Lista de tareas de un día, en orden, con si cuentan o no para el %. */
export function itemsForDate(date, st) {
  const out = [];
  for (const it of ITEMS) {
    const t = treatmentById(it.t);
    const status = treatmentStatus(t, date, st);
    if (status.state !== 'active') continue;
    const missing = it.product && !isProductOwned(it.product, date, st);
    out.push({ ...it, status, missing, counted: !it.optional && !missing });
  }
  for (const h of st.habits) {
    if (!habitActive(h, date)) continue;
    out.push({ id: 'h_' + h.id, habitId: h.id, section: 'habitos', name: h.name, counted: true });
  }
  return out;
}

export function entryFor(st, date) {
  return st.log[date] || { done: {}, water: 0 };
}

/** Puntuación del día. El agua cuenta como una tarea más (fracción vasos/meta). */
export function dayScore(date, st) {
  const items = itemsForDate(date, st).filter((i) => i.counted);
  const e = entryFor(st, date);
  let done = items.filter((i) => e.done[i.id]).length;
  let total = items.length;
  const goal = st.settings.waterGoal;
  if (goal > 0) {
    total += 1;
    done += Math.min(e.water / goal, 1);
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

export function hasData(st, date) {
  const e = st.log[date];
  return !!e && (e.water > 0 || Object.keys(e.done).length > 0);
}

/** Días seguidos ≥ 80 %. Si hoy aún no llega, la racha cuenta hasta ayer. */
export function streak(st, today, threshold = 80) {
  let d = today;
  if (dayScore(d, st).pct < threshold) d = addDays(d, -1);
  let count = 0;
  while (dayScore(d, st).pct >= threshold && count < 3650) {
    count++;
    d = addDays(d, -1);
  }
  return count;
}

/* ---------- Viaje ---------- */

export function packingList(st) {
  const { start, end } = st.settings.trip;
  const seen = new Map();
  for (let d = start; diffDays(d, end) >= 0; d = addDays(d, 1)) {
    for (const it of ITEMS) {
      const status = treatmentStatus(treatmentById(it.t), d, st);
      if (status.state !== 'active') continue;
      if (!seen.has(it.pack)) {
        seen.set(it.pack, { name: it.pack, missing: !!it.product && !isProductOwned(it.product, start, st), optional: !!it.optional });
      }
    }
  }
  return [...seen.values()];
}

/** Aviso de maleta: visible desde 4 días antes hasta el último día del viaje. */
export function tripAlert(st, today) {
  const trip = st.settings.trip;
  if (!trip.show || !isISODate(trip.start) || !isISODate(trip.end)) return null;
  const until = diffDays(today, trip.start);
  const after = diffDays(trip.end, today);
  if (until > 4 || after > 0) return null;
  return { phase: until > 0 ? 'before' : 'during', daysLeft: until, items: packingList(st) };
}

/* ---------- Línea de tiempo ---------- */

export function timelineRange(st, today) {
  const starts = TREATMENTS.filter((t) => t.kind !== 'continuous').map((t) => st.settings.starts[t.id]);
  const ends = TREATMENTS.filter((t) => t.kind !== 'continuous').map((t) => dailyEnd(t, st));
  let from = [...starts, today].sort()[0];
  let to = [...ends, addDays(today, 14)].sort().at(-1);
  if (st.settings.trip.show) {
    if (st.settings.trip.start < from) from = st.settings.trip.start;
    if (st.settings.trip.end > to) to = st.settings.trip.end;
  }
  from = addDays(from, -2);
  to = addDays(to, 21); // margen para ver varias sesiones semanales
  return { from, to, days: diffDays(from, to) + 1 };
}
