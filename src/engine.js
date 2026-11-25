/* ===== Motor stránky: záložky, ovládání, grafy, výklad, kartičky ===== */
let tab = 'dc', RES = null, GHOST = null, cursor = null, timer = 0, plotSig = '', statusText = '', PL = [];
const S = {}, activePreset = {};
for (const k of TAB_ORDER) { const m = MODS[k]; if (m.def) { S[k] = { ...m.def }; if (m.autotune) Object.assign(S[k], m.autotune(S[k])); MODS[k].def = { ...S[k] }; activePreset[k] = m.presets[0].id; } }
let known = {};
try {
  const m = JSON.parse(localStorage.getItem('zpo-sim-3') || 'null');
  if (m) { for (const k in m.s || {}) if (S[k]) Object.assign(S[k], m.s[k]); Object.assign(activePreset, m.p || {}); known = m.k || {}; }
} catch (e) {}
const save = () => { try { localStorage.setItem('zpo-sim-3', JSON.stringify({ s: S, p: activePreset, k: known })); } catch (e) {} };
const mod = () => MODS[tab];

/* ---------- záložky ---------- */
$('#tabs').innerHTML = TAB_ORDER.map(k => `<a href="#${k}" id="tab-${k}" role="tab"><b>${MODS[k].label}</b><span>${/\d/.test(MODS[k].chap) ? 'kap. ' : ''}${MODS[k].chap}</span></a>`).join('');
function setTab(t) {
  tab = MODS[t] ? t : 'dc'; GHOST = null; cursor = null; plotSig = ''; RES = null;
  for (const k of TAB_ORDER) $('#tab-' + k).setAttribute('aria-selected', k === tab);
  { const n = $('#tabs'), a = $('#tab-' + tab); if (n.scrollWidth > n.clientWidth + 2) n.scrollLeft = a.offsetLeft - n.offsetLeft - n.clientWidth / 2 + a.offsetWidth / 2; }
  const m = mod(), hasSim = !!m.sim;
  $('#work').hidden = !hasSim; $('#theory').hidden = !hasSim; $('#presetsWrap').hidden = !hasSim;
  $('#unhold').hidden = true;
  renderDeriv(); renderCards();
  if (hasSim) { renderPresets(); renderCtl(); run(); }
  document.title = 'Simulátor pohonů ZPO';
}
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (MODS[h]) setTab(h); });

/* ---------- ovládací prvky ---------- */
const vis = (x, st) => (!x.m || x.m.split(' ').includes(st.mode)) && (!x.w || (() => { const [k, v] = x.w.split(':'); return v.split(' ').includes(String(st[k])); })());
function rowHTML(r, st) {
  const lab = sub(r.l || '');
  if (r.type === 'sel') return `<div class="row wide">${r.l ? `<label for="f-${r.id}">${lab}</label>` : ''}<select id="f-${r.id}" data-k="${r.id}" aria-label="${(r.l || r.id).replace(/_/g, '')}">${r.opts.map(([v, t]) => `<option value="${v}"${String(st[r.id]) === v ? ' selected' : ''}>${sub(t)}</option>`).join('')}</select></div>`;
  if (r.type === 'chk') return `<label class="chk"><input type="checkbox" id="f-${r.id}" data-k="${r.id}"${st[r.id] ? ' checked' : ''}><span>${lab}</span></label>`;
  return `<div class="row"><label for="f-${r.id}">${lab}</label><span class="inp"><input type="number" step="any" inputmode="decimal" id="f-${r.id}" data-k="${r.id}" value="${st[r.id]}"><span class="u">${r.u || ''}</span></span>${r.h ? `<small>${sub(r.h)}</small>` : ''}</div>`;
}
function renderCtl() {
  const st = S[tab], m = mod();
  $('#ctl').innerHTML = m.fields.filter(g => vis(g, st)).map(g =>
    `<fieldset><legend><span>${sub(g.g)}</span>${g.tunes ? `<span class="tunes">${g.tunes.map(([k, l]) => `<button type="button" class="tune" data-tune="${k}">${l}</button>`).join('')}</span>` : ''}</legend><div class="rows">${g.rows.filter(r => vis(r, st)).map(r => rowHTML(r, st)).join('')}</div>${g.der && m.derived ? '<div class="der" id="der"></div>' : ''}</fieldset>`).join('');
  renderDerived();
}
function renderDerived() {
  const el = $('#der'), m = mod(); if (!el || !m.derived) return;
  let items = []; try { items = m.derived(S[tab]); } catch (e) { items = []; }
  el.innerHTML = items.map(([a, b]) => `<span>${sub(a)} <b>${b}</b></span>`).join('');
}
function edited() { activePreset[tab] = null; renderPresets(); }
$('#ctl').addEventListener('input', e => {
  const el = e.target, k = el.dataset.k; if (!k || el.type !== 'number') return;
  const v = parseFloat(String(el.value).replace(',', '.')); if (!isFinite(v)) return;
  S[tab][k] = v; edited(); renderDerived(); schedule();
});
$('#ctl').addEventListener('change', e => {
  const el = e.target, k = el.dataset.k; if (!k || el.type === 'number') return;
  const st = S[tab], m = mod();
  st[k] = el.type === 'checkbox' ? (el.checked ? 1 : 0) : el.value;
  const re = m.onChange ? m.onChange(k, st) : 0;
  edited(); if (el.tagName === 'SELECT' || re) renderCtl(); schedule();
});
$('#ctl').addEventListener('click', e => {
  const b = e.target.closest('[data-tune]'); if (!b) return;
  const msg = mod().tune(b.dataset.tune, S[tab]);
  $('#warn').textContent = msg || ''; edited(); renderCtl(); if (!msg) schedule();
});

