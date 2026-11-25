import {
  SECTIONS, TREATMENTS, PRODUCTS, defaultState, normalizeState,
  todayISO, addDays, diffDays, fmtShort, fmtLong, weekdayInitial, weekdayName, isISODate,
  itemsForDate, entryFor, dayScore, hasData, streak, treatmentStatus, dailyEnd,
  nextWeeklyDate, tripAlert, timelineRange, treatmentById,
} from './logic.js';

const KEY = 'salud-personal.v1';
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Estado ---------- */

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) {
    console.warn('No se pudo leer el estado guardado', e);
  }
  return defaultState();
}
let st = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch (e) {
    toast('No se pudo guardar (almacenamiento lleno o bloqueado)');
  }
}

// ?hoy=AAAA-MM-DD permite simular otra fecha para probar (no se guarda).
const override = new URLSearchParams(location.search).get('hoy');
const today = () => (isISODate(override) ? override : todayISO());

const ui = { tab: 'hoy', date: today() };

function entry(date) {
  if (!st.log[date]) st.log[date] = { done: {}, water: 0 };
  return st.log[date];
}
function tidy(date) {
  const e = st.log[date];
  if (e && !e.water && !Object.keys(e.done).length) delete st.log[date];
}

/* ---------- Utilidades UI ---------- */

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function heatClass(pct, data) {
  if (!data && pct === 0) return '';
  if (pct >= 100) return 'h5';
  if (pct >= 80) return 'h4';
  if (pct >= 60) return 'h3';
  if (pct >= 30) return 'h2';
  return 'h1';
}

/* ---------- Pantalla: Hoy ---------- */

function statusPill(it) {
  const s = it.status;
  if (!s) return '';
  if (s.phase === 'daily') return `<span class="pill">Día ${s.day} de ${s.total}</span>`;
  if (s.phase === 'weekly') return `<span class="pill">Semanal · ${s.session}ª</span>`;
  return '';
}

function taskRow(it, e) {
  const done = !!e.done[it.id];
  const hasExtra = it.missing || it.timer;
  const pill = statusPill(it);
  const cls = ['task', it.optional ? 'optional' : '', it.missing ? 'missing' : ''].join(' ');
  const note = it.missing ? 'Por comprar · no cuenta' : it.optional ? `${it.note || ''} · no cuenta en el %` : it.note;
  const btn = `
    <button class="${cls}" data-action="toggle" data-id="${it.id}" aria-pressed="${done}" ${it.missing ? 'disabled' : ''}>
      <span class="check">${CHECK_SVG}</span>
      <span class="t-body"><span class="t-name">${esc(it.name)}</span>${note ? `<span class="t-note">${esc(note.replace(/^ · /, ''))}</span>` : ''}${hasExtra && pill ? pill.replace('class="pill"', 'class="pill inline"') : ''}</span>
      ${hasExtra ? '' : pill}
    </button>`;
  const extra = it.missing
    ? `<button class="badge-buy" data-action="own" data-product="${it.product}">Ya lo tengo</button>`
    : it.timer ? `<button class="timer-btn" data-action="timer" aria-label="Temporizador de 3 minutos">⏱ 3 min</button>` : '';
  return extra ? `<div class="task-wrap">${btn}${extra}</div>` : btn;
}

function waterRow(date, e) {
  const goal = st.settings.waterGoal;
  const n = e.water || 0;
  const glasses = Array.from({ length: Math.max(goal, n) }, (_, i) => `<i class="glass ${i < n ? 'on' : ''}"></i>`).join('');
  return `
    <div class="water">
      <div class="t-body">
        <span class="t-name">Agua</span>
        <span class="t-note">${n} de ${goal} vasos${n >= goal ? ' · ¡meta cumplida!' : ''}</span>
        <div class="glasses" aria-hidden="true">${glasses}</div>
      </div>
      <div class="stepper">
        <button class="icon-btn" data-action="water" data-delta="-1" aria-label="Quitar un vaso" ${n <= 0 ? 'disabled' : ''}>−</button>
        <button class="icon-btn" data-action="water" data-delta="1" aria-label="Añadir un vaso" style="background:var(--accent);color:var(--accent-ink)">+</button>
      </div>
    </div>`;
}

