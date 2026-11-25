/* ===== Laboratoř: transformátor (jednofázový časově, trojfázový a paralelní chod fázorově) ===== */
const TRP = (() => {
  const S = 2000, U1 = 230, U2 = 115, p = U1 / U2, I1N = S / U1, Zb = U1 / I1N, w = 2 * Math.PI * 50, uk = 0.05, pk = 0.025, i0 = 0.04, p0 = 0.01;
  const Rk = pk * Zb, Xk = Math.sqrt(uk * uk - pk * pk) * Zb, Lk = Xk / w, Im = i0 * I1N, Lm = U1 / (w * Im), RFe = U1 * U1 / (p0 * S), psiN = U1 * Math.SQRT2 / w;
  return { S, U1, U2, p, I1N, I2N: S / U2, Zb, w, uk, pk, i0, p0, R1: Rk / 2, R2: Rk / 2, Ls1: Lk / 2, Ls2: Lk / 2, Lm, RFe, psiN, psiK: 1.2 * psiN, Lsat: 0.012, eps: 0.04 * psiN };
})();
const TR = { on: false, U: 100, ang: 'rnd', rem: 0, load: 'open', I: 1, cf: 0.8, ch: 'ind', sp: 0.02, run: true, chs: { u1: true, i1: true, i2: true, psi: true }, win: 0.1 };
let TS = null, trRaf = 0, trLast = 0;
/* magnetizační charakteristika ψ → i (měkké koleno, nad ním „vzduchová“ indukčnost) */
function trIm(ps) {
  const P = TRP, a = Math.abs(ps), x = a - P.psiK, sq = Math.sqrt(x * x + P.eps * P.eps), g = (x + sq) / 2, dg = (1 + x / sq) / 2, k = 1 / P.Lsat - 1 / P.Lm;
  return { i: Math.sign(ps) * (a / P.Lm + k * g), d: 1 / P.Lm + k * dg };
}
function trLoadZ() {
  const P = TRP;
  if (TR.load === 'open') return null;
  if (TR.load === 'short') return { R: 0, L: 0, C: 0 };
  const Z = (P.U2 / P.I2N) / Math.max(TR.I, 0.02) * P.p * P.p, ph = Math.acos(TR.cf), R = Z * TR.cf, X = Z * Math.sin(ph);   /* přepočteno na primár */
  return TR.ch === 'ind' || X < 1e-9 ? { R, L: X / P.w, C: 0 } : { R, L: 0, C: 1 / (P.w * X) };
}
function trInit() {
  TS = { t: 0, s: [TR.rem * TRP.psiN, TR.rem * TRP.psiN, 0], th0: 0, onT: -1, Z: trLoadZ(), acc: 0, trip: false, hot: 0,
    per: { n: 0, su1: 0, si1: 0, sp1: 0, su2: 0, si2: 0, sp2: 0, t0: 0 }, m: { U1: 0, I1: 0, P1: 0, U2: 0, I2: 0, P2: 0, ipk: 0 }, pm: TR.rem * TRP.psiN,
    osc: { t: new Float64Array(OSC_N), u1: new Float64Array(OSC_N), i1: new Float64Array(OSC_N), i2: new Float64Array(OSC_N), psi: new Float64Array(OSC_N), i: 0, n: 0 }, nextO: 0, hist: [] };
}
/* řešení ψ_m z toků ψ₁, ψ₂x (Newton), vrací proudy */
function trSolve(s, Z) {
  const P = TRP, Lt = Z ? P.Ls2 + Z.L : 0; let pm = TS.pm;
  for (let it = 0; it < 8; it++) {
    const m = trIm(pm), f = (s[0] - pm) / P.Ls1 - (Z ? (pm - s[1]) / Lt : 0) - m.i, df = -1 / P.Ls1 - (Z ? 1 / Lt : 0) - m.d, dp = f / df;
    pm -= dp; if (Math.abs(dp) < 1e-9) break;
  }
  TS.pm = pm; return { pm, i1: (s[0] - pm) / P.Ls1, iL: Z ? (pm - s[1]) / Lt : 0, Lt };
}
function trDeriv(s, t, Z) {
  const P = TRP, u1 = trU1(t), r = trSolve(s, Z);
  return { d: [u1 - P.R1 * r.i1, Z ? (P.R2 + Z.R) * r.iL + s[2] : 0, Z && Z.C ? r.iL / Z.C : 0], r, u1 };
}
function trU1(t) { return TR.on && !TS.trip ? TR.U / 100 * TRP.U1 * Math.SQRT2 * Math.sin(TRP.w * (t - TS.onT) + TS.th0) : 0; }
function trStep(dt) {
  const s = TS.s, Z = TS.Z, t = TS.t;
  if (!TR.on || TS.trip) { /* vypnuto: tok zůstane jako remanence, proudy nulové */ TS.s = [TS.pm, TS.pm, 0]; TS.t += dt; return { i1: 0, iL: 0, u1: 0, u2: 0, pm: TS.pm }; }
  if (!Z) s[1] = TS.pm;
  const k1 = trDeriv(s, t, Z), a = (x, k, h) => x.map((v, i) => v + h * k.d[i]);
  const k2 = trDeriv(a(s, k1, dt / 2), t + dt / 2, Z), k3 = trDeriv(a(s, k2, dt / 2), t + dt / 2, Z), k4 = trDeriv(a(s, k3, dt), t + dt, Z);
  for (let i = 0; i < 3; i++) s[i] += dt / 6 * (k1.d[i] + 2 * k2.d[i] + 2 * k3.d[i] + k4.d[i]);
  TS.t += dt;
  const r = trSolve(s, Z), u1 = trU1(TS.t), P = TRP;
  /* napětí na svorkách sekundáru (přepočtené): u₂ = R_z·i + u_C + L_z·di/dt */
  let u2 = 0;
  if (Z) { const m = trIm(r.pm), d1 = u1 - P.R1 * r.i1, d2 = (P.R2 + Z.R) * r.iL + s[2], dpm = (d1 / P.Ls1 + d2 / r.Lt) / (1 / P.Ls1 + 1 / r.Lt + m.d), diL = (dpm - d2) / r.Lt; u2 = Z.R * r.iL + s[2] + Z.L * diL; }
  else { const m = trIm(r.pm), d1 = u1 - P.R1 * r.i1; u2 = d1 / P.Ls1 / (1 / P.Ls1 + m.d); }
  return { i1: r.i1 + u1 / P.RFe, iL: r.iL, u1, u2, pm: r.pm };
}
function trAdvance(simT) {
  const dt = 2e-5, cap = 6000, P = TRP; TS.acc += simT; const n = Math.min(Math.floor(TS.acc / dt), cap); TS.acc = n === cap ? 0 : TS.acc - n * dt;
  for (let k = 0; k < n; k++) {
    const r = trStep(dt), q = TS.per, u2s = r.u2 / P.p, i2s = r.iL * P.p;
    q.n++; q.su1 += r.u1 * r.u1; q.si1 += r.i1 * r.i1; q.sp1 += r.u1 * r.i1; q.su2 += u2s * u2s; q.si2 += i2s * i2s; q.sp2 += u2s * i2s;
    TS.m.ipk = Math.max(TS.m.ipk * (1 - dt / 0.5), Math.abs(r.i1));
    if (TS.t - q.t0 >= 0.02 - 1e-9) {
      const N = q.n, m = TS.m; m.U1 = Math.sqrt(q.su1 / N); m.I1 = Math.sqrt(q.si1 / N); m.P1 = q.sp1 / N; m.U2 = Math.sqrt(q.su2 / N); m.I2 = Math.sqrt(q.si2 / N); m.P2 = q.sp2 / N;
      TS.per = { n: 0, su1: 0, si1: 0, sp1: 0, su2: 0, si2: 0, sp2: 0, t0: TS.t };
      /* jistič: tepelně (I > 3 I_N déle než 0,2 s) */
      TS.hot = m.I1 > 3 * P.I1N ? TS.hot + 0.02 : Math.max(0, TS.hot - 0.02);
      if (TS.hot > 0.2 && !TS.trip) { TS.trip = true; trLog('Jistič vypnul: proud ' + fmt(m.I1 / P.I1N, 1) + ' I_N'); }
    }
    if (TS.t >= TS.nextO) { TS.nextO = TS.t + OSC_DT; const o = TS.osc, i = o.i; o.t[i] = TS.t; o.u1[i] = r.u1; o.i1[i] = r.i1; o.i2[i] = TS.Z ? r.iL * P.p : NaN; o.psi[i] = r.pm; o.i = (i + 1) % OSC_N; o.n = Math.min(OSC_N, o.n + 1); }
  }
}
function trLog(t) { const e = $('#tr-ev'); if (e) e.insertAdjacentHTML('afterbegin', `<li><b>${fmt(TS.t, 3)} s</b> ${sub(t)}</li>`); }
function trSwitch(on) {
  if (on === TR.on) return;
  if (on) {
    const a = TR.ang === 'rnd' ? Math.random() * 360 : +TR.ang; TS.th0 = a * DEG; TS.onT = TS.t; TS.trip = false; TS.hot = 0; TS.m.ipk = 0;
    /* tok před zapnutím = remanence */
    TS.s = [TS.pm, TS.pm, 0]; TR.on = true; trLog(`Zapnuto v okamžiku, kdy je fáze napětí ${fmt(a, 0)}° (0° = průchod nulou), remanence ${fmt(TS.pm / TRP.psiN * 100, 0)} %`);
  } else { TR.on = false; TS.pm = clamp(TS.pm, -0.7 * TRP.psiN, 0.7 * TRP.psiN) * 0.9; TR.rem = TS.pm / TRP.psiN; trLog('Vypnuto, v jádře zůstala remanence ' + fmt(TR.rem * 100, 0) + ' %'); }
}
/* ---------- vykreslení ---------- */
function trCtlHTML() {
  const seg = (attr, cur, opts) => `<span class="seg">${opts.map(([k, t]) => `<button type="button" ${attr}="${k}" aria-pressed="${String(cur) === k}">${t}</button>`).join('')}</span>`;
  const sl = (id, l, a, b, st, v, u) => `<label class="lsl"><span><span>${sub(l)}</span> <b id="trv-${id}">${fmt(v, st < 0.1 ? 2 : st < 1 ? 1 : 0)} ${sub(u)}</b></span><input type="range" data-tr="${id}" min="${a}" max="${b}" step="${st}" value="${v}"></label>`;
  return `<div class="lgrp"><p class="lgh">Napájení primáru (230 V, 50 Hz)</p><div class="lrow"><button type="button" class="btn big${TR.on ? ' on' : ''}" id="tr-on">${TR.on ? 'Vypnout' : 'Zapnout'}</button>
<label>Okamžik zapnutí<select id="tr-ang">${[['rnd', 'náhodně'], ['0', 'v nule napětí (0°)'], ['45', '45°'], ['90', 've vrcholu napětí (90°)']].map(([k, t]) => `<option value="${k}"${TR.ang === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
${sl('U', 'Napětí primáru (autotransformátor)', 0, 110, 1, TR.U, '%')}${sl('rem', 'Remanence před zapnutím', -0.8, 0.8, 0.05, TR.rem, '× ψ_N')}</div>
<div class="lgrp"><p class="lgh">Sekundár</p><div class="lrow">${seg('data-trl', TR.load, [['open', 'naprázdno'], ['z', 'zátěž'], ['short', 'nakrátko']])}</div>
${TR.load === 'z' ? `${sl('I', 'Zatížení I₂/I₂N (při U_N)', 0.05, 1.5, 0.05, TR.I, '')}${sl('cf', 'Účiník zátěže cos φ₂', 0, 1, 0.05, TR.cf, '')}<div class="lrow">${seg('data-trc', TR.ch, [['ind', 'induktivní'], ['cap', 'kapacitní']])}</div>` : TR.load === 'short' ? '<p class="note">Zkouška nakrátko: snižte napětí primáru asi na 5 % (napětí nakrátko). Při plném napětí vypne jistič.</p>' : '<p class="note">Zkouška naprázdno: plné napětí, sekundár rozpojený.</p>'}</div>`;
}
function trPresetHTML() {
  return `<div class="lgrp"><p class="lgh">Předvolby pokusů</p><div class="lrow trpre">${TR_PRE.map((p, i) => `<button type="button" class="btn" data-trp="${i}">${p[0]}</button>`).join('')}</div></div>`;
}
const TR_PRE = [
  ['Zkouška naprázdno', { load: 'open', U: 100, ang: '90', rem: 0 }],
  ['Zkouška nakrátko', { load: 'short', U: 5, ang: '90', rem: 0 }],
  ['Nejhorší zapínací ráz', { load: 'open', U: 100, ang: '0', rem: 0.7 }],
  ['Zapnutí ve vrcholu (bez rázu)', { load: 'open', U: 100, ang: '90', rem: 0 }],
  ['Jmenovitá induktivní zátěž', { load: 'z', U: 100, ang: '90', rem: 0, I: 1, cf: 0.8, ch: 'ind' }],
  ['Kapacitní zátěž (napětí stoupne)', { load: 'z', U: 100, ang: '90', rem: 0, I: 1, cf: 0.2, ch: 'cap' }],
];
function renderTr(el) {
  if (!TS) trInit();
  el.innerHTML = `<div class="wrap lab"><h2>Laboratoř: transformátor</h2><p class="lead">Jednofázový transformátor 2 kVA, 230/115 V se počítá v čase včetně sycení jádra (u_k = 5 %, i₀ = 4 %). Níže je trojfázový transformátor s nesouměrnou zátěží a paralelní chod dvou transformátorů.</p>
<div class="lbar"><label>Stroj<select id="lb-m">${[['am', 'asynchronní 400 V'], ['dc', 'stejnosměrný 440 V'], ['sm', 'synchronní s vyniklými póly'], ['tr', 'transformátor']].map(([k, t]) => `<option value="${k}"${k === 'tr' ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label>Zpomalení<select id="tr-sp">${[[0.1, '10×'], [0.05, '20×'], [0.02, '50×'], [0.01, '100×'], [0.005, '200×'], [0.002, '500×']].map(([v, t]) => `<option value="${v}"${+v === TR.sp ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<span class="lrun"><button type="button" class="btn big" id="tr-go">${TR.run ? '❚❚ Pozastavit' : '▶ Pokračovat'}</button><button type="button" class="btn" id="tr-re">↺ Znovu</button></span></div>
${trPresetHTML()}
<div class="lctl"><div id="tr-ctl">${trCtlHTML()}</div><div class="lgrp"><p class="lgh">Zapojení</p><div id="tr-sch">${trSchSVG()}</div></div></div>
<div class="lcds">${[['U1', 'U₁', 'V'], ['I1', 'I₁', 'A'], ['P1', 'P₁', 'W'], ['U2', 'U₂', 'V'], ['I2', 'I₂', 'A'], ['P2', 'P₂', 'W'], ['ipk', 'špička i₁ (0,5 s)', 'A'], ['t', 'čas', 's']].map(([k, t, u]) => `<div class="meter sm"><p>${t}</p><div class="lcd"><span id="trx-${k}">0</span><small>${u}</small></div></div>`).join('')}</div>
<div class="ldiag"><div class="lgrp ldg dosc"><p class="lgh">Osciloskop</p><div class="lrow osct"><label>Časová základna<select id="tr-w">${[[0.04, '40 ms'], [0.1, '100 ms'], [0.4, '400 ms'], [1.2, '1,2 s']].map(([v, t]) => `<option value="${v}"${v === TR.win ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
${[['u1', 'napětí u₁', 'mut'], ['i1', 'proud i₁', 'a'], ['i2', 'proud i₂ (přepočtený na primár)', 'c'], ['psi', 'tok ψ_m', 'b']].map(([k, t, c]) => `<label class="chk osc-${c}"><input type="checkbox" data-trch="${k}"${TR.chs[k] ? ' checked' : ''}> ${sub(t)}</label>`).join('')}</div><canvas id="tr-cv" class="osccv"></canvas><p class="note">Každý kanál má vlastní měřítko (číslo vlevo dole). Při zapínacím rázu je dobře vidět, že tok začíná na remanenci a jeho stejnosměrná složka posune jádro do sycení: proud pak má úzké vysoké špičky jen v jedné polaritě.</p></div>
<div class="lgrp ldg"><p class="lgh">Magnetizační charakteristika ψ(i)</p><div id="tr-bh" class="dgb"></div><p class="note">Bod je okamžitý stav jádra. Nad kolenem malá změna toku vyžaduje velký proud.</p></div>
<div class="lgrp ldg"><p class="lgh">Fázorový diagram (ustálený stav)</p><div id="tr-ph" class="dgb"></div></div>
<div class="lgrp ldg"><p class="lgh">Vyhodnocení měření</p><div id="tr-ev2" class="dgb"></div></div></div>
<div class="cols2"><div class="lgrp"><p class="lgh">Záznam</p><ul class="lev" id="tr-ev"></ul></div><div class="lgrp"><p class="lgh">Na co se dívat</p><ul class="lt"><li>${sub('Naprázdno teče jen asi 4 % I_N a proud není sinusový (sycení): je špičatý.')}</li><li>${sub('Nakrátko stačí asi 5 % napětí na jmenovitý proud; wattmetr pak ukazuje ztráty ve vinutí.')}</li><li>Zapnutí v nule napětí s remanencí dá ráz až desetinásobku jmenovitého proudu, zapnutí ve vrcholu skoro žádný.</li><li>${sub('Při kapacitní zátěži je U₂ větší než naprázdno.')}</li></ul></div></div>
${tr3HTML()}${trParHTML()}</div>`;
  trDrawStatic(); tr3Draw(); trParDraw(); trStart();
}
function trSchSVG() {
  const l = TR.load, Z = l === 'open' ? '' : l === 'short' ? '<path d="M470 40V140" class="lw"/>' : `<rect x="455" y="62" width="30" height="56" class="lfe"/><text x="500" y="95" class="b">Z (${TR.ch === 'ind' ? 'R+L' : 'R+C'})</text>`;
  return `<svg viewBox="0 0 560 180" class="sch bench" role="img" aria-label="Zapojení transformátoru">
<circle cx="40" cy="90" r="22" class="lfe"/><text x="40" y="96" text-anchor="middle" class="b">~</text><text x="40" y="132" text-anchor="middle" class="sm">autotr.</text>
<path d="M40 68V40H150M40 112V140H200" class="lw"/><circle cx="100" cy="40" r="14" class="lfe"/><text x="100" y="45" text-anchor="middle" class="sm">A</text>
<rect x="150" y="30" width="28" height="20" class="lfe"/><text x="164" y="44" text-anchor="middle" class="sm">W</text><path d="M178 40H210" class="lw"/>
<circle cx="200" cy="90" r="13" class="lfe"/><text x="200" y="95" text-anchor="middle" class="sm">V</text><path d="M200 40V77M200 103V140" class="lw"/>
<path d="M210 40H250V140H200" class="lw"/><path d="M250 55c14 0 14 14 0 14c14 0 14 14 0 14c14 0 14 14 0 14c14 0 14 14 0 14" class="lw"/>
<path d="M268 40V140M276 40V140" class="lw"/><path d="M294 62c-14 0-14 12 0 12c-14 0-14 12 0 12c-14 0-14 12 0 12" class="lw"/>
<path d="M294 62V40H350M294 98V140H470" class="lw"/><circle cx="330" cy="40" r="14" class="lfe"/><text x="330" y="45" text-anchor="middle" class="sm">A</text>
<rect x="350" y="30" width="28" height="20" class="lfe"/><text x="364" y="44" text-anchor="middle" class="sm">W</text><path d="M378 40H470" class="lw"/>
<circle cx="410" cy="90" r="13" class="lfe"/><text x="410" y="95" text-anchor="middle" class="sm">V</text><path d="M410 40V77M410 103V140" class="lw"/>
${Z}${l !== 'short' && l !== 'open' ? '<path d="M470 40V62M470 118V140" class="lw"/>' : ''}
<text x="262" y="166" text-anchor="middle" class="sm">230 V / 115 V</text></svg>`;
}
function trDrawStatic() {
  const P = TRP, ps = [], i = []; for (let k = -60; k <= 60; k++) { const x = k / 60 * 2.8 * P.psiN; ps.push([trIm(x).i, x / P.psiN]); }
  TRBH = ps;
  const I = TR.load === 'z' ? TR.I : TR.load === 'short' ? 1 : 0, r = FAZ.tr.calc({ I, cf: TR.load === 'short' ? 0.01 : TR.cf, ch: TR.ch === 'cap' ? '-1' : '1', uk: P.uk * 100, ck: P.pk / P.uk, i0: P.i0 * 100, zm: 5 });
  const e = $('#tr-ph'); if (e) e.innerHTML = `<figure class="sch fz">${figSub(r.svg)}</figure><p class="dgn">${r.out.slice(0, 2).map(([a, b]) => sub(a) + ': ' + b).join(' · ')}</p>`;
  void i;
}
let TRBH = null;
function trDraw() {
  const P = TRP, m = TS.m, set = (k, v, d) => { const e = document.getElementById('trx-' + k); if (e) e.textContent = fmt(v, d); };
  set('U1', m.U1, 1); set('I1', m.I1, m.I1 < 10 ? 2 : 1); set('P1', m.P1, 0); set('U2', m.U2, 1); set('I2', m.I2, m.I2 < 10 ? 2 : 1); set('P2', m.P2, 0); set('ipk', m.ipk, 1); set('t', TS.t, 2);
  if (++dgTick % 3) return;
  trOsc();
  const bh = $('#tr-bh'); if (bh && TRBH) { const im = trIm(TS.pm).i; bh.innerHTML = miniPlot({ xr: [-60, 60], yr: [-2.8, 2.8], xl: 'i_μ [A]', yl: 'ψ / ψ_N', curves: [{ pts: TRBH, c: 'mc1' }], hl: [{ y: 1, c: 'mdl', t: 'ψ_N' }, { y: -1, c: 'mdl' }], pts: [{ x: im, y: TS.pm / P.psiN }], al: 'Magnetizační charakteristika' }); }
  const ev = $('#tr-ev2'); if (ev) ev.innerHTML = trEval();
}
function trEval() {
  const P = TRP, m = TS.m, rows = [];
  if (!TR.on || m.U1 < 1) return '<p class="dgn">Zapněte napájení.</p>';
  if (TR.load === 'open') {
    const cf = m.P1 / (m.U1 * m.I1), Ife = m.P1 / m.U1, Imu = Math.sqrt(Math.max(m.I1 * m.I1 - Ife * Ife, 0));
    rows.push(['Proud naprázdno i₀ = I₁/I₁N', fmt(m.I1 / P.I1N * 100, 2) + ' %'], ['Ztráty naprázdno P₀ (≈ ztráty v železe)', fmt(m.P1, 1) + ' W'], ['Účiník naprázdno cos φ₀', fmt(cf, 3)], ['R_Fe = U₁²/P₀', fmt(m.U1 * m.U1 / m.P1, 0) + ' Ω'], ['X_μ = U₁/I_μ', fmt(m.U1 / Imu, 0) + ' Ω'], ['Převod p = U₁/U₂', fmt(m.U1 / m.U2, 3)]);
  } else if (TR.load === 'short') {
    const Zk = m.U1 / m.I1, Rk = m.P1 / (m.I1 * m.I1), Xk = Math.sqrt(Math.max(Zk * Zk - Rk * Rk, 0));
    rows.push(['Napětí nakrátko u_k (přepočteno na I_N)', fmt(Zk * P.I1N / P.U1 * 100, 2) + ' %'], ['Ztráty nakrátko P_k při I_N', fmt(Rk * P.I1N * P.I1N, 1) + ' W'], ['cos φ_k', fmt(Rk / Zk, 3)], ['R_k, X_k (na primáru)', fmt(Rk, 3) + ' Ω, ' + fmt(Xk, 3) + ' Ω'], ['Proud I₁/I₁N', fmt(m.I1 / P.I1N, 2)], ['Ustálený zkratový proud při U_N = I_N/u_k', fmt(P.I1N / P.uk, 0) + ' A']);
  } else {
    const U20 = P.U2 * TR.U / 100;
    rows.push(['Účinnost η = P₂/P₁', fmt(m.P2 / m.P1 * 100, 1) + ' %'], ['Úbytek napětí Δu = (U₂₀ − U₂)/U₂₀', fmt((U20 - m.U2) / U20 * 100, 2) + ' %'], ['Ztráty P₁ − P₂', fmt(m.P1 - m.P2, 0) + ' W'], ['Zatížení I₂/I₂N', fmt(m.I2 / P.I2N, 2)], ['Účiník primáru cos φ₁', fmt(m.P1 / (m.U1 * m.I1), 3)]);
  }
  return `<table class="fzout">${rows.map(([a, b]) => `<tr><td>${sub(a)}</td><td>${b}</td></tr>`).join('')}</table><p class="dgn">Hodnoty jsou efektivní za poslední periodu; v přechodném ději (ráz) jsou orientační.</p>`;
}
function trOsc() {
  const cv = $('#tr-cv'); if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1; if (!W) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d'), col = labColors(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const o = TS.osc, N = o.n; if (N < 3) return; const st = (o.i - N + OSC_N) % OSC_N, at = j => (st + j) % OSC_N, tE = o.t[at(N - 1)], t0 = tE - TR.win;
  const pad = 8, X = t => pad + (W - 2 * pad) * (t - t0) / TR.win, Ym = H / 2, A = H / 2 - 16;
  c.strokeStyle = col.rule; c.lineWidth = 1; c.beginPath(); for (let k = 0; k <= 10; k++) { const x = pad + (W - 2 * pad) * k / 10; c.moveTo(x, 6); c.lineTo(x, H - 6); } c.moveTo(pad, Ym); c.lineTo(W - pad, Ym); c.stroke();
  const cl = { u1: col.mut, i1: col.red, i2: col.blu, psi: col.och }, P = TRP, info = [];
  for (const k of Object.keys(TR.chs).filter(k => TR.chs[k])) {
    let mx = 1e-9; for (let j = 0; j < N; j++) { const i = at(j); if (o.t[i] >= t0 && isFinite(o[k][i])) mx = Math.max(mx, Math.abs(o[k][i])); }
    if (k === 'psi') mx = Math.max(mx, P.psiN); if (k === 'u1') mx = Math.max(mx, P.U1 * Math.SQRT2 * 0.05);
    c.strokeStyle = cl[k]; c.lineWidth = k === 'u1' ? 1.4 : 2; c.setLineDash(k === 'u1' ? [5, 4] : []); c.beginPath(); let first = true;
    for (let j = 0; j < N; j++) { const i = at(j); if (o.t[i] < t0) continue; const v = o[k][i]; if (!isFinite(v)) { first = true; continue; } const x = X(o.t[i]), y = Ym - A * v / mx; if (first) c.moveTo(x, y); else c.lineTo(x, y); first = false; }
    c.stroke(); info.push(k === 'u1' ? `u₁ ±${fmt(mx, 0)} V` : k === 'psi' ? `ψ ±${fmt(mx / P.psiN, 2)} ψ_N` : `${k === 'i1' ? 'i₁' : 'i₂′'} ±${fmt(mx, mx < 10 ? 2 : 0)} A`);
  }
  c.setLineDash([]); c.fillStyle = col.mut; c.font = '12px Inter, sans-serif'; c.fillText(`${fmt(TR.win * 100, TR.win < 0.1 ? 1 : 0)} ms/díl · ${info.join(' · ')}`, pad + 2, H - 4);
}
function trLoop(ts) {
  trRaf = 0; if (tab !== 'lab' || LAB.m !== 'tr' || !$('#tr-cv')) { trLast = 0; return; }
  const dt = trLast ? Math.min(0.05, (ts - trLast) / 1000) : 0; trLast = ts;
  if (TR.run && dt > 0) trAdvance(dt * TR.sp);
  trDraw(); trRaf = requestAnimationFrame(trLoop);
}
function trStart() { if (!trRaf) { trLast = 0; trRaf = requestAnimationFrame(trLoop); } }
function trSetLoad() { TS.Z = trLoadZ(); TS.s[2] = 0; if (TS.Z) TS.s[1] = TS.pm; $('#tr-ctl').innerHTML = trCtlHTML(); $('#tr-sch').innerHTML = trSchSVG(); trDrawStatic(); }

/* ---------- trojfázový transformátor s nesouměrnou zátěží (fázorově, souměrné složky) ---------- */
const T3 = { con: 'Dyn', core: 'core', la: 100, lb: 30, lc: 0, cf: 1 };
const A3 = [Cx(1, 0), cpol(1, -120 * DEG), cpol(1, 120 * DEG)];
function c3solve(M, b) {   /* Gauss pro komplexní 3×3 */
  const a = M.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) { let p = i; for (let r = i + 1; r < 3; r++) if (cabs(a[r][i]) > cabs(a[p][i])) p = r; [a[i], a[p]] = [a[p], a[i]];
    for (let r = 0; r < 3; r++) if (r !== i) { const f = cdiv(a[r][i], a[i][i]); for (let c = i; c < 4; c++) a[r][c] = csub(a[r][c], cmul(f, a[i][c])); } }
  return [0, 1, 2].map(i => cdiv(a[i][3], a[i][i]));
}
function tr3Calc() {
  const zk = Cx(0.01, 0.04), zero = { Dyn: zk, Yzn: csc(zk, 0.25), Yyn: T3.core === 'core' ? Cx(0.05, 0.9) : Cx(0.3, 20) }[T3.con];   /* p.j. */
  const a = cpol(1, 120 * DEG), a2 = cpol(1, 240 * DEG), Am = [[Cx(1), Cx(1), Cx(1)], [Cx(1), a2, a], [Cx(1), a, a2]], Z = [zero, zk, zk];
  /* Zs = A diag(Z) A⁻¹, A⁻¹ = (1/3)[[1,1,1],[1,a,a²],[1,a²,a]] */
  const Ai = [[Cx(1), Cx(1), Cx(1)], [Cx(1), a, a2], [Cx(1), a2, a]].map(r => r.map(x => csc(x, 1 / 3)));
  const Zs = [0, 1, 2].map(i => [0, 1, 2].map(j => [0, 1, 2].reduce((s, k) => cadd(s, cmul(cmul(Am[i][k], Z[k]), Ai[k][j])), Cx(0))));
  const ph = Math.acos(T3.cf), ZL = [T3.la, T3.lb, T3.lc].map(x => x < 1 ? Cx(1e6, 0) : cpol(100 / x, ph));
  const M = Zs.map((r, i) => r.map((z, j) => i === j ? cadd(z, ZL[i]) : z)), I = c3solve(M, A3), V = I.map((x, i) => cmul(ZL[i], x));
  const In = cadd(cadd(I[0], I[1]), I[2]), V0 = csc(cadd(cadd(V[0], V[1]), V[2]), 1 / 3);
  return { I, V, In, V0, zero };
}
function tr3HTML() {
  const seg = (attr, cur, opts) => `<span class="seg">${opts.map(([k, t]) => `<button type="button" ${attr}="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</span>`;
  const sl = (id, l, a, b, st, v, u) => `<label class="lsl"><span><span>${sub(l)}</span> <b id="t3v-${id}">${fmt(v, st < 1 ? 2 : 0)} ${sub(u)}</b></span><input type="range" data-t3="${id}" min="${a}" max="${b}" step="${st}" value="${v}"></label>`;
  return `<h3 id="tr3">Trojfázový transformátor s nesouměrnou zátěží</h3><p>Rozvodný transformátor napájí na straně NN fázové zátěže proti nulovému vodiči. Ustálený stav se počítá souměrnými složkami: rozhoduje impedance pro netočivou (nulovou) složku, a ta závisí na zapojení a na jádře.</p>
<div class="fzgrid"><figure class="sch fz" id="t3-svg"></figure><div class="fzctl"><div class="lrow">${seg('data-t3c', T3.con, [['Dyn', 'Dyn'], ['Yzn', 'Yzn'], ['Yyn', 'Yyn']])}</div>
${T3.con === 'Yyn' ? `<div class="lrow">${seg('data-t3k', T3.core, [['core', 'trojsloupkové jádro'], ['bank', '3 jednofázové (skupina)']])}</div>` : ''}
${sl('la', 'Zatížení fáze a', 0, 150, 5, T3.la, '% I_N')}${sl('lb', 'Zatížení fáze b', 0, 150, 5, T3.lb, '% I_N')}${sl('lc', 'Zatížení fáze c', 0, 150, 5, T3.lc, '% I_N')}${sl('cf', 'Účiník zátěží', 0.1, 1, 0.05, T3.cf, '')}
<table class="fzout" id="t3-out"></table><p class="note" id="t3-note"></p></div></div>`;
}
function tr3Draw() {
  const e = $('#t3-svg'); if (!e) return; const r = tr3Calc();
  const V = [0, 1, 2].map(k => ({ a: Cx(0, 0), b: r.V[k], t: 'U_' + 'abc'[k], side: -1 })).concat([0, 1, 2].map(k => ({ a: Cx(0, 0), b: csc(A3[k], 1), c: 'kd' })));
  if (cabs(r.V0) > 0.005) V.push({ a: Cx(0, 0), b: r.V0, c: 'kor', t: 'U_0 (posun uzlu)', tc: 'sm' });
  r.I.forEach((x, k) => { if (cabs(x) > 0.01) V.push({ a: Cx(0, 0), b: csc(x, 0.5), c: 'kr', t: 'I_' + 'abc'[k], tc: 'sm' }); });
  e.innerHTML = figSub(phasorSVG(V, [], [], 'Fázová napětí sekundáru'));
  $('#t3-out').innerHTML = [['Napětí fází U_a, U_b, U_c', r.V.map(x => fmt(cabs(x) * 100, 1)).join(' / ') + ' %'], ['Posun uzlu U_0', fmt(cabs(r.V0) * 100, 1) + ' %'], ['Proud nulovým vodičem', fmt(cabs(r.In) * 100, 0) + ' % I_N'], ['Impedance pro nulovou složku Z_0', fmt(cabs(r.zero), 2) + ' p.j.']].map(([a, b]) => `<tr><td>${sub(a)}</td><td>${b}</td></tr>`).join('');
  $('#t3-note').innerHTML = sub(T3.con === 'Dyn' ? 'Dyn: proud nulové složky ze sekundáru se uzavře v trojúhelníku primáru, Z₀ ≈ Z_k. Napětí zůstávají téměř souměrná – proto je to běžné zapojení distribučních transformátorů.' : T3.con === 'Yzn' ? 'Yzn: lomená hvězda rozdělí proud fáze na dva sloupky, ampérzávity nulové složky se vyruší už na sekundáru, Z₀ je velmi malá.' : T3.core === 'bank' ? 'Yyn ze tří jednofázových: nulová složka toku má plnou cestu železem, Z₀ je velká (magnetizační) a jednofázová zátěž způsobí obrovský posun uzlu. Takto se zapojovat nesmí.' : 'Yyn s trojsloupkovým jádrem: tok nulové složky se uzavírá vzduchem a nádobou, Z₀ je asi 1 p.j. Posun uzlu je znatelný, nádoba se ohřívá; Yyn se proto smí zatěžovat nesouměrně jen omezeně (asi do 10 % I_N v nulovém vodiči).');
}
/* ---------- paralelní chod dvou transformátorů ---------- */
const TP = { sA: 100, sB: 100, ukA: 4, ukB: 6, dp: 0, hd: 0, L: 100, cf: 0.9 };
function trParCalc() {
  const S = TP.sA + TP.sB, zA = cmul(Cx(0.3, 1), Cx(TP.ukA / 100 / Math.hypot(0.3, 1) * S / TP.sA)), zB = cmul(Cx(0.3, 1), Cx(TP.ukB / 100 / Math.hypot(0.3, 1) * S / TP.sB));   /* p.j. na základ S_A + S_B */
  const EA = cpol(1 + TP.dp / 100, -TP.hd * 30 * DEG), EB = Cx(1, 0), ZL = TP.L > 0.5 ? cpol(100 / TP.L, Math.acos(TP.cf)) : Cx(1e6, 0);
  const yA = cdiv(Cx(1), zA), yB = cdiv(Cx(1), zB), yL = cdiv(Cx(1), ZL), V = cdiv(cadd(cmul(EA, yA), cmul(EB, yB)), cadd(cadd(yA, yB), yL));
  const IA = cdiv(csub(EA, V), zA), IB = cdiv(csub(EB, V), zB), Ic = cdiv(csub(EA, EB), cadd(zA, zB));
  return { V, IA, IB, Ic, S, kA: cabs(IA) * S / TP.sA, kB: cabs(IB) * S / TP.sB, cA: cabs(Ic) * S / TP.sA };
}
function trParHTML() {
  const sl = (id, l, a, b, st, v, u) => `<label class="lsl"><span><span>${sub(l)}</span> <b id="tpv-${id}">${fmt(v, st < 1 ? 1 : 0)} ${u}</b></span><input type="range" data-tp="${id}" min="${a}" max="${b}" step="${st}" value="${v}"></label>`;
  return `<h3 id="trpar">Paralelní chod dvou transformátorů</h3><p>Dva transformátory napájejí společnou zátěž. Zkuste, co udělá rozdílné u_k, rozdílný převod nebo rozdílný hodinový úhel.</p>
<div class="fzgrid"><figure class="sch fz" id="tp-svg"></figure><div class="fzctl">${sl('sA', 'Výkon S_A', 50, 400, 10, TP.sA, 'kVA')}${sl('sB', 'Výkon S_B', 50, 400, 10, TP.sB, 'kVA')}${sl('ukA', 'u_k A', 2, 12, 0.5, TP.ukA, '%')}${sl('ukB', 'u_k B', 2, 12, 0.5, TP.ukB, '%')}
${sl('dp', 'Rozdíl převodů (napětí naprázdno A proti B)', -5, 5, 0.5, TP.dp, '%')}${sl('hd', 'Rozdíl hodinových úhlů', 0, 6, 1, TP.hd, 'h')}${sl('L', 'Zatížení (součtu výkonů)', 0, 130, 5, TP.L, '%')}${sl('cf', 'Účiník zátěže', 0.2, 1, 0.05, TP.cf, '')}
<div id="tp-bars"></div><table class="fzout" id="tp-out"></table><p class="note" id="tp-note"></p></div></div>`;
}
function trParDraw() {
  const e = $('#tp-svg'); if (!e) return; const r = trParCalc();
  const s = 0.5, V = [{ a: Cx(0, 0), b: r.V, t: 'U (přípojnice)', side: -1 }, { a: Cx(0, 0), b: csc(r.IA, s), c: 'kr', t: 'I_A', tc: 'sm' }, { a: Cx(0, 0), b: csc(r.IB, s), c: 'kor', t: 'I_B', tc: 'sm' }];
  if (cabs(r.Ic) > 0.01) V.push({ a: Cx(0, 0), b: csc(r.Ic, s), c: 'kbl', t: 'I_vyr', tc: 'sm' });
  e.innerHTML = figSub(phasorSVG(V, [], [], 'Paralelní chod'));
  const bar = (t, k) => `<div class="dbr${k > 1.05 ? ' g' : ''}"><span>${t}</span><i><b style="width:${Math.min(k / 2, 1) * 100}%"></b></i><em>${fmt(k * 100, 0)} %</em></div>`;
  $('#tp-bars').innerHTML = `<div class="dbar"><p>Zatížení vůči vlastnímu jmenovitému výkonu</p>${bar('A', r.kA)}${bar('B', r.kB)}</div>`;
  $('#tp-out').innerHTML = [['Vyrovnávací proud naprázdno (vůči I_N A)', fmt(r.cA * 100, 0) + ' %'], ['Napětí přípojnice', fmt(cabs(r.V) * 100, 1) + ' %']].map(([a, b]) => `<tr><td>${sub(a)}</td><td>${b}</td></tr>`).join('');
  $('#tp-note').innerHTML = sub(TP.hd ? 'Různý hodinový úhel: napětí naprázdno se liší o ' + TP.hd * 30 + '°, vyrovnávací proud je řádově zkratový. Takové transformátory se paralelně spojit nesmějí.' : Math.abs(TP.ukA - TP.ukB) > 0.1 ? 'Zatížení se dělí nepřímo úměrně u_k (vztaženému na vlastní výkon): transformátor s menším u_k se přetíží dřív.' : TP.dp ? 'Rozdílný převod: i bez zátěže teče vyrovnávací proud, který zbytečně zatěžuje oba transformátory.' : 'Stejné u_k i převod: zatížení se dělí v poměru výkonů.');
}
/* ---------- ovládání ---------- */
document.addEventListener('click', e => {
  if (LAB.m !== 'tr' || tab !== 'lab') return;
  const t = e.target, b = t.closest('button'); if (!b) return;
  if (b.id === 'tr-on') { trSwitch(!TR.on); $('#tr-ctl').innerHTML = trCtlHTML(); }
  else if (b.id === 'tr-go') { TR.run = !TR.run; b.textContent = TR.run ? '❚❚ Pozastavit' : '▶ Pokračovat'; }
  else if (b.id === 'tr-re') { TR.on = false; trInit(); $('#tr-ev').innerHTML = ''; $('#tr-ctl').innerHTML = trCtlHTML(); }
  else if (b.dataset.trl) { TR.load = b.dataset.trl; trSetLoad(); }
  else if (b.dataset.trc) { TR.ch = b.dataset.trc; trSetLoad(); }
  else if (b.dataset.trp) { const [n, o] = TR_PRE[+b.dataset.trp]; const keepRem = o.rem; TR.on = false; trInit(); Object.assign(TR, o); TR.rem = keepRem; TS.pm = TR.rem * TRP.psiN; TS.s = [TS.pm, TS.pm, 0]; trSetLoad(); trLog('Pokus: ' + n); trSwitch(true); $('#tr-ctl').innerHTML = trCtlHTML(); }
  else if (b.dataset.t3c) { T3.con = b.dataset.t3c; trRerender3(); }
  else if (b.dataset.t3k) { T3.core = b.dataset.t3k; trRerender3(); }
});
function trRerender3() { const h = $('#tr3'), g = h.nextElementSibling.nextElementSibling; const tmp = document.createElement('div'); tmp.innerHTML = tr3HTML(); g.replaceWith(tmp.children[2]); tr3Draw(); }
document.addEventListener('input', e => {
  if (LAB.m !== 'tr' || tab !== 'lab') return; const t = e.target, d = t.dataset;
  if (d.tr) { TR[d.tr] = +t.value; const o = $('#trv-' + d.tr); if (o) o.innerHTML = fmt(+t.value, +t.step < 0.1 ? 2 : +t.step < 1 ? 1 : 0) + ' ' + sub(d.tr === 'U' ? '%' : d.tr === 'rem' ? '× ψ_N' : ''); if (d.tr === 'rem' && !TR.on) { TS.pm = TR.rem * TRP.psiN; } if (d.tr === 'I' || d.tr === 'cf') { TS.Z = trLoadZ(); trDrawStatic(); } }
  else if (d.t3) { T3[d.t3] = +t.value; $('#t3v-' + d.t3).innerHTML = fmt(+t.value, +t.step < 1 ? 2 : 0) + ' ' + sub(d.t3 === 'cf' ? '' : '% I_N'); tr3Draw(); }
  else if (d.tp) { TP[d.tp] = +t.value; $('#tpv-' + d.tp).textContent = fmt(+t.value, +t.step < 1 ? 1 : 0) + ' ' + ({ sA: 'kVA', sB: 'kVA', ukA: '%', ukB: '%', dp: '%', hd: 'h', L: '%', cf: '' })[d.tp]; trParDraw(); }
});
document.addEventListener('change', e => {
  if (LAB.m !== 'tr' || tab !== 'lab') return; const t = e.target;
  if (t.id === 'tr-sp') TR.sp = +t.value; else if (t.id === 'tr-ang') TR.ang = t.value; else if (t.id === 'tr-w') TR.win = +t.value; else if (t.dataset.trch) TR.chs[t.dataset.trch] = t.checked;
});