/* ---------- předvolby ---------- */
function renderPresets() { $('#presets').innerHTML = mod().presets.map(p => `<button type="button" data-p="${p.id}" aria-pressed="${activePreset[tab] === p.id}">${sub(p.n)}</button>`).join(''); }
function loadPreset(id, t) {
  t = t || tab; const m = MODS[t], p = m.presets.find(x => x.id === id); if (!p) return;
  const st = { ...m.def, ...p.s }; if (m.autotune && (p.retune || p.s.mode)) Object.assign(st, m.autotune(st));
  if (p.tune && m.tune) m.tune(p.tune, st); if (p.after) Object.assign(st, p.after);
  S[t] = st; activePreset[t] = id;
  if (t !== tab) { location.hash = t; return; }
  renderPresets(); renderCtl(); run();
}
$('#presets').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) loadPreset(b.dataset.p); });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-load]'); if (!b) return;
  const [t, id] = b.dataset.load.split(':'); loadPreset(id, t);
  setTimeout(() => $('#work').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 60);
});
$('#reset').addEventListener('click', () => { S[tab] = { ...mod().def }; activePreset[tab] = mod().presets[0].id; renderPresets(); renderCtl(); run(); });
$('#hold').addEventListener('click', () => { if (RES) { GHOST = RES; $('#unhold').hidden = false; drawAll(); } });
$('#unhold').addEventListener('click', () => { GHOST = null; $('#unhold').hidden = true; drawAll(); });

/* ---------- časové grafy ---------- */
const COL = { k: 'var(--ink)', r: 'var(--red)', b: 'var(--blu)', o: 'var(--och)', m: 'var(--mut)' };
const M = { l: 58, r: 12, t: 8, b: 22 };
function buildPlots() {
  const defs = mod().plots(S[tab], RES), sig = tab + S[tab].mode + defs.map(p => p.id + p.s.map(s => s.k).join()).join('|');
  if (sig === plotSig) { PL.forEach((p, i) => Object.assign(p, defs[i])); return; }
  plotSig = sig;
  $('#plots').innerHTML = defs.map(p => `<div class="ph"><h3>${sub(p.t)}<span>${p.u}</span></h3><ul class="lg" id="lg-${p.id}">${p.s.map(s => `<li><i class="${s.dash ? 'd' : ''}" style="--c:${COL[s.c]}"></i><span>${sub(s.l)}</span><b data-k="${s.k}"></b></li>`).join('')}${p.hlL ? `<li class="hl"><span>tečkovaně ${sub(p.hlL)}</span></li>` : ''}</ul></div><div class="fig" data-p="${p.id}"><svg id="pl-${p.id}" role="img" aria-label="${p.t}"></svg><div class="cur"></div></div>`).join('');
  PL = defs.map(p => ({ ...p, svg: $('#pl-' + p.id), cur: $(`[data-p="${p.id}"] .cur`), lg: $('#lg-' + p.id) }));
  for (const p of PL) {
    const fig = p.svg.parentNode;
    const mv = e => { if (!RES) return; const r = p.svg.getBoundingClientRect(), x = e.clientX - r.left, T = RES.t, t0 = T[0], te = lastOf(T); setCursor(bis(T, clamp(t0 + (x - M.l) / (r.width - M.l - M.r) * (te - t0), t0, te))); };
    fig.addEventListener('pointermove', mv); fig.addEventListener('pointerdown', mv); fig.addEventListener('pointerleave', () => setCursor(null));
  }
  plotRO.disconnect(); PL.forEach(p => plotRO.observe(p.svg)); plotRO.observe($('#xy'));
}
function path(T, Y, xs, ys) {
  let d = '', pen = false;
  for (let i = 0; i < T.length; i++) { const y = Y[i]; if (!isFinite(y) || !isFinite(T[i])) { pen = false; continue; } d += (pen ? 'L' : 'M') + xs(T[i]).toFixed(1) + ' ' + ys(y).toFixed(1); pen = true; }
  return d;
}
function drawPlot(p) {
  const s = p.svg, W = s.clientWidth, H = s.clientHeight; if (!W || !RES) return;
  const T = RES.t, t0 = T[0], te = lastOf(T) || 1, G = GHOST && GHOST.t ? GHOST : null, xu = mod().xuOf ? mod().xuOf(S[tab]) : (mod().xu || 's');
  let lo = Infinity, hi = -Infinity;
  const scan = (R, k) => { const a = R[k]; if (!a) return; for (const v of a) if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } };
  for (const se of p.s) { scan(RES, se.k); if (G) scan(G, se.k); }
  for (const v of (p.hl || [])) if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (hi - lo < 1e-9) { const a = Math.max(Math.abs(hi) * 0.1, 1e-3); hi += a; lo -= a; }
  const pad = (hi - lo) * 0.07; lo -= pad; hi += pad;
  const xs = t => M.l + (W - M.l - M.r) * (t - t0) / (te - t0), ys = v => M.t + (H - M.t - M.b) * (1 - (v - lo) / (hi - lo));
  const yt = ticks(lo, hi, H < 125 ? 3 : 4), xt = ticks(t0, te, W < 520 ? 4 : 8), ydec = Math.abs(yt[1] - yt[0]) < 0.1 ? 2 : Math.abs(yt[1] - yt[0]) < 1 ? 1 : 0, xdec = xt[1] - xt[0] < 0.1 ? 2 : xt[1] - xt[0] < 1 ? 1 : 0;
  let g = '';
  for (const v of yt) g += `<line x1="${M.l}" x2="${W - M.r}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--grid)"/><text x="${M.l - 6}" y="${ys(v) + 4}" text-anchor="end">${fmt(v, ydec)}</text>`;
  if (lo < 0 && hi > 0) g += `<line x1="${M.l}" x2="${W - M.r}" y1="${ys(0)}" y2="${ys(0)}" stroke="var(--mut)" stroke-width=".8"/>`;
  xt.forEach((v, i) => { g += `<text x="${xs(v)}" y="${H - 4}" text-anchor="middle">${fmt(v, xdec)}${i === xt.length - 1 && W > 400 ? ' ' + xu : ''}</text>`; });
  g += `<line x1="${M.l}" x2="${M.l}" y1="${M.t}" y2="${H - M.b}" stroke="var(--rule)"/>`;
  for (const v of (p.hl || [])) if (isFinite(v)) g += `<line x1="${M.l}" x2="${W - M.r}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--red)" stroke-dasharray="2 4"/>`;
  if (G) for (const se of p.s) if (G[se.k]) g += `<path d="${path(G.t, G[se.k], xs, ys)}" fill="none" stroke="var(--mut)" stroke-opacity=".5" stroke-width="1.4"/>`;
  for (const se of p.s.slice().reverse()) g += `<path d="${path(T, RES[se.k], xs, ys)}" fill="none" stroke="${COL[se.c]}" stroke-width="${se.k === 'ia' ? 1 : 1.8}"${se.dash ? ' stroke-dasharray="6 4"' : ''} stroke-linejoin="round"/>`;
  s.innerHTML = g; p.xs = xs;
}
function setCursor(i) {
  if (!RES) return;
  cursor = i; const idx = i == null ? RES.t.length - 1 : i, xu = mod().xuOf ? mod().xuOf(S[tab]) : (mod().xu || 's');
  for (const p of PL) {
    if (i == null) p.cur.style.display = 'none';
    else if (p.xs) { p.cur.style.display = 'block'; p.cur.style.left = p.xs(RES.t[i]) + 'px'; }
    for (const b of p.lg.querySelectorAll('b[data-k]')) { const se = p.s.find(x => x.k === b.dataset.k); b.textContent = se && RES[se.k] ? fmt(RES[se.k][idx], p.d) : ''; }
  }
  $('#status').textContent = i == null ? statusText : `${xu === '°' ? 'φ' : 't'} = ${fmt(RES.t[i], xu === 's' ? 3 : 1)} ${xu} · hodnoty v legendách platí pro tento okamžik`;
  drawXYmain();
}
const plotRO = new ResizeObserver(() => drawAll());
function drawAll() { if (!RES) return; PL.forEach(drawPlot); setCursor(cursor); }