function tripBanner() {
  const a = tripAlert(st, today());
  if (!a) return '';
  const name = esc(st.settings.trip.name || 'el viaje');
  const title = a.phase === 'before'
    ? `🧳 ${name} en ${a.daysLeft} ${a.daysLeft === 1 ? 'día' : 'días'}: mete en la maleta`
    : `✈️ De viaje en ${name}: lo que necesitas estos días`;
  const items = a.items.map((p) => `<li>${esc(p.name)}${p.missing ? ' <span class="tag">(por comprar)</span>' : ''}${p.optional ? ' <span class="tag">(si hace mucho sol)</span>' : ''}</li>`).join('');
  return `<section class="alert" role="note">
    <h2>${title}</h2>
    <div class="tag">${fmtShort(st.settings.trip.start)} – ${fmtShort(st.settings.trip.end)} · productos activos esas fechas</div>
    <ul>${items}</ul>
  </section>`;
}

function renderHoy() {
  const date = ui.date;
  const t = today();
  const isToday = date === t;
  const items = itemsForDate(date, st);
  const e = entryFor(st, date);
  const sc = dayScore(date, st);
  const C = 2 * Math.PI * 52;
  const off = C * (1 - sc.pct / 100);
  const relative = isToday ? 'Hoy' : date === addDays(t, -1) ? 'Ayer' : `Hace ${diffDays(date, t)} días`;

  let msg;
  if (sc.pct >= 100) msg = 'Todo hecho. ¡Buen trabajo!';
  else if (sc.pct >= 80) msg = 'Casi completo: el día cuenta para la racha.';
  else if (isToday) msg = 'Marca cada paso cuando lo hagas.';
  else msg = 'Puedes rellenar lo que olvidaste marcar.';

  const sections = SECTIONS.map((sec) => {
    const list = items.filter((i) => i.section === sec.id);
    let extra = '';
    if (sec.id === 'cuero') {
      const k = treatmentById('keomed');
      const s = treatmentStatus(k, date, st);
      if (s.state === 'rest') extra = `<div class="hint">Keomed en mantenimiento semanal · próximo: ${weekdayName(s.next)} ${fmtShort(s.next)}</div>`;
    }
    if (sec.id === 'habitos') {
      const rows = list.map((it) => taskRow(it, e)).join('') + waterRow(date, e);
      const doneCount = list.filter((i) => e.done[i.id]).length;
      return `<section class="card"><div class="card-head"><h2>${sec.icon} ${sec.name}</h2><span class="count">${doneCount}/${list.length}</span></div>${rows}</section>`;
    }
    if (!list.length && !extra) return '';
    const counted = list.filter((i) => i.counted);
    const doneCount = counted.filter((i) => e.done[i.id]).length;
    return `<section class="card">
      <div class="card-head"><h2>${sec.icon} ${sec.name}</h2>${counted.length ? `<span class="count">${doneCount}/${counted.length}</span>` : ''}</div>
      ${list.map((it) => taskRow(it, e)).join('')}${extra}
    </section>`;
  }).join('');

  return `
    <header class="page-head"><h1>Hoy</h1></header>
    <div class="daynav">
      <button class="icon-btn" data-action="day" data-delta="-1" aria-label="Día anterior">‹</button>
      <div class="label">
        <strong>${fmtLong(date)}</strong>
        ${isToday ? '<small>Hoy</small>' : `<button class="chip" data-action="today">${relative} · volver a hoy</button>`}
      </div>
      <button class="icon-btn" data-action="day" data-delta="1" aria-label="Día siguiente" ${isToday ? 'disabled' : ''}>›</button>
    </div>
    ${isToday ? tripBanner() : ''}
    <section class="card summary">
      <div class="ring" role="img" aria-label="${sc.pct}% completado">
        <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="52"/><circle class="bar" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>
        <div class="val">${sc.pct}<small>%</small></div>
      </div>
      <div class="summary-text">
        <strong>${Math.floor(sc.done)} de ${sc.total} hechos</strong>
        <p>${msg}</p>
      </div>
    </section>
    ${sections}`;
}

