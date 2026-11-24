/* ===== Laboratoř: animovaný rozběh motoru s měřicími přístroji ===== */
const LAB_SC = {
  dc: [
    { id: 'dol', n: 'Přímé připojení na 440 V', p: 'dol', pct: 100, tz: 1.0, why: 'Bez omezení proudu: v první chvíli je u_i = 0, proud omezuje jen odpor a indukčnost kotvy. Sledujte ručku ampérmetru: špička je mnohonásobkem I_N, pak proud klesá, jak roste indukované napětí.' },
    { id: 'rp', n: 'Rozběh s předřadným odporem', p: 'rp', pct: 100, tz: 1.3, why: 'Odpor R_p omezí záběrný proud. Po jeho vyřazení proud krátce vyskočí a motor dosáhne plné rychlosti.' },
    { id: 'ramp', n: 'Rampa napětí z usměrňovače', s: { mode: 'open', U1: 440, Tr: 0.6, tz1: 0.9, tEnd: 1.4 }, pct: 100, tz: 0.9, why: 'Napětí roste plynule, proud zůstává malý a rychlost sleduje napětí.' },
    { id: 'casc', n: 'Kaskádní regulace (rampa + omezení proudu)', p: 'casc', pct: 100, tz: 0.6, why: 'Regulátor rychlosti žádá proud až do omezení I_max, regulátor proudu ho drží. Rozběh je rychlý, proud nepřekročí mez a po zatížení se rychlost vrátí na žádanou hodnotu.' }
  ],
  am: [
    { id: 'dol', n: 'Přímé připojení na síť', p: 'dol', pct: 100, tz: 0.6, why: 'Záběrný proud je 5–7× I_N a moment v prvních periodách kmitá (stejnosměrné složky toku). Po rozběhu skluz klesne na několik procent; po připojení zátěže skluz i proud vzrostou.' },
    { id: 'yd', n: 'Rozběh hvězda–trojúhelník', p: 'yd', pct: 30, tz: 0, start: true, why: 'Ve hvězdě je proud ze sítě i moment třetinový. Po přepnutí na trojúhelník vznikne druhý proudový ráz.' },
    { id: 'rp2', n: 'Kroužkový motor s odporem v rotoru', p: 'rp2', pct: 100, tz: 0, start: true, why: 'Odpor v rotoru posune moment zvratu do záběru: velký moment při menším proudu. Po vyřazení odporu motor přejde na přirozenou charakteristiku.' },
    { id: 'uf', n: 'Měnič frekvence U/f s rampou', p: 'uf', pct: 100, tz: 1.4, why: 'Frekvence i napětí rostou rampou, pole se otáčí pomalu a rotor ho s malým skluzem následuje. Proud zůstává blízko jmenovitého.' },
    { id: 'foc', n: 'Vektorové řízení', p: 'foc', s: { t2: 99, tEnd: 1.2 }, pct: 100, tz: 0.6, why: 'Nejprve se vybudí tok, pak regulátor rychlosti dává moment až do omezení. Zatížení vyreguluje bez trvalé odchylky.' },
    { id: 'plug', n: 'Rozběh a brzdění protiproudem', p: 'plug', pct: 0, tz: 99, why: 'Po přehození dvou fází se pole otáčí opačně, skluz je téměř 2 a proud velký. V nule je nutné motor odpojit, jinak se rozběhne opačně.' },
    { id: 'dcb', n: 'Rozběh a brzdění stejnosměrným proudem', p: 'dcb', pct: 0, tz: 99, why: 'Stejnosměrný proud ve statoru vytvoří stojící pole; rotor v něm brzdí jako generátor do vlastního odporu.' }
  ]
};
const LAB = { m: 'am', sc: 'dol', pct: null, start: null, J: 1, sp: 0.1 };
let labR = null, labRaf = 0, labT = 0, labPlay = false, labTh = 0, labThF = 0, labLast = 0, labSc = null, labRng = null;