/* ---------- obecný graf X–Y ---------- */
function drawXY(svg, sp) {
  const W = svg.clientWidth, H = svg.clientHeight; if (!W || !sp) return;
  const m = { l: 56, r: sp.y2 ? 50 : 14, t: 14, b: 34 }, lg = sp.logx;
  const allX = [], allY = [];
  for (const se of sp.series) for (const p of se.pts) { if (isFinite(p[0]) && isFinite(p[1])) { allX.push(p[0]); allY.push(p[1]); } }
  let [x0, x1] = sp.xr || rngOf([allX], 0.05); let [y0, y1] = sp.yr || rngOf([allY], 0.08);
  if (lg) { x0 = Math.log10(Math.min(...allX)); x1 = Math.log10(Math.max(...allX)); }
  if (x1 - x0 < 1e-9) { x1 += 1; x0 -= 1; } if (y1 - y0 < 1e-9) { y1 += 1; y0 -= 1; }
  const xs = v => m.l + (W - m.l - m.r) * ((lg ? Math.log10(v) : v) - x0) / (x1 - x0), ys = v => m.t + (H - m.t - m.b) * (1 - (v - y0) / (y1 - y0));
  let ys2 = null, y20 = 0, y21 = 1; if (sp.y2) { [y20, y21] = sp.y2.r; ys2 = v => m.t + (H - m.t - m.b) * (1 - (v - y20) / (y21 - y20)); }
  const cid = svg.id + 'c';
  let g = `<defs><clipPath id="${cid}"><rect x="${m.l}" y="${m.t}" width="${Math.max(0, W - m.l - m.r)}" height="${Math.max(0, H - m.t - m.b)}"/></clipPath></defs>`;
  const yt = ticks(y0, y1, 5), ydec = Math.abs(yt[1] - yt[0]) < 0.1 ? 2 : Math.abs(yt[1] - yt[0]) < 1 ? 1 : 0;
  for (const v of yt) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${ys(v)}" y2="${ys(v)}" stroke="var(--grid)"/><text x="${m.l - 6}" y="${ys(v) + 4}" text-anchor="end">${fmt(v, ydec)}</text>`;
  if (lg) { for (let d = Math.ceil(x0); d <= Math.floor(x1); d++) g += `<line x1="${xs(10 ** d)}" x2="${xs(10 ** d)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--grid)"/><text x="${xs(10 ** d)}" y="${H - m.b + 16}" text-anchor="middle">10${d < 0 ? '⁻' : ''}${String(Math.abs(d)).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')}</text>`; }
  else { const xt = ticks(x0, x1, W < 420 ? 4 : 6), xdec = Math.abs(xt[1] - xt[0]) < 0.1 ? 2 : Math.abs(xt[1] - xt[0]) < 1 ? 1 : 0; for (const v of xt) g += `<line x1="${xs(v)}" x2="${xs(v)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--grid)"/><text x="${xs(v)}" y="${H - m.b + 16}" text-anchor="middle">${fmt(v, xdec)}</text>`; }
  if (sp.y2) for (const v of ticks(y20, y21, 5)) g += `<text x="${W - m.r + 6}" y="${ys2(v) + 4}" style="fill:var(--red)">${fmt(v, 0)}</text>`;
  if (!lg && x0 < 0 && x1 > 0) g += `<line x1="${xs(0)}" x2="${xs(0)}" y1="${m.t}" y2="${H - m.b}" stroke="var(--mut)"/>`;
  if (y0 < 0 && y1 > 0) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${ys(0)}" y2="${ys(0)}" stroke="var(--mut)"/>`;
  const ssub = s => esc(s || '').replace(/_([A-Za-z0-9]+)/g, '<tspan baseline-shift="sub" font-size="10">$1</tspan>');
  g += `<text x="${W - m.r}" y="${H - 2}" text-anchor="end">${ssub(sp.xl)}</text><text x="${m.l + 4}" y="${m.t + 12}">${ssub(sp.yl)}</text>`;
  if (sp.y2) g += `<text x="${W - m.r - 4}" y="${m.t + 12}" text-anchor="end" style="fill:var(--red)">${esc(sp.y2.l)}</text>`;
  const pl = (pts, f) => { let d = '', pen = false; for (const p of pts) { if (!isFinite(p[0]) || !isFinite(p[1]) || (lg && p[0] <= 0)) { pen = false; continue; } d += (pen ? 'L' : 'M') + xs(p[0]).toFixed(1) + ' ' + f(p[1]).toFixed(1); pen = true; } return d; };
  g += `<g clip-path="url(#${cid})">`;
  const drawS = (se, f) => `<path d="${pl(se.pts, f)}" fill="none" stroke="${COL[se.c]}" stroke-width="${se.w || 1.5}"${se.dash ? ' stroke-dasharray="6 4"' : ''}${se.op ? ` stroke-opacity="${se.op}"` : ''} stroke-linejoin="round"/>`;
  if (sp.ghost) g += sp.ghost.map(se => drawS({ ...se, c: 'm', op: 0.5 }, ys)).join('');
  for (const se of sp.series) g += drawS(se, ys);
  if (sp.y2) for (const se of sp.y2.series) g += drawS(se, ys2);
  for (const d of (sp.dots || [])) if (isFinite(d.x) && isFinite(d.y)) g += `<circle cx="${xs(d.x)}" cy="${ys(d.y)}" r="${d.r || 5}" fill="${d.hollow ? 'var(--panel)' : COL[d.c]}" stroke="${d.hollow ? COL[d.c] : 'var(--panel)'}" stroke-width="2"/>`;
  g += '</g>';
  if (sp.quad && x0 < 0 && x1 > 0 && y0 < 0 && y1 > 0) { const q = (x, y, t, a) => `<text x="${x}" y="${y}" text-anchor="${a}" style="font-weight:600">${t}</text>`; g += q(W - m.r - 4, m.t + 14, 'I', 'end') + q(m.l + 30, m.t + 30, 'II', 'start') + q(m.l + 30, H - m.b - 8, 'III', 'start') + q(W - m.r - 4, H - m.b - 8, 'IV', 'end'); }
  svg.innerHTML = g;
}
function drawXYmain() {
  const m = mod(); if (!m.xy || !RES) return;
  const idx = cursor == null ? RES.t.length - 1 : cursor;
  let sp; try { sp = m.xy(S[tab], RES, idx); } catch (e) { sp = null; }
  if (!sp) return;
  if (GHOST && sp.series.length) { try { const gs = m.xy(S[tab], GHOST, GHOST.t.length - 1); sp.ghost = gs.series.filter(s => s.c === 'k'); } catch (e) {} }
  $('#xyt').innerHTML = sub(sp.title || m.xyTitle); $('#xyn').innerHTML = sub(sp.note != null ? sp.note : m.xyNote);
  drawXY($('#xy'), sp);
  $('#xyleg').innerHTML = (sp.leg || []).map(([c, l, d]) => `<li><i class="${d ? 'd' : ''}" style="--c:${COL[c]}"></i><span>${sub(l)}</span></li>`).join('') + (GHOST ? '<li><i style="--c:var(--mut)"></i><span>podržený běh</span></li>' : '');
}