/* ---------- Pantalla: Etapas ---------- */

const COL = 30;
const LW = 108;

function renderEtapas() {
  const t = today();
  const r = timelineRange(st, t);
  const x = (d) => diffDays(r.from, d) * COL;
  const W = r.days * COL;
  const dayCells = [];
  for (let i = 0; i < r.days; i++) {
    const d = addDays(r.from, i);
    const dt = new Date(d.replace(/-/g, '/'));
    const wd = dt.getDay();
    const isFirst = dt.getDate() === 1 || i === 0;
    const m = dt.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    dayCells.push(`<div class="g-day ${wd === 0 || wd === 6 ? 'wkd' : ''} ${isFirst ? 'month' : ''}" data-m="${m}" style="left:${i * COL}px"><b>${dt.getDate()}</b>${weekdayInitial(d)}</div>`);
  }

  const rows = TREATMENTS.map((tr) => {
    const start = st.settings.starts[tr.id];
    const c = `var(--${tr.color})`;
    let inner = '';
    if (tr.kind === 'continuous') {
      const s = start < r.from ? r.from : start;
      const left = x(s);
      const width = W - left;
      const done = Math.max(0, Math.min(width, x(t) - left));
      inner = `<div class="g-bar fade" style="--c:${c};left:${left}px;width:${width}px"><div class="done" style="width:${done}px"></div></div>`;
    } else {
      const end = dailyEnd(tr, st);
      const left = x(start);
      const width = (diffDays(start, end) + 1) * COL;
      const done = Math.max(0, Math.min(width, x(t) - left));
      inner = `<div class="g-bar" style="--c:${c};left:${left}px;width:${width}px"><div class="done" style="width:${done}px"></div></div>`;
      if (tr.weekly) {
        for (let d = nextWeeklyDate(tr, st, addDays(end, 1)); diffDays(d, r.to) >= 0; d = addDays(d, 7)) {
          inner += `<i class="g-dot ${d < t ? 'past' : ''}" style="--c:${c};left:${x(d) + COL / 2 - 7}px" title="${fmtShort(d)}"></i>`;
        }
      }
    }
    return `<div class="g-row"><div class="g-label">${esc(tr.short)}</div><div class="g-track" style="width:${W}px">${inner}</div></div>`;
  }).join('');

  const trip = st.settings.trip;
  const band = trip.show && isISODate(trip.start) && isISODate(trip.end) && trip.end >= trip.start
    ? `<div class="g-band" style="left:${LW + x(trip.start)}px;width:${(diffDays(trip.start, trip.end) + 1) * COL}px"></div>`
    : '';
  const todayLine = `<div class="g-today" style="left:${LW + x(t) + COL / 2}px" aria-hidden="true"></div>`;

  const list = TREATMENTS.map((tr) => {
    const s = treatmentStatus(tr, t, st);
    const start = st.settings.starts[tr.id];
    let range, label, cls;
    if (tr.kind === 'continuous') {
      range = `Desde ${fmtShort(start)} · todos los días`;
    } else if (tr.weekly) {
      range = `${fmtShort(start)} – ${fmtShort(dailyEnd(tr, st))} diario · luego cada ${weekdayName(start)}`;
    } else {
      range = `${fmtShort(start)} – ${fmtShort(dailyEnd(tr, st))} · ${tr.days} días`;
    }
    if (s.state === 'pending') { label = `Empieza en ${s.startsIn} d`; cls = 'pending'; }
    else if (s.state === 'ended') { label = 'Terminado'; cls = 'ended'; }
    else if (s.phase === 'daily') { label = `Día ${s.day} de ${s.total}`; cls = 'active'; }
    else if (s.phase === 'weekly' || s.state === 'rest') { label = 'Semanal'; cls = 'active'; }
    else { label = `Día ${s.day}`; cls = 'active'; }
    return `<div class="t-row"><span class="swatch" style="--c:var(--${tr.color})"></span>
      <div class="t-body"><span class="t-name">${esc(tr.name)}</span><span class="t-note">${range}</span></div>
      <span class="status ${cls}">${label}</span></div>`;
  }).join('');

  return `
    <header class="page-head"><h1>Etapas</h1></header>
    ${tripBanner()}
    <section class="card gantt-card">
      <div class="card-head"><h2>Línea de tiempo</h2><button class="chip" data-action="scroll-today">Ir a hoy</button></div>
      <div class="gantt" id="gantt" style="--col:${COL}px;--lw:${LW}px">
        <div class="g-body" style="width:${LW + W}px">
          ${band}${todayLine}
          <div class="g-row head"><div class="g-label"></div><div class="g-track" style="width:${W}px">${dayCells.join('')}</div></div>
          ${rows}
          ${band ? `<div class="g-row trip"><div class="g-label">✈︎ ${esc(trip.name)}</div><div class="g-track" style="width:${W}px"></div></div>` : ''}
        </div>
      </div>
      <div class="legend">
        <span><i style="background:var(--teal)"></i>Hecho</span>
        <span><i style="background:color-mix(in srgb,var(--teal) 28%,transparent)"></i>Pendiente</span>
        <span><i style="background:var(--danger);width:3px"></i>Hoy</span>
        <span><i style="border:2px solid var(--blue);border-radius:50%"></i>Keomed semanal</span>
        ${trip.show ? '<span><i style="background:color-mix(in srgb,var(--amber) 30%,transparent)"></i>Viaje</span>' : ''}
      </div>
    </section>
    <section class="card tl-list">${list}</section>`;
}

