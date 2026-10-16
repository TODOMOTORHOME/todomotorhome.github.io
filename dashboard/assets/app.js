(async function () {
  const J = f => fetch('data/' + f + '?v=' + Date.now()).then(r => r.ok ? r.json() : null).catch(() => null);
  const [meta, censo, ga, st, mj, manual, snaps, social] = await Promise.all(
    ['meta.json', 'censo.json', 'ga.json', 'sharetribe.json', 'mailjet.json', 'manual.json', 'snapshots.json', 'social.json'].map(J));
  const nf = new Intl.NumberFormat('es-AR');
  const fmt = n => n == null ? '—' : nf.format(Math.round(n));
  const iso = d => d.toISOString().slice(0, 10);
  const D = s => new Date(s + 'T00:00:00Z');
  const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const days = (a, b) => Math.round((D(b) - D(a)) / 864e5) + 1;
  const dmy = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—';

  document.getElementById('updated').textContent = 'Actualizado: ' + (meta ? meta.updated_label : '—');

  // ---- series helpers ----
  const series = (daily, key) => { const m = {}; (daily || []).forEach(d => m[d.date] = (m[d.date] || 0) + (d[key] || 0)); return m; };
  const sum = (m, a, b) => { let t = 0; for (const k in m) if (k >= a && k <= b) t += m[k]; return t; };
  const S = {
    censo: series(censo && censo.daily, 'new_users'),
    gaUsers: series(ga && ga.daily, 'users'), gaSess: series(ga && ga.daily, 'sessions'), gaNew: series(ga && ga.daily, 'new_users'), gaViews: series(ga && ga.daily, 'page_views'),
    stUsers: series(st && st.daily, 'users'), stList: series(st && st.daily, 'listings'), stInq: series(st && st.daily, 'inquiries'),
  };
  const firstDate = Object.values(S).flatMap(m => Object.keys(m)).sort()[0] || '2023-10-24';
  const today = meta ? meta.updated_at.slice(0, 10) : iso(new Date());
  const yesterday = addDays(today, -1);

  // ---- snapshot metrics (manual history + weekly snapshots) ----
  // social.json = exact Meta Graph API readings (Facebook page + Instagram), one per run
  function snapHistory(key, manualKey) {
    const h = {};
    (snaps || []).forEach(s => { if (s.metrics[key] != null) h[s.date] = { v: s.metrics[key] }; });
    if (social && manualKey) (social.history || []).forEach(x => { if (x[manualKey] != null) h[x.date] = { v: x[manualKey] }; });
    if (manual && manualKey && manual[manualKey]) (manual[manualKey].history || []).forEach(x => { if (x.value != null) h[x.date] = { v: x.value, r: x.rounded }; });
    return Object.keys(h).sort().map(d => ({ date: d, v: h[d].v, r: h[d].r }));
  }
  const atOrBefore = (hist, d) => { let r = null; hist.forEach(x => { if (x.date <= d) r = x; }); return r; };

  // ---- range state ----
  const startI = document.getElementById('start'), endI = document.getElementById('end');
  startI.min = endI.min = firstDate; startI.max = endI.max = today;
  const presets = [['7 días', 7], ['28 días', 28], ['90 días', 90], ['12 meses', 365], ['Este año', 'ytd'], ['Todo', 'all']];
  const pBox = document.getElementById('presets');
  function setPreset(p) {
    let s; const e = yesterday;
    if (p === 'ytd') s = today.slice(0, 4) + '-01-01'; else if (p === 'all') s = firstDate; else s = addDays(e, -(p - 1));
    startI.value = s; endI.value = e; render(p);
  }
  presets.forEach(([l, p]) => { const b = document.createElement('button'); b.textContent = l; b.dataset.p = p; b.onclick = () => setPreset(p); pBox.appendChild(b); });
  startI.onchange = endI.onchange = () => { if (startI.value > endI.value) [startI.value, endI.value] = [endI.value, startI.value]; render(null); };

  // ---- cards ----
  function delta(cur, prev, invert) {
    if (prev == null || cur == null) return '<span class="flat">sin dato anterior</span>';
    const d = cur - prev; const p = prev ? d / prev * 100 : null;
    const good = invert ? d < 0 : d > 0;
    const cls = d === 0 ? 'flat' : (good ? 'up' : 'down');
    const arrow = d === 0 ? '=' : (d > 0 ? '▲' : '▼');
    return `<span class="${cls}">${arrow} ${d > 0 ? '+' : ''}${fmt(d)}${p != null ? ` (${p > 0 ? '+' : ''}${p.toFixed(1).replace('.', ',')}%)` : ''}</span>`;
  }
  const card = (t, v, d, s, cls = '') => `<div class="card ${cls}"><div class="t">${t}</div><div class="v">${v}</div><div class="d">${d || ''}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  function flowCard(t, m, R, opts = {}) {
    const cur = sum(m, R.s, R.e), prev = sum(m, R.ps, R.pe);
    let s = opts.note || '';
    if (opts.total) {
      const tot = sum(m, '0000', R.e), totPrev = sum(m, '0000', R.pe);
      s = `Total acumulado al ${dmy(R.e)}: <b>${fmt(tot)}</b> ${delta(tot, totPrev)}` + (s ? '<br>' + s : '');
    }
    return card(t, fmt(cur), delta(cur, prev, opts.invert) + ' <span class="muted small">vs período anterior</span>', s);
  }
  function snapCard(t, key, manualKey, R, opts = {}) {
    const hist = snapHistory(key, manualKey);
    const cur = atOrBefore(hist, R.e >= yesterday ? today : R.e), prev = atOrBefore(hist, R.pe);
    if (!cur) return card(t, hist.length ? 'sin medición en el período' : 'pendiente de conexión', '', hist.length ? `Primera medición: ${dmy(hist[0].date)}` : (opts.note || ''), 'pending');
    const approx = cur.r ? ' <span class="muted small">(aprox.)</span>' : '';
    const d = prev && prev.date !== cur.date ? delta(cur.v, prev.v, opts.invert) + ` <span class="muted small">vs medición del ${dmy(prev.date)}</span>`
      : '<span class="flat">sin medición semanal anterior para comparar</span>';
    return card(t, fmt(cur.v) + approx, d, `Medición semanal del ${dmy(cur.date)}` + (opts.note ? '. ' + opts.note : ''));
  }

  // ---- charts ----
  const charts = {};
  function bucketKey(d, g) {
    if (g === 'day') return d;
    if (g === 'month') return d.slice(0, 7);
    const x = D(d); const wd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - wd); return iso(x);
  }
  function buckets(m, a, b, g) {
    const keys = [], vals = {};
    for (let d = a; d <= b; d = addDays(d, 1)) { const k = bucketKey(d, g); if (!(k in vals)) { keys.push(k); vals[k] = 0; } vals[k] += m[d] || 0; }
    return keys.map(k => ({ k, v: vals[k] }));
  }
  function lineChart(id, title, sets, R, where) {
    const n = days(R.s, R.e); const g = n <= 92 ? 'day' : n <= 730 ? 'week' : 'month';
    const gl = { day: 'diario', week: 'semanal', month: 'mensual' }[g];
    let box = document.getElementById(id);
    if (!box) { box = document.createElement('div'); box.className = 'chart'; box.id = id; box.innerHTML = '<canvas></canvas>'; document.getElementById(where).appendChild(box); }
    const ds = []; let labels = [];
    const colors = ['#1a73e8', '#e37400', '#188038'];
    sets.forEach(([label, m], i) => {
      const cur = buckets(m, R.s, R.e, g), prev = buckets(m, R.ps, R.pe, g);
      labels = cur.map(x => g === 'month' ? x.k.slice(5, 7) + '/' + x.k.slice(0, 4) : x.k.slice(8, 10) + '/' + x.k.slice(5, 7));
      ds.push({ label, data: cur.map(x => x.v), borderColor: colors[i], backgroundColor: colors[i], tension: .25, pointRadius: 0, borderWidth: 2 });
      ds.push({ label: label + ' (período anterior)', data: prev.slice(0, cur.length).map(x => x.v), borderColor: colors[i], borderDash: [5, 4], pointRadius: 0, borderWidth: 1.2, tension: .25 });
    });
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(box.querySelector('canvas'), {
      type: 'line', data: { labels, datasets: ds },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { title: { display: true, text: `${title} (${gl})` }, legend: { labels: { boxWidth: 12, font: { size: 11 } } } },
        scales: { y: { beginAtZero: true, ticks: { callback: v => nf.format(v) } } } }
    });
  }
  function snapChart(id, title, sets, where) {
    let box = document.getElementById(id);
    if (!box) { box = document.createElement('div'); box.className = 'chart'; box.id = id; box.innerHTML = '<canvas></canvas>'; document.getElementById(where).appendChild(box); }
    const dates = [...new Set(sets.flatMap(([, h]) => h.map(x => x.date)))].sort();
    const colors = ['#1a73e8', '#e37400', '#188038', '#a142f4'];
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(box.querySelector('canvas'), {
      type: 'line', data: { labels: dates.map(dmy), datasets: sets.map(([l, h], i) => ({ label: l, data: dates.map(d => { const x = h.find(y => y.date === d); return x ? x.v : null; }), borderColor: colors[i], backgroundColor: colors[i], spanGaps: true, pointRadius: 3 })) },
      options: { maintainAspectRatio: false, animation: false, plugins: { title: { display: true, text: title + ' (mediciones semanales; el historial se construye desde 16/10/2026)' } }, scales: { y: { ticks: { callback: v => nf.format(v) } } } }
    });
  }

  const socialNote = base => social && social.status === 'stale'
    ? base + '. <span class="down">⚠ La conexión con Meta falló en la última corrida; valor del ' + dmy(social.as_of) + '</span>' : base;

  // ---- render ----
  function render(preset) {
    [...pBox.children].forEach(b => b.classList.toggle('on', String(b.dataset.p) === String(preset)));
    const s = startI.value, e = endI.value, n = days(s, e);
    const R = { s, e, pe: addDays(s, -1), ps: addDays(s, -n) };
    document.getElementById('cmpLabel').textContent = `${dmy(s)} – ${dmy(e)} (${n} días) comparado con ${dmy(R.ps)} – ${dmy(R.pe)}`;

    // Section order: Sharetribe, Redes sociales, Censo Rodantero, Email (Mailjet), Google Analytics
    document.getElementById('cards-st').innerHTML =
      flowCard('Nuevos usuarios', S.stUsers, R, { total: true }) +
      flowCard('Nuevos anuncios', S.stList, R, { total: true, note: st ? `Hoy: ${fmt(st.totals.listings_by_state.published)} publicados · ${fmt(st.totals.listings_by_state.closed)} cerrados · ${fmt(st.totals.listings_by_state.draft)} borradores` : '' }) +
      flowCard('Consultas sin pago', S.stInq, R, { total: true, note: st ? `Transacciones totales: ${fmt(st.totals.transactions)}` : '' });
    lineChart('ch-st', 'Nuevos usuarios y anuncios', [['Usuarios', S.stUsers], ['Anuncios', S.stList]], R, 'charts-st');
    lineChart('ch-inq', 'Consultas sin pago', [['Consultas', S.stInq]], R, 'charts-st');

    document.getElementById('cards-social').innerHTML =
      snapCard('Seguidores página Facebook', 'fb_page_followers', 'facebook_page_followers', R, { note: socialNote('Dato exacto de Meta (Graph API)') }) +
      snapCard('Seguidores de Instagram', 'ig_followers', 'instagram_followers', R, { note: socialNote('Dato exacto de Meta (Graph API), @' + ((social && social.instagram_followers && social.instagram_followers.username) || 'todomotorhome.ar')) }) +
      snapCard('Miembros grupo de Facebook', 'fb_group_members', 'facebook_group_members', R, { note: 'Carga manual (vista de admin)' });
    snapChart('ch-social', 'Seguidores y miembros', [['Página Facebook', snapHistory('fb_page_followers', 'facebook_page_followers')], ['Instagram', snapHistory('ig_followers', 'instagram_followers')], ['Grupo Facebook', snapHistory('fb_group_members', 'facebook_group_members')]], 'charts-social');

    document.getElementById('cards-censo').innerHTML =
      flowCard('Nuevos registrados únicos', S.censo, R, { total: true, note: censo ? `Hoy: ${fmt(censo.totals.unique_users)} únicos por usuario · ${fmt(censo.totals.unique_emails)} por email · ${fmt(censo.totals.responses)} respuestas` : '' });
    lineChart('ch-censo', 'Nuevos registrados', [['Nuevos registrados', S.censo]], R, 'charts-censo');

    document.getElementById('cards-mj').innerHTML =
      snapCard('Contactos totales – Base de registrados', 'mj_total', null, R) +
      snapCard('Suscriptos', 'mj_subscribed', null, R) +
      snapCard('Desuscriptos', 'mj_unsubscribed', null, R, { invert: true }) +
      snapCard('Quejas por spam (acumulado)', 'mj_spam', null, R, { invert: true }) +
      snapCard('Bloqueados (acumulado)', 'mj_blocked', null, R, { invert: true });
    snapChart('ch-mj', 'Base de registrados', [['Suscriptos', snapHistory('mj_subscribed')], ['Desuscriptos', snapHistory('mj_unsubscribed')]], 'charts-mj');

    document.getElementById('cards-ga').innerHTML =
      flowCard('Visitas totales (páginas vistas)', S.gaViews, R) +
      flowCard('Sesiones', S.gaSess, R) +
      flowCard('Usuarios', S.gaUsers, R, { note: 'Suma de usuarios activos diarios (una persona que vuelve otro día cuenta de nuevo)' }) +
      flowCard('Usuarios nuevos', S.gaNew, R);
    lineChart('ch-ga', 'Visitas y sesiones', [['Visitas (páginas vistas)', S.gaViews], ['Sesiones', S.gaSess]], R, 'charts-ga');
  }

  // Mailjet table (current state of every list)
  if (mj) document.getElementById('mj-table').innerHTML = '<table><tr><th>Lista (estado actual)</th><th>Total</th><th>Suscriptos</th><th>Desuscriptos</th><th>Quejas spam*</th><th>Bloqueados*</th></tr>' +
    mj.lists.map(l => `<tr><td>${l.name}</td><td>${fmt(l.total)}</td><td>${fmt(l.subscribed)}</td><td>${fmt(l.unsubscribed)}</td><td>${fmt(l.spam_complaints)}</td><td>${fmt(l.blocked)}</td></tr>`).join('') +
    '</table><div class="muted small">* Eventos acumulados de todos los envíos a la lista. Los números de email son fotos semanales: la comparación usa la medición semanal más cercana anterior al período.</div>';

  document.getElementById('notes').innerHTML = [
    'Períodos en fecha de Argentina. La comparación es contra el período anterior de igual duración. Verde = mejora, rojo = empeora.',
    'Sharetribe, Censo y Google Analytics tienen historial diario completo. Email, redes y grupo de Facebook son mediciones semanales (historial desde 16/10/2026): se comparan con la medición más cercana anterior.',
    st ? 'Consultas sin pago: ' + st.inquiry_rule : '',
    'Sharetribe cuenta solo usuarios y anuncios que existen hoy (los eliminados no aparecen en la API).',
    meta && meta.errors && meta.errors.length ? '⚠ Fuentes no actualizadas en la última corrida: ' + meta.errors.join(', ') : ''
  ].filter(Boolean).map(x => '<div>' + x + '</div>').join('');

  setPreset(28);
})();
