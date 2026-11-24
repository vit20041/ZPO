/* ===== Laboratoř: osciloskop, tok výkonu, srovnání se statickým výpočtem, odkazy na teorii ===== */
const OSC_DT = 1e-4, OSC_N = 12000;
const OSC = { win: 0.04, ch: { a: true, b: true, c: true, r: true, u: true }, trig: true };
function oscPush(r) {
  const o = L.osc, i = o.i; let a = NaN, b = NaN, c = NaN, rr = NaN, u = NaN;
  if (L.m === 'am') {
    a = r.ia; b = -0.5 * r.ia + SQ3 / 2 * r.ib; c = -a - b;
    const th = L.P.pp * L.thv; rr = r.ra * Math.cos(th) + r.rb * Math.sin(th); u = r.ua;
  } else if (L.m === 'dc') { a = r.i; u = r.u; b = r.if; }
  else {
    const S = L.gen ? G_SM : LAB_SM, th = L.P.pp * L.fang; u = Math.SQRT2 * Math.cos(th);
    if (S.on) { const v = smCurV(L.P, r.b, r.Ui), A = Math.SQRT2 * v.I; a = A * Math.cos(th + v.arg); b = A * Math.cos(th + v.arg - TAU / 3); c = A * Math.cos(th + v.arg + TAU / 3); }
    else { a = b = c = 0; }
  }
  o.t[i] = L.t; o.a[i] = a; o.b[i] = b; o.c[i] = c; o.r[i] = rr; o.u[i] = u;
  o.i = (i + 1) % OSC_N; o.n = Math.min(OSC_N, o.n + 1);
}
/* stejný rozběh spočítaný jen ze statické (ustálené) momentové charakteristiky */
let LQP = null;
function labStatic(dt) {
  const P = L.P, Rp = LAB_AM.Rp; if (!LQP || LQP.Rp !== Rp || LQP.P !== P) LQP = { Rp, P, Q: { ...P, R2: P.R2 + Rp } };
  const W = L.qW, Mz0 = LAB.load / 100 * L.MN; let M = 0;
  if (L.uamp > 1 && Math.abs(L.f) > 0.3) { const sg = Math.sign(L.f), Wsa = TAU * Math.abs(L.f) / P.pp, sl = (Wsa - sg * W) / Wsa; M = Math.abs(sl) < 1e-9 ? 0 : sg * imSteady(LQP.Q, L.d, L.uamp, Math.abs(L.f), sl).M; }
  let Mz = labMz(W); if (Mz === null) Mz = passive(M, W, Mz0);
  const Wn = W + dt * (M - Mz - P.B * W) / P.J;
  L.qW = (LAB.lt === 'react' && Mz0 && Math.sign(Wn) !== Math.sign(W) && W !== 0 && Math.abs(M) < Mz0) ? 0 : Wn;
}
/* tok výkonu: řádky vodopádu; v > 0 ve větvi „ztráta“ = výkon odchází */
function labFlow(r, W, dW) {
  const g = L.gen, F = [];
  const node = (t, v) => F.push({ t, v }), loss = (t, v) => F.push({ t, v, l: 1 });
  if (L.m === 'am') {
    const P = L.P, Pin = r.p || 0, Pc1 = 1.5 * r.R1 * (r.ia * r.ia + r.ib * r.ib), Pc2 = 1.5 * r.R2 * (r.ra * r.ra + r.rb * r.rb), Pm = r.M * W, res = Pin - Pc1 - Pc2 - Pm, Pa = P.J * W * dW;
    if (!g) { node('Příkon ze sítě P_1', Pin); loss('Ztráty ve vinutí statoru 3R_1I_1²', Pc1); loss('Změna energie magnetického pole', res); node('Výkon ve vzduchové mezeře P_δ', Pin - Pc1 - res); loss('Ztráty v rotoru 3R_2′I_2′² = s·P_δ', Pc2); node('Mechanický výkon M·Ω', Pm); loss('Do setrvačnosti J·Ω·dΩ/dt', Pa); node('Do zátěže M_z·Ω', Pm - Pa); }
    else { const p = primeMover(W), Pt = p.Mp * W, Pv = p.loss * W; node('Výkon turbíny', Pt); loss('Ventilační a třecí ztráty', Pv); loss('Do setrvačnosti J·Ω·dΩ/dt', Pa); node('Výkon na hřídeli', -Pm); loss('Ztráty v rotoru 3R_2′I_2′²', Pc2); loss('Ztráty ve vinutí statoru 3R_1I_1²', Pc1); loss('Změna energie magnetického pole', res); node('Do sítě −P_1', -Pin); }
    L.flowU = ['kW', 1e-3];
  } else if (L.m === 'dc') {
    const P = L.P, i = r.i, Pm = r.M * W, Pa = P.J * W * dW;
    if (!g) { const Rp = LAB_DC.mode === 'reg' ? 0 : LAB_DC.Rp, Pin = (r.u + Rp * i) * i, Pr = Rp * i * i, Pa2 = P.Rd * i * i, res = Pin - Pr - Pa2 - Pm;
      node('Výkon ze zdroje U·I', Pin); loss('Předřadný odpor R_p·I²', Pr); loss('Ztráty v kotvě R_a·I²', Pa2); loss('Změna energie v indukčnosti kotvy', res); node('Vnitřní výkon U_i·I = M·Ω', Pm); loss('Do setrvačnosti J·Ω·dΩ/dt', Pa); node('Do zátěže M_z·Ω', Pm - Pa); }
    else { const p = primeMover(W), Pt = p.Mp * W, Pv = p.loss * W, Pi = -Pm, Pa2 = P.Rd * i * i, Pout = r.u * i, res = Pi - Pa2 - Pout;
      node('Výkon pohonu', Pt); loss('Ventilační a třecí ztráty', Pv); loss('Do setrvačnosti J·Ω·dΩ/dt', Pa); node('Vnitřní výkon U_i·I', Pi); loss('Ztráty v kotvě R_a·I²', Pa2); loss('Změna energie v indukčnosti', res); node('Do zátěže U·I', Pout); }
    L.flowU = ['kW', 1e-3];
  } else {
    const S = g ? G_SM : LAB_SM, nu = L.nu, Pm = r.M * nu, Pel = S.on ? r.c.P : 0, res = Pel - Pm;   /* p.j., P_el odebírané */
    const Pa1 = L.P.TN * nu * dW / L.ws;
    if (!g) { node('Příkon ze sítě P', Pel); loss('Tlumič a kývání rotoru', res); node('Mechanický výkon M·Ω', Pm); loss('Do setrvačnosti', Pa1); node('Do zátěže', Pm - Pa1); }
    else { const p = primeMover(nu * L.ws), Pt = p.Mp * nu, Pv = p.loss * nu; node('Výkon turbíny', Pt); loss('Ventilační a třecí ztráty', Pv); loss('Do setrvačnosti', Pa1); node('Výkon na hřídeli', -Pm); loss('Tlumič a kývání rotoru', -Pm + Pel); node('Do sítě P', -Pel); }
    L.flowU = ['p.j.', 1];
  }
  L.flow = F;
}
function flowSVG(F, [u, k]) {
  const W = 460, x0 = 8, x1 = 360, rh = 36, H = F.length * rh + 8;
  let cum = 0; const rows = [];
  for (const f of F) { if (!f.l) { cum = f.v; rows.push({ ...f, a: 0, b: f.v }); } else { rows.push({ ...f, a: cum - f.v, b: cum }); cum -= f.v; } }
  const vals = rows.flatMap(r => [r.a, r.b]).concat([0]), lo = Math.min(...vals), hi = Math.max(...vals), sp = Math.max(hi - lo, 1e-9);
  const X = v => x0 + (x1 - x0) * (v - lo) / sp;
  let g = `<line x1="${X(0).toFixed(1)}" x2="${X(0).toFixed(1)}" y1="18" y2="${H - 4}" class="max"/>`;
  rows.forEach((r, i) => {
    const y = 4 + i * rh, a = Math.min(X(r.a), X(r.b)), w = Math.max(1, Math.abs(X(r.b) - X(r.a))), c = !r.l ? 'fnode' : r.v >= 0 ? 'floss' : 'fgain';
    g += `<text x="${x0}" y="${y + 12}" class="${r.l ? 'ftl' : 'ftn'}">${lsub(r.l ? (r.v >= 0 ? '− ' : '+ ') + r.t : r.t)}</text><rect x="${a.toFixed(1)}" y="${y + 17}" width="${w.toFixed(1)}" height="13" rx="2" class="${c}"/>`;
    g += `<text x="${W - 4}" y="${y + 28}" text-anchor="end" class="ftv">${fmt(Math.abs(r.v) * k, k === 1 ? 2 : 1)} ${u}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="mini flow" role="img" aria-label="Tok výkonu">${g}</svg>`;
}
function oscHTML() {
  const m = L.m, chs = m === 'am' ? [['u', 'napětí fáze a'], ['a', 'proud fáze a'], ['b', 'fáze b'], ['c', 'fáze c'], ['r', 'proud rotoru (fáze a)']] : m === 'dc' ? [['u', 'napětí kotvy'], ['a', 'proud kotvy'], ['b', 'budicí proud']] : [['u', 'napětí fáze a'], ['a', 'proud fáze a'], ['b', 'fáze b'], ['c', 'fáze c']];
  return `<div class="lrow osct"><label>Časová základna<select id="osc-w">${[[0.04, '40 ms'], [0.1, '100 ms'], [0.4, '400 ms'], [1.2, '1,2 s']].map(([v, t]) => `<option value="${v}"${v === OSC.win ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label class="chk"><input type="checkbox" id="osc-tr"${OSC.trig ? ' checked' : ''}> spouštění od napětí fáze a</label></div>
<div class="lrow osct">${chs.map(([k, t]) => `<label class="chk osc-${k}"><input type="checkbox" data-osc="${k}"${OSC.ch[k] ? ' checked' : ''}> ${t}</label>`).join('')}</div>
<canvas id="osc-cv" class="osccv" aria-label="Osciloskop: okamžité hodnoty proudů a napětí"></canvas>`;
}
function oscDraw() {
  const cv = $('#osc-cv'); if (!cv || !L.osc) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1; if (!W) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d'), col = labColors(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const o = L.osc, N = o.n, st = (o.i - N + OSC_N) % OSC_N, at = j => (st + j) % OSC_N;
  if (N < 3) return;
  let end = N - 1;
  if (OSC.trig && L.m !== 'dc') {                                         /* poslední průchod u_a nulou nahoru */
    const need = Math.round(OSC.win / OSC_DT);
    for (let j = N - 1; j > need; j--) if (o.u[at(j - 1)] < 0 && o.u[at(j)] >= 0) { end = j; break; }
  }
  const tE = o.t[at(end)], t0 = tE - OSC.win, keys = Object.keys(OSC.ch).filter(k => OSC.ch[k]);
  /* měřítka: proudy společně, napětí zvlášť */
  let mi = 1e-9, mu = 1e-9, mf = 1e-9;
  for (let j = 0; j <= end; j++) { const i = at(j); if (o.t[i] < t0) continue; for (const k of ['a', 'b', 'c', 'r']) if (L.m === 'dc' && k === 'b') { if (isFinite(o.b[i])) mf = Math.max(mf, Math.abs(o.b[i])); } else if (isFinite(o[k][i])) mi = Math.max(mi, Math.abs(o[k][i])); if (isFinite(o.u[i])) mu = Math.max(mu, Math.abs(o.u[i])); }
  const pad = 8, X = t => pad + (W - 2 * pad) * (t - t0) / OSC.win, Ym = H / 2, A = H / 2 - 14;
  c.strokeStyle = col.rule; c.lineWidth = 1; c.beginPath();
  for (let k = 0; k <= 10; k++) { const x = pad + (W - 2 * pad) * k / 10; c.moveTo(x, 6); c.lineTo(x, H - 6); }
  c.moveTo(pad, Ym); c.lineTo(W - pad, Ym); c.stroke();
  const colr = { u: col.mut, a: col.red, b: col.och, c: col.blu, r: col.grn || '#2a8a4a' };
  for (const k of keys) {
    const sc = k === 'u' ? mu : (L.m === 'dc' && k === 'b') ? mf : mi; c.strokeStyle = colr[k]; c.lineWidth = k === 'u' ? 1.4 : 2; c.setLineDash(k === 'u' ? [5, 4] : k === 'r' ? [2, 2] : []);
    c.beginPath(); let first = true;
    for (let j = 0; j <= end; j++) { const i = at(j); if (o.t[i] < t0) continue; const v = o[k][i]; if (!isFinite(v)) { first = true; continue; } const x = X(o.t[i]), y = Ym - A * v / sc; if (first) c.moveTo(x, y); else c.lineTo(x, y); first = false; }
    c.stroke();
  }
  c.setLineDash([]); c.fillStyle = col.mut; c.font = '12px Inter, sans-serif';
  const un = L.m === 'sm' ? 'p.j.' : 'A';
  c.fillText(`${fmt(OSC.win * 100, OSC.win < 0.1 ? 1 : 0)} ms/díl · proudy ±${fmt(mi, mi < 10 ? 2 : 0)} ${un}` + (L.m === 'dc' ? ` · i_f ±${fmt(mf, 2)} A` : '') + ` · napětí ±${fmt(mu, L.m === 'sm' ? 2 : 0)} ${L.m === 'sm' ? 'p.j.' : 'V'}`, pad + 2, H - 4);
}
function oscNote() {
  return L.m === 'am' ? 'Okamžité proudy fází statoru a proud fáze a rotoru tak, jak ho „vidí“ rotor: má kmitočet s·f. Při rozběhu je vidět stejnosměrná složka v proudech hned po zapnutí a postupné zpomalování rotorového proudu až na několik Hz.'
    : L.m === 'dc' ? 'Proud a napětí kotvy a budicí proud. U stejnosměrného stroje jsou to „hladké“ průběhy; střídavý proud teče jen v cívkách kotvy a komutátor ho usměrňuje (viz pohled dovnitř).'
      : 'Proudy jsou sestavené z fázoru (model synchronního stroje je fázorový), ukazují tedy amplitudu a fázový posun proudu vůči napětí sítě; φ > 0 vpravo = proud se zpožďuje.';
}
/* ---------- propojení scénářů s teorií a otázkami ---------- */
const SCN_REF = {
  'am-dol': ['v6', 'v2', 'zk-am'], 'am-yd': ['v6', 'zk-am'], 'am-rp': ['v6', 'zk-am'], 'am-plug': ['v6', 'v2', 'zk-am'], 'am-dcb': ['v6', 'zk-am'], 'am-over': ['v6', 'zk-am'], 'am-uf': ['v6', 'v8', 'zk-am'],
  'dc-rp': ['v3', 'v2', 'zk-dc'], 'dc-fw': ['v3', 'zk-dc'], 'dc-reg': ['v3', 'zk-dc'], 'dc-casc': ['v9', 'v3', 'zk-reg'],
  'sm-start': ['v7', 'zk-sm'], 'sm-pullout': ['v7', 'zk-sm'], 'sm-v': ['v7', 'zk-sm'], 'sm-noexc': ['v7', 'zk-sm'],
  'sg-sync': ['v7', 'zk-sm'], 'sg-bad': ['v7', 'zk-sm'], 'sg-under': ['v7', 'zk-sm'], 'sg-trip': ['v7', 'v2', 'zk-sm'], 'ag': ['v6', 'zk-am'], 'dg-self': ['v3', 'zk-dc'], 'dg-ext': ['v3', 'zk-dc']
};
const REF_NAME = { v1: 'Základy', v2: 'Mechanika pohonu', v3: 'Stejnosměrný stroj', v4: 'Transformátor', v5: 'Točivé pole', v6: 'Asynchronní stroj', v7: 'Synchronní stroj', v8: 'Vektorové řízení', v9: 'Regulace', v10: 'Ztráty a oteplení' };
function refLinks(ids) {
  return (ids || []).map(r => r.startsWith('zk-') ? `<a href="#zk" data-goto="zk|${r}">Otázky: ${ZK_G[r.slice(3)] || ''}</a>` : `<a href="#vzt" data-goto="vzt|${r}">Vztahy: ${REF_NAME[r]}</a>`).join(' · ');
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-goto]');
  if (a) { e.preventDefault(); const [t, id] = a.dataset.goto.split('|'); if (t === 'zk' && id.startsWith('zk-')) zkG = id.slice(3); location.hash = t; setTab(t); setTimeout(() => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: 'start' }); }, 60); return; }
  const s = e.target.closest('[data-scn-go]');
  if (s) { e.preventDefault(); location.hash = 'lab'; setTab('lab'); setTimeout(() => { labScnStart(s.dataset.scnGo); const p = document.getElementById('lb-scnp'); if (p) p.scrollIntoView({ block: 'start' }); }, 60); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'osc-w') OSC.win = +t.value;
  else if (t.id === 'osc-tr') OSC.trig = t.checked;
  else if (t.dataset && t.dataset.osc) OSC.ch[t.dataset.osc] = t.checked;
});