function scrollGanttToToday(smooth) {
  const g = $('#gantt');
  if (!g) return;
  const r = timelineRange(st, today());
  const xToday = diffDays(r.from, today()) * COL;
  const visible = g.clientWidth - LW;
  g.scrollTo({ left: Math.max(0, xToday - visible * 0.3), behavior: smooth ? 'smooth' : 'auto' });
}

/* ---------- Pantalla: Historial ---------- */

function renderHistorial() {
  const t = today();
  const first = addDays(t, -20);
  // Alinear la cuadrícula por semanas (lunes primero).
  const lead = (new Date(first.replace(/-/g, '/')).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cell empty"></span>');
  let sum = 0;
  for (let i = 0; i < 21; i++) {
    const d = addDays(first, i);
    const { pct } = dayScore(d, st);
    const data = hasData(st, d);
    sum += pct;
    cells.push(`<button class="cell ${heatClass(pct, data)} ${d === t ? 'today' : ''}" data-action="goto" data-date="${d}" aria-label="${fmtLong(d)}: ${pct}%">
      ${new Date(d.replace(/-/g, '/')).getDate()}<small>${data || pct ? pct + '%' : '–'}</small></button>`);
  }
  const s = streak(st, t);
  const avg = Math.round(sum / 21);
  return `
    <header class="page-head"><h1>Historial</h1></header>
    <div class="stats">
      <div class="stat"><b>${s} 🔥</b><span>${s === 1 ? 'día seguido' : 'días seguidos'} ≥ 80 %</span></div>
      <div class="stat"><b>${avg}%</b><span>media últimos 21 días</span></div>
    </div>
    <section class="card">
      <div class="card-head"><h2>Últimos 21 días</h2><span class="count">${fmtShort(first)} – ${fmtShort(t)}</span></div>
      <div class="heat">
        ${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('')}
        ${cells.join('')}
      </div>
      <div class="heat-legend">0%
        <i style="background:var(--heat-1)"></i><i style="background:var(--heat-2)"></i><i style="background:var(--heat-3)"></i><i style="background:var(--heat-4)"></i><i style="background:var(--heat-5)"></i>100%
      </div>
    </section>
    <p class="muted center" style="font-size:14px">Toca un día para verlo o rellenarlo.</p>`;
}

/* ---------- Pantalla: Ajustes ---------- */

function switchHtml(name, checked, label) {
  return `<span class="switch"><input type="checkbox" role="switch" data-setting="${name}" ${checked ? 'checked' : ''} aria-label="${esc(label)}"><span></span></span>`;
}

function renderAjustes() {
  const s = st.settings;
  const startFields = TREATMENTS.map((tr) => `
    <div class="field">
      <label for="start-${tr.id}">${esc(tr.name)}<small>${tr.kind === 'continuous' ? 'Inicio de la rutina' : tr.weekly ? `${tr.days} días diario, luego semanal` : `${tr.days} días`}</small></label>
      <input type="date" id="start-${tr.id}" data-start="${tr.id}" value="${s.starts[tr.id]}" required>
    </div>`).join('');

  const products = Object.entries(PRODUCTS).map(([id, p]) => `
    <div class="field">
      <div class="lbl">${esc(p.name)}<small>${s.owned[id] ? `Lo tengo desde ${fmtShort(s.owned[id])}` : 'Por comprar · sale gris y no cuenta'}</small></div>
      ${switchHtml('owned:' + id, !!s.owned[id], `Ya tengo ${p.name}`)}
    </div>`).join('');

  const habits = st.habits.filter((h) => !h.removed).map((h) => `
    <div class="habit-row">
      <input type="text" value="${esc(h.name)}" data-habit="${h.id}" aria-label="Nombre del hábito" maxlength="60">
      <button class="icon-btn" data-action="del-habit" data-id="${h.id}" aria-label="Borrar ${esc(h.name)}" style="font-size:18px">🗑</button>
    </div>`).join('');

  return `
    <header class="page-head"><h1>Ajustes</h1></header>

    <h3 class="section-title">Fechas de inicio (día 1)</h3>
    <section class="card">${startFields}</section>

    <h3 class="section-title">Productos</h3>
    <section class="card">${products}</section>

    <h3 class="section-title">Agua</h3>
    <section class="card">
      <div class="field">
        <div class="lbl">Meta diaria<small>Vasos al día</small></div>
        <div class="stepper">
          <button class="icon-btn" data-action="goal" data-delta="-1" aria-label="Bajar meta" ${s.waterGoal <= 1 ? 'disabled' : ''}>−</button>
          <output>${s.waterGoal}</output>
          <button class="icon-btn" data-action="goal" data-delta="1" aria-label="Subir meta" ${s.waterGoal >= 30 ? 'disabled' : ''}>+</button>
        </div>
      </div>
    </section>

    <h3 class="section-title">Hábitos</h3>
    <section class="card">
      ${habits || '<p class="muted">Sin hábitos.</p>'}
      <form class="add-row" data-form="add-habit">
        <input type="text" name="name" placeholder="Nuevo hábito" maxlength="60" aria-label="Nuevo hábito">
        <button class="btn primary" type="submit">Añadir</button>
      </form>
    </section>

    <h3 class="section-title">Viaje</h3>
    <section class="card">
      <div class="field">
        <div class="lbl">Mostrar viaje<small>Franja en Etapas y aviso de maleta 4 días antes</small></div>
        ${switchHtml('trip-show', s.trip.show, 'Mostrar viaje')}
      </div>
      <div class="field"><input type="text" data-trip="name" value="${esc(s.trip.name)}" aria-label="Destino" maxlength="40"></div>
      <div class="trip-dates">
        <label>Ida<input type="date" data-trip="start" value="${s.trip.start}"></label>
        <label>Vuelta<input type="date" data-trip="end" value="${s.trip.end}"></label>
      </div>
    </section>

    <h3 class="section-title">Copia de seguridad</h3>
    <section class="card">
      <div class="backup">
        <button class="btn" data-action="export">⬇︎ Exportar</button>
        <button class="btn" data-action="import">⬆︎ Importar</button>
      </div>
      <p class="muted" style="font-size:13px;margin:10px 2px 0">Los datos se guardan solo en este dispositivo. Exporta de vez en cuando y guarda el archivo en iCloud Drive.</p>
    </section>
    <p class="foot">Mi tratamiento · funciona sin conexión</p>`;
}

/* ---------- Render ---------- */

const VIEWS = { hoy: renderHoy, etapas: renderEtapas, historial: renderHistorial, ajustes: renderAjustes };

function render() {
  $('#app').innerHTML = VIEWS[ui.tab]();
  document.querySelectorAll('.tab').forEach((b) => {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (ui.tab === 'etapas') scrollGanttToToday(false);
}

function go(tab) {
  ui.tab = tab;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Acciones ---------- */

document.querySelector('.tabbar').addEventListener('click', (ev) => {
  const b = ev.target.closest('.tab');
  if (b) go(b.dataset.tab);
});

$('#app').addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const date = ui.date;
  switch (a) {
    case 'toggle': {
      const e = entry(date);
      if (e.done[el.dataset.id]) delete e.done[el.dataset.id];
      else e.done[el.dataset.id] = true;
      tidy(date);
      save();
      render();
      break;
    }
    case 'water': {
      const e = entry(date);
      e.water = Math.max(0, Math.min(50, (e.water || 0) + Number(el.dataset.delta)));
      tidy(date);
      save();
      render();
      break;
    }
    case 'day': {
      const next = addDays(date, Number(el.dataset.delta));
      if (next > today()) return;
      ui.date = next;
      render();
      break;
    }
    case 'today':
      ui.date = today();
      render();
      break;
    case 'goto':
      ui.date = el.dataset.date;
      go('hoy');
      break;
    case 'own': {
      const p = PRODUCTS[el.dataset.product];
      if (!confirm(`¿Ya tienes ${p.name}? Empezará a contar en el %.`)) return;
      st.settings.owned[el.dataset.product] = date < today() ? date : today();
      save();
      render();
      toast(`${p.name} marcado como comprado`);
      break;
    }
    case 'timer':
      openTimer();
      break;
    case 'scroll-today':
      scrollGanttToToday(true);
      break;
    case 'goal':
      st.settings.waterGoal = Math.max(1, Math.min(30, st.settings.waterGoal + Number(el.dataset.delta)));
      save();
      render();
      break;
    case 'del-habit': {
      const h = st.habits.find((x) => x.id === el.dataset.id);
      if (!h || !confirm(`¿Borrar "${h.name}"? Los días pasados se conservan.`)) return;
      const used = Object.values(st.log).some((e) => e.done['h_' + h.id]);
      if (!used || diffDays(h.added, today()) <= 0) st.habits = st.habits.filter((x) => x !== h);
      else h.removed = today();
      save();
      render();
      toast('Hábito borrado');
      break;
    }
    case 'export':
      exportData();
      break;
    case 'import':
      $('#import-file').click();
      break;
  }
});

$('#app').addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.start) {
    if (!isISODate(el.value)) { el.value = st.settings.starts[el.dataset.start]; return; }
    st.settings.starts[el.dataset.start] = el.value;
    save();
    render();
    toast('Fechas recalculadas');
  } else if (el.dataset.setting?.startsWith('owned:')) {
    const id = el.dataset.setting.slice(6);
    st.settings.owned[id] = el.checked ? today() : null;
    save();
    render();
  } else if (el.dataset.setting === 'trip-show') {
    st.settings.trip.show = el.checked;
    save();
    render();
  } else if (el.dataset.trip) {
    const k = el.dataset.trip;
    if (k === 'name') st.settings.trip.name = el.value.trim() || 'Viaje';
    else if (isISODate(el.value)) st.settings.trip[k] = el.value;
    if (st.settings.trip.end < st.settings.trip.start) {
      if (k === 'start') st.settings.trip.end = st.settings.trip.start;
      else st.settings.trip.start = st.settings.trip.end;
    }
    save();
    render();
  } else if (el.dataset.habit) {
    const h = st.habits.find((x) => x.id === el.dataset.habit);
    const name = el.value.trim();
    if (h && name) { h.name = name; save(); toast('Hábito renombrado'); }
    else if (h) el.value = h.name;
  }
});