function niceUp(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }
function labState() {
  const sc = LAB_SC[LAB.m].find(x => x.id === LAB.sc) || LAB_SC[LAB.m][0], m = MODS[LAB.m];
  const pr = sc.p ? m.presets.find(x => x.id === sc.p) : null;
  const st = { ...m.def, ...(pr ? pr.s : {}), ...(sc.s || {}) };
  const Jf = LAB.J; st.J = m.def.J * Jf;
  for (const k of ['tEnd', 'tp', 'tR', 'tb']) if (st[k] != null && st[k] < 50) st[k] = st[k] * Jf;
  const pct = LAB.pct == null ? sc.pct : LAB.pct, start = LAB.start == null ? !!sc.start : LAB.start;
  const MN = LAB.m === 'dc' ? dcDerived(st).MN : st.MN;
  st.Mz = pct / 100 * MN; st.tz1 = start ? 0 : sc.tz * Jf; st.tz2 = 99;
  if (st.tz1 > 50) st.Mz = 0;
  st.tEnd = Math.min(5, st.tEnd);
  if (m.autotune) Object.assign(st, m.autotune(st));
  return { st, sc, MN, pct, start };
}
function labCompute() {
  const { st, sc, MN } = labState(); labSc = { st, sc, MN };
  const R = LAB.m === 'dc' ? simDC(st) : simIM(st);
  const n = R.t.length, k = Math.SQRT1_2;
  if (LAB.m === 'dc') { R.U = R.u; R.I = R.iq; R.P = R.u.map((u, i) => u * R.iq[i] / 1e3); }
  else {
    /* efektivní hodnoty: obálka prostorového vektoru → efektivní hodnota fáze */
    R.U = R.umag.map(u => u * Math.sqrt(1.5)); R.I = R.imag.map(i => i * k);
    R.P = R.M.map((M, i) => M * toRad(R.n[i]) / 1e3);
    R.s = R.n.map((v, i) => R.nsync[i] ? (R.nsync[i] - v) / R.nsync[i] : NaN);
  }
  const rng = a => { let lo = 0, hi = 0; for (const v of a) if (isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } hi = niceUp(hi * 1.05); lo = lo < -0.04 * hi ? -niceUp(-lo * 1.05) : 0; return [lo, hi]; };
  labRng = { U: rng(R.U), I: rng(R.I), n: rng(R.n), M: rng(R.M.concat(R.Mz)) };
  labR = R; labT = 0; labTh = 0; labThF = 0;
}
function gaugeSVG(id, lo, hi) {
  const cx = 110, cy = 112, r = 86, a0 = -125, a1 = 125, A = v => a0 + (v - lo) / (hi - lo) * (a1 - a0);
  const p = (rr, a) => [cx + rr * Math.sin(a * Math.PI / 180), cy - rr * Math.cos(a * Math.PI / 180)];
  const raw = (hi - lo) / 5, e = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / e, step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e, minor = step / 5;
  let g = `<path d="M${p(r, a0).join(' ')}A${r} ${r} 0 1 1 ${p(r, a1).join(' ')}" class="garc"/>`;
  const dec = step < 1 ? 1 : 0;
  for (let k = Math.ceil(lo / minor - 1e-9); k * minor <= hi + 1e-9; k++) {
    const v = (k * minor) || 0, a = A(v), major = Math.abs(v / step - Math.round(v / step)) < 1e-6, [x1, y1] = p(r, a), [x2, y2] = p(major ? r - 13 : r - 7, a);
    g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="gtk"/>`;
    if (major) { const [tx, ty] = p(r - 27, a); g += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" class="gtx">${fmt(v, dec)}</text>`; }
  }
  if (lo < 0) { const [x1, y1] = p(r + 4, A(0)), [x2, y2] = p(r - 16, A(0)); g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="gz"/>`; }
  g += `<g id="nd-${id}"><line x1="${cx}" y1="${cy + 12}" x2="${cx}" y2="${cy - r + 8}" class="gnd"/></g><circle cx="${cx}" cy="${cy}" r="7" class="gcap"/>`;
  return `<svg viewBox="0 0 220 166" class="gauge" aria-hidden="true">${g}</svg>`;
}
function labBench() {
  const dc = LAB.m === 'dc', st = labSc.st, mode = st.mode;
  const src = dc ? (mode === 'casc' || st.Tr > 0 ? ['Usměrňovač', 'řízený, 0–500 V'] : ['Zdroj', st.U1 + ' V ss']) : (mode === 'dol' ? ['Síť', '3 × ' + st.UN + ' V, ' + st.fN + ' Hz'] : ['Měnič', 'frekvence, U_d ' + st.Udc + ' V']);
  let g = `<defs><marker id="lah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="lkf"/></marker></defs>`;
  g += `<rect x="14" y="70" width="110" height="140" rx="10" class="lbx"/><text x="69" y="132" text-anchor="middle" class="lb">${src[0]}</text><text x="69" y="152" text-anchor="middle" class="ls">${ssub(src[1])}</text>`;
  /* vodiče */
  g += `<path d="M124 100H170M206 100H300M124 180H300" class="lw"/>`;
  g += `<g id="lab-sw"><line x1="170" y1="100" x2="204" y2="84" class="lw2"/></g><circle cx="170" cy="100" r="3.5" class="lkf"/><circle cx="206" cy="100" r="3.5" class="lkf"/><text x="188" y="72" text-anchor="middle" class="ls">${dc ? 'vypínač' : 'stykač'}</text>`;
  g += `<circle cx="240" cy="100" r="17" class="lbx"/><text x="240" y="106" text-anchor="middle" class="lb">A</text>`;
  g += `<path d="M272 100V122M272 158V180" class="lw"/><circle cx="272" cy="140" r="17" class="lbx"/><text x="272" y="146" text-anchor="middle" class="lb">V</text>`;
  g += `<text x="300" y="92" text-anchor="end" class="ls">${dc ? 'kotva' : '3 fáze'}</text>`;
  /* motor v řezu */
  const cx = 455, cy = 140;
  g += `<path d="M300 100H${cx - 128}M300 180H${cx - 128}" class="lw"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="128" class="lfe"/><circle cx="${cx}" cy="${cy}" r="${dc ? 96 : 92}" class="lgap"/>`;
  if (dc) {
    g += `<path d="M${cx - 30} ${cy - 127}h60v32l14 4a92 92 0 0 0 -88 0l14 -4z" class="lfe2"/><path d="M${cx - 30} ${cy + 127}h60v-32l14 -4a92 92 0 0 1 -88 0l14 4z" class="lfe2"/>`;
    g += `<text x="${cx}" y="${cy - 102}" text-anchor="middle" class="lpole">N</text><text x="${cx}" y="${cy + 114}" text-anchor="middle" class="lpole">S</text>`;
  } else {
    for (let i = 0; i < 24; i++) { const a = i * 15 + 7.5; g += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - 5}" y="${cy - 122}" width="10" height="26" rx="2" class="lph${Math.floor(i / 2) % 3}"/></g>`; }
  }
  /* rotor (otáčí se) */
  let rot = `<circle cx="${cx}" cy="${cy}" r="${dc ? 90 : 86}" class="lrot"/>`;
  const nb = dc ? 16 : 22;
  for (let i = 0; i < nb; i++) { const a = i * 360 / nb; rot += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - 4}" y="${cy - (dc ? 86 : 80)}" width="8" height="${dc ? 18 : 12}" rx="2" class="${dc ? 'lcu' : 'lal'}"/></g>`; }
  if (dc) rot += `<circle cx="${cx}" cy="${cy}" r="40" class="lcomm"/>` + Array.from({ length: 16 }, (_, i) => `<line x1="${cx}" y1="${cy - 40}" x2="${cx}" y2="${cy - 26}" transform="rotate(${i * 22.5} ${cx} ${cy})" class="lw"/>`).join('');
  rot += `<rect x="${cx - 3}" y="${cy - 84}" width="6" height="60" rx="3" class="lmark"/><circle cx="${cx}" cy="${cy}" r="18" class="lshaft"/>`;
  g += `<g id="lab-rot">${rot}</g>`;
  if (dc) g += `<rect x="${cx - 52}" y="${cy - 9}" width="14" height="18" rx="2" class="lbrush"/><rect x="${cx + 38}" y="${cy - 9}" width="14" height="18" rx="2" class="lbrush"/>`;
  /* osa pole */
  g += `<g id="lab-fld"><line x1="${cx}" y1="${dc ? cy - 66 : cy + 66}" x2="${cx}" y2="${dc ? cy + 70 : cy - 70}" class="lfld" marker-end="url(#lah)"/></g>`;
  /* zátěž */
  g += `<rect x="610" y="92" width="136" height="96" rx="10" class="lbx"/><text x="678" y="116" text-anchor="middle" class="lb">Zátěž (brzda)</text><text x="678" y="140" text-anchor="middle" class="ls" id="lab-mz">M_z = 0</text><text x="678" y="162" text-anchor="middle" class="ls" id="lab-yd"></text>`;
  g += `<path d="M${cx + 128} 140H610" class="lshl"/>`;
  return `<svg viewBox="0 0 760 280" class="bench" role="img" aria-label="Zkušební stanoviště: zdroj, ${dc ? 'vypínač' : 'stykač'}, ampérmetr, voltmetr, motor v řezu a zátěž">${g}</svg>`;
}
const ssub = s => String(s).replace(/([A-Za-zΦΩ])_([A-Za-z0-9]+)/g, '$1<tspan baseline-shift="sub" font-size="75%">$2</tspan>');
function labEvents(st) {
  const ev = [], dc = LAB.m === 'dc';
  if (st.t1 != null) ev.push([st.t1, dc ? (st.mode === 'casc' ? 'povel k rozběhu (žádaná rychlost ' + st.n1 + ' ot/min)' : 'zapnuto napětí kotvy') : (st.mode === 'dol' ? 'sepnut stykač, motor na síti' + (st.yd ? ' ve hvězdě' : '') : 'start měniče')]);
  if (dc && st.Rp > 0 && st.tp < st.tEnd) ev.push([st.tp, 'vyřazen předřadný odpor']);
  if (!dc && st.yd && st.tp < st.tEnd) ev.push([st.tp, 'přepnutí hvězda → trojúhelník']);
  if (!dc && st.Rp2 > 0 && st.tR < st.tEnd) ev.push([st.tR, 'vyřazen odpor v rotoru']);
  if (!dc && st.brk && st.brk !== 'none' && st.tb < st.tEnd) ev.push([st.tb, st.brk === 'plug' ? 'brzdění protiproudem (přehozeny dvě fáze)' : 'brzdění stejnosměrným proudem']);
  if (st.Mz > 0 && st.tz1 < st.tEnd) ev.push([st.tz1, st.tz1 === 0 ? 'zátěž připojena od začátku' : 'připojena zátěž ' + fmt(st.Mz, 0) + ' N·m']);
  return ev.sort((a, b) => a[0] - b[0]);
}
function renderLab(el) {
  labCompute();
  const sc = labSc.sc, st = labSc.st, dc = LAB.m === 'dc', pct = LAB.pct == null ? sc.pct : LAB.pct, start = LAB.start == null ? !!sc.start : LAB.start;
  const meters = [['U', dc ? 'Voltmetr: napětí kotvy' : 'Voltmetr: napětí (ef., sdružené)', 'V'], ['I', dc ? 'Ampérmetr: proud kotvy' : 'Ampérmetr: proud fáze (ef.)', 'A'], ['n', 'Otáčkoměr', 'ot/min'], ['M', 'Momentoměr: moment motoru', 'N·m']];
  const extra = dc ? [['ui', 'Indukované napětí U_i', 'V'], ['if', 'Budicí proud I_f', 'A'], ['p', 'Příkon kotvy U·I', 'kW'], ['t', 'Čas', 's']] : [['f', 'Frekvence f₁', 'Hz'], ['s', 'Skluz s', '%'], ['p', 'Výkon M·Ω', 'kW'], ['t', 'Čas', 's']];
  el.innerHTML = `<div class="wrap lab"><h2>Laboratoř: rozběh motoru</h2><p class="lead">Motor se rozběhne zpomaleně, ručky měřáků ukazují okamžité hodnoty ze simulace. U střídavého motoru ukazují efektivní hodnoty; červená šipka je osa magnetického pole, bílý pruh značka na rotoru.</p>
<div class="lbar">
<label>Motor<select id="lb-m"><option value="am"${LAB.m === 'am' ? ' selected' : ''}>asynchronní 400 V</option><option value="dc"${dc ? ' selected' : ''}>stejnosměrný cize buzený 440 V</option></select></label>
<label>Způsob rozběhu<select id="lb-sc">${LAB_SC[LAB.m].map(x => `<option value="${x.id}"${x.id === sc.id ? ' selected' : ''}>${x.n}</option>`).join('')}</select></label>
<label>Zátěž <b id="lb-pv">${pct} % M_N</b><input type="range" id="lb-pct" min="0" max="150" step="10" value="${pct}"></label>
<label class="chk"><input type="checkbox" id="lb-st"${start ? ' checked' : ''}><span>zátěž od začátku</span></label>
<label>Setrvačnost <b id="lb-jv">${fmt(LAB.J, 1)}×</b><input type="range" id="lb-J" min="0.5" max="2.5" step="0.5" value="${LAB.J}"></label>
<label>Zpomalení<select id="lb-sp">${[[1, 'skutečný čas'], [0.5, '2×'], [0.2, '5×'], [0.1, '10×'], [0.05, '20×'], [0.02, '50×']].map(([v, t]) => `<option value="${v}"${+v === LAB.sp ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
</div>
<div class="lrun"><button type="button" class="btn big" id="lb-go">▶ Zapnout</button><button type="button" class="btn" id="lb-re">↺ Od začátku</button><input type="range" id="lb-tm" min="0" max="1000" value="0" aria-label="Čas simulace"><span id="lb-st2" class="st"></span></div>
<div class="lstage">${labBench()}</div>
<div class="gauges">${meters.map(([k, t, u]) => `<div class="meter"><p>${t}</p>${gaugeSVG(k, ...labRng[k])}<div class="lcd"><span id="lcd-${k}">0</span><small>${u}</small></div></div>`).join('')}</div>
<div class="lcds">${extra.map(([k, t, u]) => `<div class="meter sm"><p>${sub(t)}</p><div class="lcd"><span id="lcx-${k}">0</span><small>${u}</small></div></div>`).join('')}</div>
<div class="lchart"><canvas id="lb-cv" aria-label="Průběh otáček, proudu a momentu"></canvas><p class="note"><span class="k-n">■ otáčky</span> <span class="k-i">■ proud</span> <span class="k-m">■ moment</span> (každá veličina ve stupnici svého měřáku)</p></div>
<div class="cols2"><div><h3>Co sledovat</h3><p>${sub(sc.why)}</p>${!dc && st.mode === 'dol' && st.yd ? '<p class="note">Voltmetr ukazuje napětí na vinutí: ve hvězdě U/√3.</p>' : ''}</div><div><h3>Události</h3><ol id="lb-ev" class="lev">${labEvents(st).map(([t, s]) => `<li data-t="${t}"><b>${fmt(t, 2)} s</b> ${s}</li>`).join('')}</ol></div></div></div>`;
  labDraw(); labStop();
}
function labIdx(t) { const T = labR.t, n = T.length; if (t <= T[0]) return 0; if (t >= T[n - 1]) return n - 1; const k = Math.round(t / (T[n - 1] / (n - 1))); return Math.max(0, Math.min(n - 1, k)); }
function labNeedle(id, v, [lo, hi]) { const e = document.getElementById('nd-' + id); if (!e) return; const a = -125 + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * 250; e.setAttribute('transform', `rotate(${a.toFixed(2)} 110 112)`); }
function labDraw() {
  if (!labR || !$('#lab-rot')) return;
  const R = labR, i = labIdx(labT), dc = LAB.m === 'dc', st = labSc.st;
  const set = (id, v, d) => { const e = document.getElementById(id); if (e) e.textContent = isFinite(v) ? fmt(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v, d) : '–'; };
  for (const k of ['U', 'I', 'n', 'M']) { labNeedle(k, R[k][i], labRng[k]); set('lcd-' + k, R[k][i], k === 'n' ? 0 : k === 'M' ? 1 : Math.abs(R[k][i]) < 100 ? 1 : 0); }
  if (dc) { set('lcx-ui', R.ui[i], 0); set('lcx-if', R.If[i], 2); set('lcx-p', R.P[i], 1); }
  else { set('lcx-f', R.f1[i], 1); set('lcx-s', R.s[i] * 100, 1); set('lcx-p', R.P[i], 1); }
  set('lcx-t', labT, 2);
  $('#lab-rot').setAttribute('transform', `rotate(${(labTh * 180 / Math.PI % 360).toFixed(2)} 455 140)`);
  $('#lab-fld').setAttribute('transform', `rotate(${dc ? 0 : (labThF * 180 / Math.PI % 360).toFixed(2)} 455 140)`);
  $('#lab-fld').style.opacity = dc ? (R.If[i] > 0.05 ? 1 : 0.2) : (R.umag[i] > 1 ? 1 : 0.15);
  const on = labT >= (st.t1 || 0) - 1e-9;
  $('#lab-sw').setAttribute('transform', on ? 'rotate(26 170 100)' : '');
  const mz = document.getElementById('lab-mz'); if (mz) mz.textContent = 'M_z = ' + fmt(R.Mz[i], 1) + ' N·m';
  const yd = document.getElementById('lab-yd'); if (yd) yd.textContent = !dc && st.yd ? (labT < st.tp ? 'vinutí v hvězdě' : 'vinutí v trojúhelníku') : !dc && st.Rp2 > 0 ? (labT < st.tR ? 'R_p v rotoru zapojen' : 'R_p vyřazen') : dc && st.Rp > 0 ? (labT < st.tp ? 'R_p v obvodu kotvy' : 'R_p vyřazen') : '';
  const tEnd = R.t[R.t.length - 1]; $('#lb-tm').value = Math.round(labT / tEnd * 1000);
  $('#lb-st2').textContent = `t = ${fmt(labT, 3)} s z ${fmt(tEnd, 2)} s`;
  document.querySelectorAll('#lb-ev li').forEach(li => li.classList.toggle('done', labT >= +li.dataset.t));
  labChart(i);
}
function labChart(iCur) {
  const cv = $('#lb-cv'); if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1; if (!W) return;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const col = n => { let s = document.getElementById('lab-col'); if (!s) { s = document.createElement('span'); s.id = 'lab-col'; s.style.display = 'none'; document.body.appendChild(s); } s.style.color = `var(${n})`; return getComputedStyle(s).color; };
  const R = labR, n = R.t.length, tEnd = R.t[n - 1], X = t => 8 + (W - 16) * t / tEnd;
  c.strokeStyle = col('--rule'); c.lineWidth = 1; c.beginPath(); c.moveTo(8, H - 18); c.lineTo(W - 8, H - 18); c.stroke();
  c.fillStyle = col('--mut'); c.font = '12px Inter, sans-serif';
  for (let k = 0; k <= 4; k++) { const t = tEnd * k / 4; c.fillText(fmt(t, 2) + ' s', Math.min(W - 40, X(t)), H - 4); }
  const tr = (key, color, [lo, hi]) => {
    const Y = v => (H - 22) - (v - lo) / (hi - lo) * (H - 30);
    for (const [alpha, end] of [[0.18, n - 1], [1, iCur]]) {
      c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = alpha < 1 ? 1 : 2; c.beginPath();
      const step = Math.max(1, Math.floor(n / 900));
      for (let i = 0; i <= end; i += step) { const x = X(R.t[i]), y = Y(R[key][i]); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    }
    c.globalAlpha = 1;
  };
  tr('M', col('--och'), labRng.M); tr('I', col('--red'), labRng.I); tr('n', col('--blu'), labRng.n);
  c.strokeStyle = col('--ink'); c.lineWidth = 1; c.beginPath(); c.moveTo(X(labT), 4); c.lineTo(X(labT), H - 18); c.stroke();
}
function labAdvance(dt) {
  const R = labR, tEnd = R.t[R.t.length - 1];
  let rem = dt * LAB.sp; const h = 2e-4;
  while (rem > 0 && labT < tEnd) {
    const d = Math.min(h, rem), i = labIdx(labT);
    labTh -= toRad(R.n[i]) * d;                                                 /* kladná rychlost = po směru hodinových ručiček */
    if (LAB.m === 'am') labThF -= TAU * R.f1[i] / labSc.st.pp * d;
    labT += d; rem -= d;
  }
  if (labT >= tEnd) { labT = tEnd; labStop(); }
}
function labLoop(ts) {
  if (tab !== 'lab' || !labPlay) { labRaf = 0; return; }
  const dt = labLast ? Math.min(0.05, (ts - labLast) / 1000) : 0; labLast = ts;
  labAdvance(dt); labDraw();
  if (labPlay) labRaf = requestAnimationFrame(labLoop);
}
function labStart() { if (!labR) return; if (labT >= labR.t[labR.t.length - 1]) { labT = 0; labTh = 0; labThF = 0; } labPlay = true; labLast = 0; const b = $('#lb-go'); if (b) b.textContent = '❚❚ Pozastavit'; if (!labRaf) labRaf = requestAnimationFrame(labLoop); }
function labStop() { labPlay = false; const b = $('#lb-go'); if (b) b.textContent = labR && labT >= labR.t[labR.t.length - 1] ? '▶ Znovu zapnout' : labT > 0 ? '▶ Pokračovat' : '▶ Zapnout'; }
document.addEventListener('click', e => {
  if (tab !== 'lab') return;
  if (e.target.id === 'lb-go') { labPlay ? labStop() : labStart(); }
  if (e.target.id === 'lb-re') { labT = 0; labTh = 0; labThF = 0; labDraw(); labStart(); }
});
document.addEventListener('input', e => {
  if (tab !== 'lab') return;
  const id = e.target.id;
  if (id === 'lb-tm') { labStop(); const tEnd = labR.t[labR.t.length - 1]; const tn = +e.target.value / 1000 * tEnd; if (tn < labT) { labT = 0; labTh = 0; labThF = 0; } const sp = LAB.sp; LAB.sp = 1; labAdvance(tn - labT); LAB.sp = sp; labDraw(); }
  if (id === 'lb-pct') { $('#lb-pv').textContent = e.target.value + ' % M_N'; }
  if (id === 'lb-J') { $('#lb-jv').textContent = fmt(+e.target.value, 1) + '×'; }
});
document.addEventListener('change', e => {
  if (tab !== 'lab') return;
  const id = e.target.id;
  if (id === 'lb-m') { LAB.m = e.target.value; LAB.sc = LAB_SC[LAB.m][0].id; LAB.pct = null; LAB.start = null; }
  else if (id === 'lb-sc') { LAB.sc = e.target.value; LAB.pct = null; LAB.start = null; }
  else if (id === 'lb-pct') LAB.pct = +e.target.value;
  else if (id === 'lb-st') LAB.start = e.target.checked;
  else if (id === 'lb-J') LAB.J = +e.target.value;
  else if (id === 'lb-sp') { LAB.sp = +e.target.value; return; }
  else return;
  renderLab($('#cards'));
});
window.addEventListener('resize', () => { if (tab === 'lab' && labR) labChart(labIdx(labT)); });