/* ---------- výpočet ---------- */
function schedule() { clearTimeout(timer); timer = setTimeout(run, 220); save(); }
function run() {
  const m = mod(), st = S[tab]; if (!m.sim) return;
  const w = m.valid ? m.valid(st) : ''; $('#warn').textContent = w; if (w) return;
  const t0 = performance.now(); let R;
  try { R = m.sim(st); } catch (e) { $('#warn').textContent = 'Výpočet selhal: ' + e.message; return; }
  const ms = performance.now() - t0;
  const bad = R.bad || Object.keys(R).some(k => Array.isArray(R[k]) && R[k].length && !R[k].every(v => !(typeof v === 'number') || isNaN(v) || isFinite(v)));
  if (bad) $('#warn').textContent = 'Simulace se numericky rozkmitala. Zmenšete zesílení regulátorů nebo vraťte výchozí hodnoty.';
  RES = R; statusText = `Výpočet ${fmt(ms, 0)} ms · ${fmt(R.t.length, 0)} bodů${m.step ? ' · krok ' + m.step : ''}`;
  $('#status').textContent = statusText;
  cursor = null; buildPlots(); drawAll(); renderTiles(); $('#theory').innerHTML = '<div class="wrap">' + m.theory(st) + '</div>'; save();
}
function renderTiles() {
  let t = []; try { t = mod().tiles(S[tab], RES); } catch (e) { t = []; }
  $('#tiles').innerHTML = t.map(([a, b, c]) => `<div class="tile"><p>${sub(a)}</p><strong>${b}</strong><small>${sub(c || '')}</small></div>`).join('');
}