$('#app').addEventListener('submit', (ev) => {
  const form = ev.target;
  if (form.dataset.form !== 'add-habit') return;
  ev.preventDefault();
  const name = form.elements.name.value.trim();
  if (!name) return;
  st.habits.push({ id: 'h' + Date.now().toString(36), name, added: today(), removed: null });
  save();
  render();
  toast(`"${name}" añadido`);
});

/* ---------- Exportar / importar ---------- */

async function exportData() {
  const json = JSON.stringify({ app: 'salud-personal', exportedAt: new Date().toISOString(), ...st }, null, 2);
  const name = `tratamiento-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Copia de seguridad' });
      return;
    }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Copia exportada');
}

$('#import-file').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  try {
    const data = normalizeState(JSON.parse(await f.text()));
    const days = Object.keys(data.log).length;
    if (!confirm(`Importar copia con ${days} días registrados. Esto reemplaza los datos actuales. ¿Continuar?`)) return;
    st = data;
    save();
    ui.date = today();
    render();
    toast('Copia importada');
  } catch (e) {
    alert('No se pudo importar: ' + (e.message || 'archivo no válido'));
  }
});

/* ---------- Temporizador 3 min ---------- */

const TIMER_SECS = 180;
const tm = { left: TIMER_SECS, endAt: 0, running: false, iv: 0, audio: null, lock: null };
const dlg = $('#timer');
const RC = 2 * Math.PI * 52;
$('.timer-ring .bar').setAttribute('stroke-dasharray', RC);

function timerPaint() {
  const s = Math.ceil(tm.left);
  $('#timer-left').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('.timer-ring .bar').setAttribute('stroke-dashoffset', tm.left <= 0 ? 0 : RC * (1 - tm.left / TIMER_SECS));
  $('#timer-toggle').textContent = tm.running ? 'Pausa' : tm.left < TIMER_SECS && tm.left > 0 ? 'Seguir' : tm.left <= 0 ? 'Otra vez' : 'Empezar';
}
function beep() {
  try {
    const ctx = tm.audio;
    if (!ctx) return;
    [0, 0.45, 0.9].forEach((t0) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t0);
      o.stop(ctx.currentTime + t0 + 0.4);
    });
  } catch { /* sin audio */ }
}
async function wake(on) {
  try {
    if (on && 'wakeLock' in navigator) tm.lock = await navigator.wakeLock.request('screen');
    else if (!on && tm.lock) { await tm.lock.release(); tm.lock = null; }
  } catch { /* opcional */ }
}
function timerTick() {
  tm.left = Math.max(0, (tm.endAt - Date.now()) / 1000);
  if (tm.left <= 0) {
    clearInterval(tm.iv);
    tm.running = false;
    dlg.classList.add('finished');
    $('#timer-msg').textContent = '¡Listo! Ya puedes aclarar el champú.';
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    beep();
    wake(false);
  }
  timerPaint();
}
function openTimer() {
  if (!tm.running && tm.left <= 0) tm.left = TIMER_SECS;
  dlg.classList.remove('finished');
  timerPaint();
  dlg.showModal();
}
$('#timer-toggle').addEventListener('click', () => {
  if (!tm.audio) {
    try { tm.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* */ }
  }
  tm.audio?.resume?.();
  if (tm.running) {
    clearInterval(tm.iv);
    tm.running = false;
    tm.left = Math.max(0, (tm.endAt - Date.now()) / 1000);
    $('#timer-msg').textContent = 'En pausa.';
    wake(false);
  } else {
    if (tm.left <= 0) tm.left = TIMER_SECS;
    dlg.classList.remove('finished');
    tm.endAt = Date.now() + tm.left * 1000;
    tm.running = true;
    tm.iv = setInterval(timerTick, 250);
    $('#timer-msg').textContent = 'Deja actuar el champú en el cuero cabelludo.';
    wake(true);
  }
  timerPaint();
});
$('#timer-reset').addEventListener('click', () => {
  clearInterval(tm.iv);
  tm.running = false;
  tm.left = TIMER_SECS;
  dlg.classList.remove('finished');
  $('#timer-msg').textContent = 'Aplica el champú y pulsa Empezar.';
  wake(false);
  timerPaint();
});
$('#timer-close').addEventListener('click', () => dlg.close());

/* ---------- Ciclo de vida ---------- */

let lastToday = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (tm.running) timerTick();
  const t = today();
  if (t !== lastToday) {
    if (ui.date === lastToday) ui.date = t; // pasó la medianoche con la app abierta
    lastToday = t;
    render();
  }
});

render();

// En modo prueba (?hoy=...) no se registra el service worker para no servir archivos en caché.
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !override) {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
}