/* ---------- odvození (šablony + MathJax) ---------- */
let texTries = 0;
function typeset(el) {
  const MJ = window.MathJax;
  if (MJ && MJ.typesetPromise) { texTries = 0; (MJ.typesetClear ? (MJ.typesetClear([el]), 0) : 0); MJ.typesetPromise([el]).then(() => { el.classList.add('tex-ok'); }).catch(() => {}); }
  else if (texTries++ < 60) setTimeout(() => typeset(el), 250);
}
/* schémata: SVG z FIG, indexy x_y v textu na dolní index */
const figSub = s => s.replace(/>([^<]*)</g, (m0, t) => '>' + t.replace(/([A-Za-zΦΨψωΩδφϑμτξ0-9*′])_([A-Za-z0-9μσδβαρΦΩ]+)/g, '$1<tspan baseline-shift="sub" font-size="75%">$2</tspan>') + '<');
function figHTML(n) { if (!FIG[n]) return ''; const s = figSub(FIG[n]()), cap = (s.match(/aria-label="([^"]*)"/) || [])[1] || ''; return s + `<figcaption>${cap}</figcaption>`; }
function fillFigs(el) { el.querySelectorAll('[data-fig]').forEach(f => { try { f.innerHTML = figHTML(f.dataset.fig); } catch (e) { f.remove(); } }); }
/* viewBox podle skutečného obsahu, aby žádný popisek nebyl oříznutý */
function fitFigs(root) {
  const go = () => root.querySelectorAll('.sch svg').forEach(s => { try {
    if (!s.dataset.vb) s.dataset.vb = s.getAttribute('viewBox');
    const [x0, y0, w0, h0] = s.dataset.vb.split(' ').map(Number), b = s.getBBox(); if (!b.width) return;
    const x = Math.min(x0, b.x - 6), y = Math.min(y0, b.y - 4), w = Math.max(x0 + w0, b.x + b.width + 6) - x, h = Math.max(y0 + h0, b.y + b.height + 4) - y;
    s.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
  } catch (e) {} });
  requestAnimationFrame(go); if (document.fonts) document.fonts.ready.then(go);
}
function renderDeriv() {
  const m = mod(), el = $('#deriv');
  if (!m.tpl) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  const tpl = document.getElementById(m.tpl);
  el.innerHTML = ''; el.classList.remove('tex-ok');
  if (tpl) el.appendChild(tpl.content.cloneNode(true));
  fillFigs(el); fitFigs(el);
  if (m.after) try { m.after(el); } catch (e) {}
  typeset(el);
}

/* ---------- kartičky ---------- */
function cardHTML(c, i) {
  const [ch, q, a, link] = c, id = 'c' + i;
  return `<details class="qc${known[id] ? ' known' : ''}" data-id="${id}"><summary><span class="chn">kap. ${ch}</span>${sub(q)}</summary><div class="ans"><p>${sub(a)}</p><div class="qa">${link ? `<button type="button" class="btn" data-load="${link}">Ověřit v simulaci</button>` : ''}<label class="chk"><input type="checkbox" data-known="${id}"${known[id] ? ' checked' : ''}><span>Umím</span></label></div></div></details>`;
}
let opakCh = 'all', opakOrder = null;
function renderCards() {
  const m = mod(), el = $('#cards');
  if (tab === 'opak') {
    const list = (opakOrder || CARDS.map((_, i) => i)).filter(i => opakCh === 'all' || CARDS[i][0] === +opakCh);
    const nk = list.filter(i => known['c' + i]).length;
    el.innerHTML = `<div class="wrap"><h2>Opakování: otázky k ověření ze skript</h2><p class="lead">Klikněte na otázku, zkuste odpovědět nahlas a pak si odpověď ukažte. Zaškrtnuté „Umím“ si stránka pamatuje v tomto prohlížeči.</p>
<div class="cbar"><label for="opch">Kapitola</label><select id="opch"><option value="all">všechny (${CARDS.length})</option>${Object.entries(CH_NAMES).map(([k, v]) => `<option value="${k}"${opakCh === k ? ' selected' : ''}>${k}. ${v}</option>`).join('')}</select>
<button type="button" class="btn" id="opmix">Zamíchat</button><button type="button" class="btn" id="opopen">Rozbalit vše</button><button type="button" class="btn" id="opunk">Jen neumím</button><span class="st">Umím ${nk} z ${list.length}</span></div>
<div class="qgrid">${list.map(i => cardHTML(CARDS[i], i)).join('')}</div></div>`;
    return;
  }
  if (tab === 'stroje') { renderStroje(el); return; }
  if (tab === 'lab') { renderLab(el); return; }
  if (tab === 'faz' && typeof renderFaz === 'function') { renderFaz(el); return; }
  if (tab === 'pole') { renderPole(el); return; }
  if (tab === 'zk') { renderZk(el); return; }
  const list = CARDS.map((c, i) => [c, i]).filter(([c]) => m.ch.includes(c[0]));
  el.innerHTML = list.length ? `<div class="wrap"><h2>Otázky k ověření (kap. ${m.chap})</h2><div class="qgrid">${list.map(([c, i]) => cardHTML(c, i)).join('')}</div></div>` : '';
}
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.known;
  if (k) { known[k] = e.target.checked ? 1 : 0; e.target.closest('details').classList.toggle('known', e.target.checked); save(); if (tab === 'opak' || tab === 'stroje') { const st = $('.cbar .st'); if (st) { const n = [...document.querySelectorAll('#cards details')]; st.textContent = `Umím ${n.filter(d => d.classList.contains('known')).length} z ${n.length}`; } } }
  if (e.target.id === 'opch') { opakCh = e.target.value; renderCards(); }
});
document.addEventListener('click', e => {
  if (e.target.id === 'opmix') { const a = CARDS.map((_, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } opakOrder = a; renderCards(); }
  if (e.target.id === 'opopen') document.querySelectorAll('#cards details').forEach(d => d.open = true);
  if (e.target.id === 'opunk') document.querySelectorAll('#cards details.known').forEach(d => d.remove());
});


/* ---------- Elektrické stroje (Voženílek): otázky, příklady, obrázky ---------- */
let stView = 'q', stPart = 'all', stOrder = null;
const ST_GAL = [['kvadr', 1], ['dcsec', 2], ['dcconn', 2], ['dcekv', 2], ['komut', 2], ['reakce', 2], ['dynamo', 2], ['leonard', 2], ['ser', 2], ['trafo', 3], ['trafoph', 3], ['hodiny', 3], ['tocive', 4], ['amsec', 5], ['tsch', 5], ['mschar', 5], ['yd', 5], ['kruz', 5], ['smsec', 6], ['smph', 6], ['fazovani', 6], ['spec', 7]];
function stCardHTML(c, i, ex) {
  const id = (ex ? 'x' : 's') + i, link = ex ? c[3] : c[4];
  const head = ex ? `<span class="chn">${ST_PARTS[c[0]].split(' ')[0]} př.</span>${sub(c[1])}` : `<span class="chn">kap. ${c[1]}</span>${sub(c[2])}`;
  const sol = ex && typeof ST_SOL !== 'undefined' ? ST_SOL[i] : null;
  const body = ex ? (sol ? `<p class="solh">Postup řešení</p><ol class="sol">${sol.map(s => `<li>${sub(s)}</li>`).join('')}</ol>` : '') + `<p class="res">Výsledek (kniha): <b>${sub(c[2])}</b></p>` : `<p>${sub(c[3])}</p>`;
  return `<details class="qc${ex ? ' ex' : ''}${known[id] ? ' known' : ''}" data-id="${id}"><summary>${head}</summary><div class="ans">${body}<div class="qa">${link ? `<button type="button" class="btn" data-load="${link}">Ověřit v simulaci</button>` : ''}<label class="chk"><input type="checkbox" data-known="${id}"${known[id] ? ' checked' : ''}><span>Umím</span></label></div></div></details>`;
}
function renderStroje(el) {
  const src = stView === 'ex' ? ST_EX : ST_CARDS, ex = stView === 'ex';
  const seg = `<span class="seg" role="group" aria-label="Zobrazit">${[['q', 'Otázky (' + ST_CARDS.length + ')'], ['ex', 'Příklady (' + ST_EX.length + ')'], ['vs', 'Všetečné (' + ST_VS.length + ')'], ['fig', 'Průřezy a schémata']].map(([k, l]) => `<button type="button" data-stv="${k}" aria-pressed="${stView === k}">${l}</button>`).join('')}</span>`;
  const partSel = `<label for="stpart">Část</label><select id="stpart"><option value="all">všechny</option>${Object.entries(ST_PARTS).map(([k, v]) => `<option value="${k}"${stPart === k ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
  let body, bar;
  if (stView === 'vs') {
    const list = ST_VS.map((_, i) => i).filter(i => stPart === 'all' || ST_VS[i][0] === +stPart);
    bar = `<div class="cbar">${seg}${partSel}<button type="button" class="btn" id="stvs-open">${stvsOpen ? 'Sbalit vše' : 'Rozbalit vše'}</button><span class="st">${list.length} otázek</span></div>`;
    body = `<p class="lead">Záludné otázky, na kterých se u zkoušky ze strojů nejčastěji „pohoří“. Nejdřív odpovězte nahlas, pak rozbalte.</p>${stVsHTML(list)}`;
  } else if (stView === 'fig') {
    const g = ST_GAL.filter(([, p]) => stPart === 'all' || p === +stPart);
    bar = `<div class="cbar">${seg}${partSel}</div>`;
    body = g.length ? `<div class="figs">${g.map(([n]) => `<figure class="sch">${figHTML(n)}</figure>`).join('')}</div>` : '<p class="lead">Pro tuto část tu obrázek není; zkuste jinou část.</p>';
  } else {
    const list = (stOrder && stOrder.length === src.length ? stOrder : src.map((_, i) => i)).filter(i => stPart === 'all' || src[i][0] === +stPart);
    const nk = list.filter(i => known[(ex ? 'x' : 's') + i]).length;
    bar = `<div class="cbar">${seg}${partSel}<button type="button" class="btn" id="stmix">Zamíchat</button><button type="button" class="btn" id="opopen">Rozbalit vše</button><button type="button" class="btn" id="opunk">Jen neumím</button><span class="st">Umím ${nk} z ${list.length}</span></div>`;
    body = `<div class="qgrid">${list.map(i => stCardHTML(src[i], i, ex)).join('')}</div>`;
  }
  el.innerHTML = `<div class="wrap"><h2>Elektrické stroje: opakování</h2><p class="lead">Podle knihy Voženílek a kol., <i>Elektrické stroje</i> (ČVUT 1997). Otázky jsou přeformulované vlastními slovy podle kapitol, u příkladů je zadání zkrácené a výsledek převzatý z knihy. Obrázky jsou nové kresby, ne kopie z knihy.</p>${bar}${body}</div>`;
  if (stView === 'fig') fitFigs(el);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-stv]'); if (b) { stView = b.dataset.stv; stOrder = null; renderCards(); return; }
  if (e.target.id === 'stvs-open') { stvsOpen = !stvsOpen; renderCards(); return; }
  if (e.target.id === 'stmix') { const n = (stView === 'ex' ? ST_EX : ST_CARDS).length, a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } stOrder = a; renderCards(); }
});
document.addEventListener('change', e => { if (e.target.id === 'stpart') { stPart = e.target.value; renderCards(); } });

/* ---------- interaktivní transformace abc → αβ → dq ---------- */
function initTr(root) {
  const q = s => root.querySelector(s); if (!q('#tr-plane')) return;
  let playing = false, raf = 0, lastT = 0;
  const Im = 10;
  const draw = () => {
    if (!q('#tr-wt') || !document.body.contains(q('#tr-wt'))) return;
    const wt = +q('#tr-wt').value, mode = q('#tr-mode').value, dv = +q('#tr-d').value, K = +q('#tr-K').value;
    q('#tr-wtv').textContent = wt + '°'; q('#tr-dv').textContent = (dv < 0 ? '−' : '') + Math.abs(dv) + '°';
    q('#tr-drow').style.display = mode === 'ab' ? 'none' : '';
    const r = Math.PI / 180, x = wt * r;
    const ia = Im * Math.cos(x), ib = Im * Math.cos(x + 2 * Math.PI / 3), ic = Im * Math.cos(x - 2 * Math.PI / 3);
    const al = K * 1.5 * ia, be = K * Math.sqrt(3) / 2 * (ic - ib), th = mode === 'ab' ? 0 : mode === 'sync' ? wt + dv : dv;
    const c = Math.cos(th * r), s = Math.sin(th * r), id = al * c + be * s, iq = be * c - al * s;
    /* rovina */
    const sv = q('#tr-plane'), W = sv.clientWidth, H = sv.clientHeight; if (!W) return;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 26, k = R / 16;
    const P = (a, b) => [cx + a * k, cy - b * k];
    let g = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)"/></marker><marker id="ahr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--red)"/></marker></defs>`;
    g += `<circle cx="${cx}" cy="${cy}" r="${Math.hypot(al, be) * k}" fill="none" stroke="var(--grid)" stroke-width="2"/>`;
    for (const [nm, ang] of [['a', 0], ['b', -120], ['c', 120]]) { const e = P(15.5 * Math.cos(ang * r), 15.5 * Math.sin(ang * r)); g += `<line x1="${cx}" y1="${cy}" x2="${e[0]}" y2="${e[1]}" stroke="var(--mut)" stroke-dasharray="3 4"/><text x="${e[0] + (ang === 0 ? 4 : -4)}" y="${e[1] + (ang === 0 ? -6 : ang > 0 ? -6 : 16)}" text-anchor="${ang === 0 ? 'end' : 'middle'}">${nm}</text>`; }
    g += `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="var(--rule)"/><line x1="${cx}" y1="${cy + R}" x2="${cx}" y2="${cy - R}" stroke="var(--rule)"/><text x="${cx + R}" y="${cy + 16}" text-anchor="end">α</text><text x="${cx + 6}" y="${cy - R + 12}">β</text>`;
    const dE = P(15 * c, 15 * s), qE = P(-15 * s, 15 * c);
    if (mode !== 'ab') g += `<line x1="${cx}" y1="${cy}" x2="${dE[0]}" y2="${dE[1]}" stroke="var(--red)" stroke-width="1.5"/><line x1="${cx}" y1="${cy}" x2="${qE[0]}" y2="${qE[1]}" stroke="var(--red)" stroke-width="1.5"/><text x="${dE[0]}" y="${dE[1] - 6}" style="fill:var(--red);font-weight:600">d</text><text x="${qE[0]}" y="${qE[1] - 6}" style="fill:var(--red);font-weight:600">q</text>`;
    const v = P(al, be), pa = P(al, 0), pb = P(0, be), pd = P(id * c, id * s), pq = P(-iq * s, iq * c);
    g += `<line x1="${v[0]}" y1="${v[1]}" x2="${pa[0]}" y2="${pa[1]}" stroke="var(--blu)" stroke-dasharray="3 3"/><line x1="${v[0]}" y1="${v[1]}" x2="${pb[0]}" y2="${pb[1]}" stroke="var(--blu)" stroke-dasharray="3 3"/>`;
    if (mode !== 'ab') g += `<line x1="${v[0]}" y1="${v[1]}" x2="${pd[0]}" y2="${pd[1]}" stroke="var(--red)" stroke-dasharray="2 3"/><line x1="${v[0]}" y1="${v[1]}" x2="${pq[0]}" y2="${pq[1]}" stroke="var(--red)" stroke-dasharray="2 3"/>`;
    g += `<line x1="${cx}" y1="${cy}" x2="${pa[0]}" y2="${pa[1]}" stroke="var(--blu)" stroke-width="4"/><line x1="${cx}" y1="${cy}" x2="${pb[0]}" y2="${pb[1]}" stroke="var(--blu)" stroke-width="4"/>`;
    g += `<line x1="${cx}" y1="${cy}" x2="${v[0]}" y2="${v[1]}" stroke="var(--ink)" stroke-width="3" marker-end="url(#ah)"/><text x="${v[0] + 8}" y="${v[1] - 8}" style="font-weight:600;fill:var(--ink)">i</text>`;
    sv.innerHTML = g;
    /* průběhy */
    const st = q('#tr-time'), W2 = st.clientWidth, H2 = st.clientHeight;
    if (W2) {
      const m2 = { l: 34, r: 10, t: 10, b: 22 }, X = a => m2.l + (W2 - m2.l - m2.r) * a / 360, Y = v2 => m2.t + (H2 - m2.t - m2.b) * (1 - (v2 + 11) / 22);
      let h = `<line x1="${m2.l}" x2="${W2 - m2.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--mut)"/>`;
      for (const a of [0, 90, 180, 270, 360]) h += `<text x="${X(a)}" y="${H2 - 4}" text-anchor="middle">${a}°</text>`;
      for (const v2 of [-10, 10]) h += `<text x="${m2.l - 4}" y="${Y(v2) + 4}" text-anchor="end">${v2}</text>`;
      const cur = [[0, 'var(--ink)', 'a'], [2 * Math.PI / 3, 'var(--red)', 'b'], [-2 * Math.PI / 3, 'var(--blu)', 'c']];
      for (const [o, col, nm] of cur) { let d = ''; for (let a = 0; a <= 360; a += 4) d += (a ? 'L' : 'M') + X(a).toFixed(1) + ' ' + Y(Im * Math.cos(a * r + o)).toFixed(1); h += `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.8"/><circle cx="${X(wt)}" cy="${Y(Im * Math.cos(x + o))}" r="4.5" fill="${col}"/><text x="${X(wt) + 7}" y="${Y(Im * Math.cos(x + o)) + 4}" style="fill:${col};font-weight:600">i${nm}</text>`; }
      h += `<line x1="${X(wt)}" x2="${X(wt)}" y1="${m2.t}" y2="${H2 - m2.b}" stroke="var(--red)"/>`;
      st.innerHTML = h;
    }
    const f1 = v2 => fmt(v2, 2);
    q('#tr-num').innerHTML = `<table><tbody><tr><td>i<sub>a</sub>, i<sub>b</sub>, i<sub>c</sub></td><td>${f1(ia)}; ${f1(ib)}; ${f1(ic)} A</td></tr><tr><td>i<sub>α</sub> = K·3/2·i<sub>a</sub></td><td>${f1(al)} A</td></tr><tr><td>i<sub>β</sub> = K·√3/2·(i<sub>c</sub> − i<sub>b</sub>)</td><td>${f1(be)} A</td></tr><tr><td>|<b>i</b>| = K·3/2·I<sub>m</sub></td><td>${f1(Math.hypot(al, be))} A</td></tr><tr><td>ϑ<sub>k</sub></td><td>${fmt(((th % 360) + 360) % 360, 0)}°</td></tr><tr><td>i<sub>x</sub> = i<sub>α</sub>cos ϑ<sub>k</sub> + i<sub>β</sub>sin ϑ<sub>k</sub></td><td><b>${f1(id)} A</b></td></tr><tr><td>i<sub>y</sub> = i<sub>β</sub>cos ϑ<sub>k</sub> − i<sub>α</sub>sin ϑ<sub>k</sub></td><td><b>${f1(iq)} A</b></td></tr></tbody></table><p class="note">${mode === 'sync' ? 'Posuňte ωt: v synchronních osách zůstávají i<sub>x</sub>, i<sub>y</sub> konstantní.' : mode === 'ab' ? 'Ve statorových osách se i<sub>α</sub>, i<sub>β</sub> mění sinusově jako fázové proudy.' : 'Osy stojí natočené o ϑ<sub>k</sub>: složky se mění sinusově.'}</p>`;
  };
  ['#tr-wt', '#tr-mode', '#tr-d', '#tr-K'].forEach(s => q(s).addEventListener('input', draw));
  q('#tr-play').addEventListener('click', () => {
    playing = !playing; q('#tr-play').textContent = playing ? 'Zastavit' : 'Spustit otáčení';
    const step = ts => { if (!playing || !document.body.contains(root.firstElementChild)) return; if (lastT) { const v = (+q('#tr-wt').value + (ts - lastT) * 0.06) % 360; q('#tr-wt').value = v; draw(); } lastT = ts; raf = requestAnimationFrame(step); };
    lastT = 0; if (playing) raf = requestAnimationFrame(step); else cancelAnimationFrame(raf);
  });
  const ro = new ResizeObserver(draw); ro.observe(q('#tr-plane')); ro.observe(q('#tr-time'));
}

/* ---------- V-křivky synchronního motoru ---------- */
function drawVcurves(root) {
  const sv = root.querySelector('#vcurve'); if (!sv) return;
  const d = () => { const cs = smVcurves({ U: 1, Xd: 1, Xq: 1 }); drawXY(sv, { xl: 'U_i [p.j.] ~ I_f', yl: 'I [p.j.]', xr: [0, 3], yr: [0, 2.2], series: cs.map((c, i) => ({ pts: c.pts, c: ['k', 'r', 'b'][i], w: 2 })), dots: cs.map((c, i) => { const m = c.pts.reduce((a, p) => p[1] < a[1] ? p : a, [0, 9]); return { x: m[0], y: m[1], c: ['k', 'r', 'b'][i], r: 4 }; }) }); };
  new ResizeObserver(d).observe(sv);
}

/* ---------- start ---------- */
const h0 = location.hash.slice(1);
setTab(MODS[h0] ? h0 : 'dc');
