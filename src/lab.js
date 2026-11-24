/* ===== Laboratoř: motor simulovaný živě, bez časového omezení ===== */
const LAB = { m: 'am', sp: 0.2, J: 1, load: 0, lt: 'react', run: true };
const LAB_AM = { src: 'sit', on: false, yd: 'D', rev: false, dcb: false, Rp: 0, fset: 50, ramp: 25 };
const LAB_DC = { mode: 'u', on: false, U: 440, Rp: 0, kf: 100, nset: 1500, Imax: 200 };
const LAB_SM = { on: false, exc: false, Ui: 1.2 };
let L = null, labRaf = 0, labLast = 0, labCol = null, labGR = {}, labLog = [];

function niceUp(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }

/* ---------- modely ---------- */
function labInit() {
  const NB = 1500;
  if (LAB.m === 'am') {
    const P = { ...MODS.am.def }; P.J = MODS.am.def.J * LAB.J;
    L = { m: 'am', P, d: imDerived(P), s: new Float64Array(5), th: 0, f: 0, MN: P.MN };
  } else if (LAB.m === 'dc') {
    const P = { ...MODS.dc.def, mode: 'casc' }; P.J = MODS.dc.def.J * LAB.J; Object.assign(P, MODS.dc.autotune(P));
    const d = dcDerived(P);
    L = { m: 'dc', P, d, s: new Float64Array(4), nr: 0, MN: d.MN, ci: mkPI(P.Kpi, P.Tii / 1e3), cw: mkPI(P.Kpw, P.Tiw / 1e3) };
    L.s[2] = d.ifN;                                                     /* buzení je nabuzené od začátku */
  } else {
    /* synchronní motor s vyniklými póly a tlumičem, poměrné jednotky, 4 póly, 50 Hz */
    const P = { U: 1, Xd: 1.0, Xq: 0.7, TN: 1.5 * LAB.J, MD: 1.5, sD: 0.3, f: 50, pp: 2 };
    L = { m: 'sm', P, s: new Float64Array(1), nu: 0, MN: 1, ws: TAU * P.f / P.pp };
  }
  Object.assign(L, { t: 0, thv: 0, fang: 0, fmag: 0, NB, bi: 0, bn: 0, nextS: 0 });
  L.buf = { t: new Float64Array(NB), n: new Float64Array(NB), I: new Float64Array(NB), M: new Float64Array(NB) };
  L.meas = { U: 0, I: 0, n: 0, M: 0, b: 0, x1: 0, x2: 0, x3: 0, x4: 0 };
  L.K = [0, 1, 2, 3].map(() => new Float64Array(L.s.length)); L.tmp = new Float64Array(L.s.length);
  labLog = [];
}
const labWb = () => L.m === 'am' ? L.d.Ws : L.m === 'dc' ? L.d.Wn : L.ws;
function labMz(W) {                                                      /* aktivní a ventilátorová zátěž; pasivní = null */
  const M0 = LAB.load / 100 * L.MN, Wb = labWb();
  if (!M0) return 0;
  if (LAB.lt === 'fan') return M0 * (W / Wb) * Math.abs(W / Wb);
  if (LAB.lt === 'pot') return M0;
  return null;
}
function passive(Mm, W, M0) { if (Math.abs(W) > 1e-3 * labWb()) return M0 * Math.sign(W); return clamp(Mm, -M0, M0); }
function rk4s(s, dt, fn, K, tmp) {
  const n = s.length; fn(s, K[0]);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + 0.5 * dt * K[0][i]; fn(tmp, K[1]);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + 0.5 * dt * K[1][i]; fn(tmp, K[2]);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + dt * K[2][i]; fn(tmp, K[3]);
  for (let i = 0; i < n; i++) s[i] += dt / 6 * (K[0][i] + 2 * K[1][i] + 2 * K[2][i] + K[3][i]);
}

function stepAM(dt) {
  const P = L.P, d = L.d, s = L.s, A = LAB_AM, pp = P.pp, R1 = P.R1, R2 = P.R2 + A.Rp, { Lh, L1, L2, D } = d;
  let ua = 0, ub = 0, mode = 'off', kv = 1;
  if (A.on && A.dcb) { mode = 'dc'; ua = 40; L.f = 0; }
  else if (A.on && A.src === 'sit') { mode = 'ac'; kv = A.yd === 'Y' ? 1 / SQ3 : 1; L.f = A.rev ? -P.fN : P.fN; }
  else if (A.on) { mode = 'ac'; const r = A.ramp * dt, tg = A.rev ? -A.fset : A.fset; L.f += clamp(tg - L.f, -r, r); }
  else if (A.src === 'mf') L.f = 0;
  if (mode === 'ac') {
    L.th += TAU * L.f * dt;
    const U = A.src === 'sit' ? d.Um * kv : Math.min(P.Udc / SQ3, P.U0 + (d.Um - P.U0) * Math.min(Math.abs(L.f), P.fN) / P.fN);
    ua = U * Math.cos(L.th); ub = U * Math.sin(L.th);
  }
  const Mz0 = LAB.load / 100 * L.MN;
  if (mode === 'off') {                                                  /* stykač rozepnut: i₁ = 0, rotorový tok doznívá */
    const W = s[4], tau = L2 / R2, w = pp * W, a = s[2], b = s[3];
    s[2] += dt * (-a / tau - w * b); s[3] += dt * (-b / tau + w * a); s[0] = Lh / L2 * s[2]; s[1] = Lh / L2 * s[3];
    let Mz = labMz(W); if (Mz === null) Mz = passive(0, W, Mz0);
    const Wn = W + dt * (-Mz - P.B * W) / P.J; s[4] = (LAB.lt === 'react' && Mz0 && Math.sign(Wn) !== Math.sign(W)) ? 0 : Wn;
    return { M: 0, i: 0, u: 0 };
  }
  const fn = (y, o) => {
    const i1a = (L2 * y[0] - Lh * y[2]) / D, i1b = (L2 * y[1] - Lh * y[3]) / D, i2a = (L1 * y[2] - Lh * y[0]) / D, i2b = (L1 * y[3] - Lh * y[1]) / D, w = pp * y[4];
    o[0] = ua - R1 * i1a; o[1] = ub - R1 * i1b; o[2] = -R2 * i2a - w * y[3]; o[3] = -R2 * i2b + w * y[2];
    const Mm = 1.5 * pp * (y[0] * i1b - y[1] * i1a) - P.B * y[4];
    let Mz = labMz(y[4]); if (Mz === null) Mz = passive(Mm, y[4], Mz0);
    o[4] = (Mm - Mz) / P.J;
  };
  rk4s(s, dt, fn, L.K, L.tmp);
  const i1a = (L2 * s[0] - Lh * s[2]) / D, i1b = (L2 * s[1] - Lh * s[3]) / D;
  return { M: 1.5 * pp * (s[0] * i1b - s[1] * i1a), i: Math.hypot(i1a, i1b) * kv, u: Math.hypot(ua, ub) / kv };
}
function stepDC(dt) {
  const P = L.P, d = L.d, s = L.s, C = LAB_DC, reg = C.mode === 'reg';    /* s: i, Ω, i_f, u měniče */
  const uf = P.UfN * C.kf / 100;
  let ucmd = 0;
  if (C.on && reg) {
    const r = toRad(1500) * dt; L.nr += clamp(toRad(C.nset) - L.nr, -r, r);
    const iref = pi(L.cw, L.nr - s[1], -C.Imax, C.Imax, dt);
    ucmd = pi(L.ci, iref - s[0], -P.Umax, P.Umax, dt, d.xiN * s[2] / d.ifN * s[1]);
  } else if (C.on) ucmd = C.U;
  else { L.ci.x = 0; L.cw.x = 0; L.nr = s[1]; s[3] = 0; }
  const Rt = P.Rd + (reg ? 0 : C.Rp), Mz0 = LAB.load / 100 * L.MN;
  const fn = (y, o) => {
    const xi = d.xiN * y[2] / d.ifN, u = reg ? y[3] : ucmd;
    o[0] = C.on ? (u - Rt * y[0] - xi * y[1]) / d.Ld : 0;
    const Mm = xi * y[0] - P.B * y[1];
    let Mz = labMz(y[1]); if (Mz === null) Mz = passive(Mm, y[1], Mz0);
    o[1] = (Mm - Mz) / P.J; o[2] = (uf - P.Rf * y[2]) / P.Lf; o[3] = reg ? (ucmd - y[3]) / (P.tmu / 1e3) : 0;
  };
  if (!C.on) s[0] = 0;
  rk4s(s, dt, fn, L.K, L.tmp);
  const xi = d.xiN * s[2] / d.ifN, u = reg ? s[3] : ucmd;
  return { M: xi * s[0], i: s[0], u: C.on ? u - (reg ? 0 : C.Rp) * s[0] : 0, ui: xi * s[1], if: s[2] };
}
function smCur(P, b, Ui) {                                               /* ustálený fázor proudu (motor, R = 0) */
  const Iq = -P.U * Math.sin(b) / P.Xq, Id = (Ui - P.U * Math.cos(b)) / P.Xd;
  const qr = Math.cos(-b), qi = Math.sin(-b), dr = Math.cos(-b - Math.PI / 2), di = Math.sin(-b - Math.PI / 2);
  const Ir = Id * dr + Iq * qr, Ii = Id * di + Iq * qi;                 /* generátorová konvence */
  return { I: Math.hypot(Ir, Ii), P: -P.U * Ir, Q: P.U * Ii };          /* P, Q odebírané ze sítě */
}
function stepSM(dt) {
  const P = L.P, S = LAB_SM, w1 = TAU * P.f, Ui = S.on && S.exc ? S.Ui : 0, Mz0 = LAB.load / 100;
  L.fang += L.ws * dt;
  const b = Math.atan2(Math.sin(P.pp * (L.fang - L.thv)), Math.cos(P.pp * (L.fang - L.thv))), sl = 1 - L.nu;
  let M = 0;
  if (S.on) M = smTorque(P, b, Ui) + smDamper(P, sl);
  let Mz = labMz(L.nu * L.ws); if (Mz === null) Mz = passive(M, L.nu * L.ws, Mz0);
  const nn = L.nu + dt * (M - Mz) / P.TN;
  L.nu = (LAB.lt === 'react' && Mz0 && !S.on && Math.sign(nn) !== Math.sign(L.nu)) ? 0 : nn;
  const c = S.on ? smCur(P, b, Ui) : { I: 0, P: 0, Q: 0 };
  return { M, b, Ui, c, sl };
}
function labAdvance(simT) {
  const dt = L.m === 'am' ? 5e-5 : L.m === 'dc' ? 2e-5 : 1e-4, cap = L.m === 'am' ? 3000 : 6000;
  const n = Math.min(Math.round(simT / dt), cap); let r = null;
  for (let k = 0; k < n; k++) {
    r = L.m === 'am' ? stepAM(dt) : L.m === 'dc' ? stepDC(dt) : stepSM(dt);
    const W = L.m === 'am' ? L.s[4] : L.m === 'dc' ? L.s[1] : L.nu * L.ws;
    L.thv += W * dt; L.t += dt;
    if (L.m === 'am') { const p = Math.hypot(L.s[0], L.s[1]); if (p > 1e-4) L.fang = Math.atan2(L.s[1], L.s[0]) / L.P.pp; L.fmag = p; }
    if (L.t >= L.nextS) {
      L.nextS = L.t + 0.002; const b = L.buf, i = L.bi;
      b.t[i] = L.t; b.n[i] = toRpm(W); b.I[i] = L.m === 'am' ? r.i * Math.SQRT1_2 : L.m === 'dc' ? r.i : r.c.I; b.M[i] = r.M;
      L.bi = (i + 1) % L.NB; L.bn = Math.min(L.NB, L.bn + 1);
    }
  }
  if (!r) return;
  const m = L.meas, W = L.m === 'am' ? L.s[4] : L.m === 'dc' ? L.s[1] : L.nu * L.ws;
  m.n = toRpm(W); m.M = r.M;
  if (L.m === 'am') {
    m.U = r.u * Math.sqrt(1.5); m.I = r.i * Math.SQRT1_2; m.x1 = L.f;
    const ns = 60 * L.f / L.P.pp; m.x2 = Math.abs(ns) > 1 && LAB_AM.on && !LAB_AM.dcb ? (ns - m.n) / ns * 100 : NaN; m.x3 = r.M * W / 1e3;
  } else if (L.m === 'dc') { m.U = r.u; m.I = r.i; m.x1 = r.ui; m.x2 = r.if; m.x3 = r.u * r.i / 1e3; }
  else {
    const syn = LAB_SM.on && Math.abs(r.sl) < 0.01;                       /* fázor platí jen v synchronizmu */
    m.I = r.c.I; m.b = LAB_SM.on ? r.b * 180 / Math.PI : NaN; m.x1 = r.Ui; m.x2 = syn ? r.c.P : NaN; m.x3 = syn ? r.c.Q : NaN;
    m.x4 = syn && r.c.I > 0.01 ? r.c.P / Math.hypot(r.c.P, r.c.Q) : NaN; m.sl = r.sl;
  }
}

/* ---------- kreslení ---------- */
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
function labGaugeInit() {
  labGR = L.m === 'am' ? { U: [0, 500], I: [0, 100], n: [-2000, 2000], M: [-100, 200] }
    : L.m === 'dc' ? { U: [0, 500], I: [-250, 250], n: [-2000, 2000], M: [-500, 500] }
    : { I: [0, 3], n: [0, 2000], M: [-2, 3], b: [-180, 180] };
}
function labNeedle(k, v) {
  let [lo, hi] = labGR[k];
  if (k !== 'b' && isFinite(v) && (v > hi || v < lo)) {                  /* stupnice se při překročení rozšíří */
    if (v > hi) hi = niceUp(v * 1.1); if (v < lo) lo = -niceUp(-v * 1.1); labGR[k] = [lo, hi];
    const w = document.getElementById('gw-' + k); if (w) w.innerHTML = gaugeSVG(k, lo, hi);
  }
  const e = document.getElementById('nd-' + k); if (!e) return;
  const a = -125 + ((isFinite(v) ? clamp(v, lo, hi) : lo) - lo) / (hi - lo) * 250; e.setAttribute('transform', `rotate(${a.toFixed(2)} 110 112)`);
}
function labBench() {
  const dc = L.m === 'dc', sm = L.m === 'sm', A = LAB_AM, C = LAB_DC;
  const src = dc ? (C.mode === 'reg' ? ['Usměrňovač', 'řízený, kaskádní regulace'] : ['Zdroj', 'stejnosměrný 0–500 V']) : sm ? ['Síť', 'tvrdá, 50 Hz'] : (A.src === 'sit' ? ['Síť', '3 × 400 V, 50 Hz'] : ['Měnič', 'frekvence U/f']);
  let g = `<defs><marker id="lah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="lkf"/></marker></defs>`;
  g += `<rect x="14" y="70" width="110" height="140" rx="10" class="lbx"/><text x="69" y="132" text-anchor="middle" class="lb">${src[0]}</text><text x="69" y="152" text-anchor="middle" class="ls">${src[1]}</text>`;
  g += `<path d="M124 100H170M206 100H300M124 180H300" class="lw"/>`;
  g += `<g id="lab-sw"><line x1="170" y1="100" x2="204" y2="84" class="lw2"/></g><circle cx="170" cy="100" r="3.5" class="lkf"/><circle cx="206" cy="100" r="3.5" class="lkf"/><text x="188" y="72" text-anchor="middle" class="ls">${dc ? 'vypínač' : 'stykač'}</text>`;
  g += `<circle cx="240" cy="100" r="17" class="lbx"/><text x="240" y="106" text-anchor="middle" class="lb">A</text>`;
  g += `<path d="M272 100V122M272 158V180" class="lw"/><circle cx="272" cy="140" r="17" class="lbx"/><text x="272" y="146" text-anchor="middle" class="lb">V</text>`;
  g += `<text x="300" y="92" text-anchor="end" class="ls">${dc ? 'kotva' : '3 fáze'}</text>`;
  const cx = 455, cy = 140;
  g += `<path d="M300 100H${cx - 128}M300 180H${cx - 128}" class="lw"/>`;
  g += `<circle cx="${cx}" cy="${cy}" r="128" class="lfe"/><circle cx="${cx}" cy="${cy}" r="${dc ? 96 : 92}" class="lgap"/>`;
  if (dc) {
    g += `<path d="M${cx - 30} ${cy - 127}h60v32l14 4a92 92 0 0 0 -88 0l14 -4z" class="lfe2"/><path d="M${cx - 30} ${cy + 127}h60v-32l14 -4a92 92 0 0 1 -88 0l14 4z" class="lfe2"/>`;
    g += `<text x="${cx}" y="${cy - 102}" text-anchor="middle" class="lpole">N</text><text x="${cx}" y="${cy + 114}" text-anchor="middle" class="lpole">S</text>`;
  } else for (let i = 0; i < 24; i++) { const a = i * 15 + 7.5; g += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - 5}" y="${cy - 122}" width="10" height="26" rx="2" class="lph${Math.floor(i / 2) % 3}"/></g>`; }
  let rot;
  if (sm) {
    rot = `<circle cx="${cx}" cy="${cy}" r="44" class="lrot"/>`;
    for (let k = 0; k < 4; k++) rot += `<g transform="rotate(${k * 90} ${cx} ${cy})"><path d="M${cx - 20} ${cy - 40}h40v-26l16 -6a88 88 0 0 0 -72 0l16 6z" class="lfe2"/><rect x="${cx - 32}" y="${cy - 62}" width="12" height="22" rx="2" class="lcu"/><rect x="${cx + 20}" y="${cy - 62}" width="12" height="22" rx="2" class="lcu"/><text x="${cx}" y="${cy - 58}" text-anchor="middle" class="lpole">${k % 2 ? 'S' : 'N'}</text></g>`;
    rot += `<circle cx="${cx}" cy="${cy}" r="18" class="lshaft"/>`;
  } else {
    rot = `<circle cx="${cx}" cy="${cy}" r="${dc ? 90 : 86}" class="lrot"/>`; const nb = dc ? 16 : 22;
    for (let i = 0; i < nb; i++) rot += `<g transform="rotate(${i * 360 / nb} ${cx} ${cy})"><rect x="${cx - 4}" y="${cy - (dc ? 86 : 80)}" width="8" height="${dc ? 18 : 12}" rx="2" class="${dc ? 'lcu' : 'lal'}"/></g>`;
    if (dc) rot += `<circle cx="${cx}" cy="${cy}" r="40" class="lcomm"/>` + Array.from({ length: 16 }, (_, i) => `<line x1="${cx}" y1="${cy - 40}" x2="${cx}" y2="${cy - 26}" transform="rotate(${i * 22.5} ${cx} ${cy})" class="lw"/>`).join('');
    rot += `<rect x="${cx - 3}" y="${cy - 84}" width="6" height="60" rx="3" class="lmark"/><circle cx="${cx}" cy="${cy}" r="18" class="lshaft"/>`;
  }
  g += `<g id="lab-rot">${rot}</g>`;
  if (dc) g += `<rect x="${cx - 52}" y="${cy - 9}" width="14" height="18" rx="2" class="lbrush"/><rect x="${cx + 38}" y="${cy - 9}" width="14" height="18" rx="2" class="lbrush"/>`;
  g += `<g id="lab-fld"><line x1="${cx}" y1="${dc ? cy - 66 : cy + 66}" x2="${cx}" y2="${dc ? cy + 70 : cy - 84}" class="lfld" marker-end="url(#lah)"/></g>`;
  g += `<rect x="610" y="92" width="136" height="96" rx="10" class="lbx"/><text x="678" y="116" text-anchor="middle" class="lb">Zátěž (brzda)</text><text x="678" y="140" text-anchor="middle" class="ls" id="lab-mz">M_z = 0</text><text x="678" y="162" text-anchor="middle" class="ls" id="lab-st"></text>`;
  g += `<path d="M${cx + 128} 140H610" class="lshl"/>`;
  return `<svg viewBox="0 0 760 280" class="bench" role="img" aria-label="Zkušební stanoviště: zdroj, ${dc ? 'vypínač' : 'stykač'}, ampérmetr, voltmetr, motor v řezu a zátěž">${g}</svg>`;
}
const tg = (id, on, t) => `<button type="button" class="btn tgl" data-lt="${id}" aria-pressed="${!!on}">${t}</button>`;
const sl = (id, l, min, max, st, v, u) => `<label class="lsl"><span><span>${sub(l)}</span> <b id="lv-${id}">${fmt(v, st < 1 ? (st < 0.1 ? 2 : 1) : 0)} ${sub(u)}</b></span><input type="range" data-ls="${id}" min="${min}" max="${max}" step="${st}" value="${v}"></label>`;
function labCtlHTML() {
  if (L.m === 'am') {
    const A = LAB_AM;
    return `<div class="lgrp"><p class="lgh">Napájení</p><div class="lrow"><span class="seg">${[['sit', 'Síť 400 V'], ['mf', 'Měnič frekvence']].map(([k, t]) => `<button type="button" data-lsrc="${k}" aria-pressed="${A.src === k}">${t}</button>`).join('')}</span></div>
<div class="lrow">${tg('on', A.on, A.on ? 'Vypnout stykač' : 'Zapnout stykač')}${A.src === 'sit' ? tg('yd', A.yd === 'Y', A.yd === 'Y' ? 'Hvězda (přepnout na D)' : 'Trojúhelník (přepnout na Y)') : ''}${tg('rev', A.rev, 'Reverzace (2 fáze)')}${tg('dcb', A.dcb, 'Stejnosměrné brzdění')}</div>
${A.src === 'mf' ? sl('fset', 'Žádaná frekvence', 0, 80, 1, A.fset, 'Hz') + sl('ramp', 'Rampa frekvence', 5, 200, 5, A.ramp, 'Hz/s') : ''}${sl('Rp', 'Odpor v rotoru R_p (kroužkový motor)', 0, 4, 0.1, A.Rp, 'Ω')}</div>`;
  }
  if (L.m === 'sm') {
    const S = LAB_SM;
    return `<div class="lgrp"><p class="lgh">Napájení a buzení</p><div class="lrow">${tg('on', S.on, S.on ? 'Odpojit od sítě' : 'Připojit na síť')}${tg('exc', S.exc, S.exc ? 'Buzení zapnuto' : 'Buzení vypnuto')}</div>
${sl('Ui', 'Napětí od buzení U_i (~ I_f)', 0, 2.5, 0.05, S.Ui, 'p.j.')}</div>`;
  }
  const C = LAB_DC;
  return `<div class="lgrp"><p class="lgh">Napájení kotvy</p><div class="lrow"><span class="seg">${[['u', 'Zdroj napětí'], ['reg', 'Regulace rychlosti']].map(([k, t]) => `<button type="button" data-lmode="${k}" aria-pressed="${C.mode === k}">${t}</button>`).join('')}</span>${tg('on', C.on, C.on ? 'Vypnout' : 'Zapnout')}</div>
${C.mode === 'u' ? sl('U', 'Napětí zdroje U', 0, 500, 5, C.U, 'V') + sl('Rp', 'Předřadný odpor R_p', 0, 5, 0.1, C.Rp, 'Ω') : sl('nset', 'Žádané otáčky n*', -2000, 2000, 50, C.nset, 'ot/min') + sl('Imax', 'Omezení proudu I_max', 50, 300, 10, C.Imax, 'A')}
${sl('kf', 'Budicí napětí (buzení)', 0, 100, 5, C.kf, '% U_fN')}</div>`;
}
function labTips() {
  if (L.m === 'sm') return `<ul class="ltips"><li>Asynchronní rozběh: připojte na síť bez buzení. Moment dává tlumicí klec, motor se rozběhne těsně pod synchronní otáčky.</li><li>Pak zapněte buzení: rotor „zaskočí“ do synchronizmu, skluz je nula a zátěžný úhel β se ustálí.</li><li>Zvyšujte zátěž: roste β (rotor se víc zpožďuje za polem). Nad statickou mezí stroj vypadne ze synchronizmu.</li><li>Měňte buzení: při stejné zátěži se mění proud a účiník (V-křivka); přebuzený motor dodává jalový výkon (Q &lt; 0).</li><li>Skoková změna zátěže vyvolá kývání β, tlumené klecí.</li><li>Šipka ukazuje točivé pole statoru, rotor s póly N/S se točí za ním o β/p.</li></ul>`;
  return L.m === 'am' ? `<ul class="ltips"><li>Zapněte stykač: proud vyskočí na 5–7× I_N, moment v prvních periodách kmitá, pak se ustálí skluz.</li><li>Přidejte zátěž: skluz a proud rostou. Nad momentem zvratu se motor zastaví.</li><li>Rozběh Y–D: přepněte na hvězdu, zapněte, po rozběhu přepněte na trojúhelník (druhý proudový ráz).</li><li>Reverzace za chodu = brzdění protiproudem; v nule vypněte, jinak se rozběhne opačně.</li><li>Stejnosměrné brzdění: pole stojí (šipka se nehýbe), rotor v něm brzdí.</li><li>Měnič: frekvence roste rampou, pole se točí pomalu a proud zůstává malý.</li></ul>`
    : `<ul class="ltips"><li>Buzení je od začátku nabuzené. Stáhněte ho na nulu a zpět: budicí proud se mění s časovou konstantou L_f/R_f = 1 s, bez buzení motor nemá moment.</li><li>Zapněte na plné napětí bez odporu: velký proudový ráz. S R_p je menší; po jeho zmenšení proud krátce vyskočí.</li><li>Snižte buzení: motor zrychlí (odbuzování), proud krátce naroste.</li><li>Snižte napětí pod indukované: proud změní smysl a motor brzdí rekuperačně.</li><li>Regulace rychlosti: proud drží omezení, otáčky sledují rampu, po zatížení se vrátí na žádanou hodnotu.</li></ul>`;
}
function renderLab(el) {
  if (!L || L.m !== LAB.m) { labInit(); labGaugeInit(); }
  const dc = L.m === 'dc', sm = L.m === 'sm';
  const meters = sm ? [['I', 'Ampérmetr: proud (p.j.)', 'p.j.'], ['n', 'Otáčkoměr', 'ot/min'], ['M', 'Momentoměr: moment motoru', 'p.j.'], ['b', 'Zátěžný úhel β', '°']]
    : [['U', dc ? 'Voltmetr: napětí na kotvě' : 'Voltmetr: napětí (ef., sdružené)', 'V'], ['I', dc ? 'Ampérmetr: proud kotvy' : 'Ampérmetr: proud (ef.)', 'A'], ['n', 'Otáčkoměr', 'ot/min'], ['M', 'Momentoměr: moment motoru', 'N·m']];
  const extra = sm ? [['x1', 'Napětí od buzení U_i', 'p.j.'], ['x2', 'Činný příkon P', 'p.j.'], ['x3', 'Jalový příkon Q', 'p.j.'], ['x4', 'Účiník cos φ', ''], ['t', 'Čas simulace', 's']]
    : dc ? [['x1', 'Indukované napětí U_i', 'V'], ['x2', 'Budicí proud I_f', 'A'], ['x3', 'Příkon kotvy U·I', 'kW'], ['t', 'Čas simulace', 's']] : [['x1', 'Frekvence f₁', 'Hz'], ['x2', 'Skluz s', '%'], ['x3', 'Výkon M·Ω', 'kW'], ['t', 'Čas simulace', 's']];
  el.innerHTML = `<div class="wrap lab"><h2>Laboratoř: motor naživo</h2><p class="lead">Motor se počítá průběžně a běží, dokud ho nevypnete. Za chodu můžete přepínat napájení, zátěž i buzení. Ručky ukazují okamžité hodnoty${sm ? '' : ' (u střídavého motoru efektivní)'}; červená šipka je osa magnetického pole${sm ? ' statoru' : ''}, bílý pruh značka na rotoru.</p>
<div class="lbar">
<label>Motor<select id="lb-m">${[['am', 'asynchronní 400 V'], ['dc', 'stejnosměrný cize buzený 440 V'], ['sm', 'synchronní s vyniklými póly']].map(([k, t]) => `<option value="${k}"${L.m === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label>Zpomalení<select id="lb-sp">${[[1, 'skutečný čas'], [0.5, '2×'], [0.2, '5×'], [0.1, '10×'], [0.05, '20×'], [0.02, '50×']].map(([v, t]) => `<option value="${v}"${+v === LAB.sp ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label>Setrvačnost<select id="lb-J">${[0.5, 1, 2, 4].map(v => `<option value="${v}"${v === LAB.J ? ' selected' : ''}>${fmt(v, 1)}× J</option>`).join('')}</select></label>
<span class="lrun"><button type="button" class="btn big" id="lb-go">${LAB.run ? '❚❚ Pozastavit' : '▶ Pokračovat'}</button><button type="button" class="btn" id="lb-re">↺ Znovu (motor v klidu)</button></span>
</div>
<div class="lctl"><div id="lb-ctl">${labCtlHTML()}</div>
<div class="lgrp"><p class="lgh">Zátěž</p><div class="lrow"><span class="seg">${[['react', 'tření (pasivní)'], ['pot', 'jeřáb (aktivní)'], ['fan', 'ventilátor']].map(([k, t]) => `<button type="button" data-llt="${k}" aria-pressed="${LAB.lt === k}">${t}</button>`).join('')}</span></div>${sl('load', 'Zátěžný moment', 0, 150, 5, LAB.load, '% M_N')}</div></div>
<div class="lstage">${labBench()}</div>
<div class="gauges">${meters.map(([k, t, u]) => `<div class="meter"><p>${t}</p><div id="gw-${k}">${gaugeSVG(k, ...labGR[k])}</div><div class="lcd"><span id="lcd-${k}">0</span><small>${u}</small></div></div>`).join('')}</div>
<div class="lcds">${extra.map(([k, t, u]) => `<div class="meter sm"><p>${sub(t)}</p><div class="lcd"><span id="lcx-${k}">0</span><small>${u}</small></div></div>`).join('')}</div>
<div class="lchart"><canvas id="lb-cv" aria-label="Průběh otáček, proudu a momentu za poslední 3 sekundy"></canvas><p class="note">Poslední 3 s simulace: <span class="k-n">■ otáčky</span> <span class="k-i">■ proud</span> <span class="k-m">■ moment</span> (každá veličina ve stupnici svého měřáku)</p></div>
<div class="cols2"><div><h3>Co zkusit</h3>${labTips()}</div><div><h3>Záznam</h3><ol id="lb-ev" class="lev"></ol></div></div></div>`;
  labCol = null; labLogDraw(); labDraw(); labStartLoop();
}
function labLogAdd(t) { labLog.unshift(`<li class="done"><b>${fmt(L.t, 2)} s</b> ${t}</li>`); labLog = labLog.slice(0, 10); labLogDraw(); }
function labLogDraw() { const e = $('#lb-ev'); if (e) e.innerHTML = labLog.join('') || '<li>Zatím nic; zapněte motor.</li>'; }
function labColors() {
  if (labCol) return labCol;
  const s = document.createElement('span'); s.style.display = 'none'; document.body.appendChild(s);
  const c = n => { s.style.color = `var(${n})`; return getComputedStyle(s).color; };
  labCol = { rule: c('--rule'), mut: c('--mut'), red: c('--red'), blu: c('--blu'), och: c('--och') }; s.remove();
  return labCol;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { labCol = null; });
function labDraw() {
  if (!L || !$('#lab-rot')) return;
  const m = L.meas, dc = L.m === 'dc', sm = L.m === 'sm';
  const set = (id, v, d) => { const e = document.getElementById(id); if (e) e.textContent = isFinite(v) ? fmt(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v, d) : '–'; };
  const keys = sm ? ['I', 'n', 'M', 'b'] : ['U', 'I', 'n', 'M'];
  for (const k of keys) { labNeedle(k, m[k]); set('lcd-' + k, m[k], sm ? (k === 'n' || k === 'b' ? 0 : 2) : k === 'n' ? 0 : k === 'M' ? 1 : Math.abs(m[k]) < 100 ? 1 : 0); }
  if (sm) { set('lcx-x1', m.x1, 2); set('lcx-x2', m.x2, 2); set('lcx-x3', m.x3, 2); set('lcx-x4', m.x4, 3); }
  else if (dc) { set('lcx-x1', m.x1, 0); set('lcx-x2', m.x2, 2); set('lcx-x3', m.x3, 1); } else { set('lcx-x1', m.x1, 1); set('lcx-x2', m.x2, 1); set('lcx-x3', m.x3, 1); }
  set('lcx-t', L.t, 1);
  $('#lab-rot').setAttribute('transform', `rotate(${(-L.thv * 180 / Math.PI % 360).toFixed(2)} 455 140)`);
  const fl = $('#lab-fld');
  if (dc) fl.style.opacity = Math.min(1, L.s[2] / L.d.ifN).toFixed(2);
  else if (sm) { fl.setAttribute('transform', `rotate(${(-L.fang * 180 / Math.PI % 360).toFixed(2)} 455 140)`); fl.style.opacity = LAB_SM.on ? 1 : 0.12; }
  else { fl.setAttribute('transform', `rotate(${(-L.fang * 180 / Math.PI % 360 + 90).toFixed(2)} 455 140)`); fl.style.opacity = Math.min(1, (L.fmag || 0) / 0.9).toFixed(2); }
  const on = dc ? LAB_DC.on : sm ? LAB_SM.on : LAB_AM.on; $('#lab-sw').setAttribute('transform', on ? 'rotate(26 170 100)' : '');
  const W = dc ? L.s[1] : sm ? L.nu * L.ws : L.s[4], Mz0 = LAB.load / 100 * L.MN, mzv = LAB.lt === 'fan' ? Mz0 * (W / labWb()) ** 2 : Mz0;
  $('#lab-mz').textContent = 'M_z = ' + fmt(mzv, sm ? 2 : 1) + (sm ? ' p.j.' : ' N·m');
  $('#lab-st').textContent = sm ? (!LAB_SM.on ? 'odpojeno' : Math.abs(m.sl) < 2e-3 ? 'v synchronizmu' : 'asynchronní chod, s = ' + fmt(m.sl * 100, 1) + ' %')
    : dc ? (LAB_DC.mode === 'u' && LAB_DC.Rp > 0 ? 'R_p = ' + fmt(LAB_DC.Rp, 1) + ' Ω v obvodu' : '') : (LAB_AM.dcb ? 'brzdí ss proudem' : LAB_AM.src === 'sit' ? 'vinutí v ' + (LAB_AM.yd === 'Y' ? 'hvězdě' : 'trojúhelníku') : '');
  labChart();
}
function labChart() {
  const cv = $('#lb-cv'); if (!cv) return;
  const W = cv.clientWidth, H = cv.clientHeight, dpr = window.devicePixelRatio || 1; if (!W) return;
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext('2d'), col = labColors(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const span = 3, t0 = L.t - span, X = t => 8 + (W - 16) * (t - t0) / span;
  c.strokeStyle = col.rule; c.lineWidth = 1; c.beginPath(); c.moveTo(8, H - 18); c.lineTo(W - 8, H - 18); c.stroke();
  c.fillStyle = col.mut; c.font = '12px Inter, sans-serif';
  for (let k = 0; k <= 3; k++) c.fillText(k === 3 ? 'teď' : '−' + (3 - k) + ' s', Math.min(W - 30, 8 + (W - 16) * k / 3), H - 4);
  const b = L.buf, N = L.bn, start = (L.bi - N + L.NB) % L.NB;
  const tr = (key, color, [lo, hi]) => {
    const Y = v => (H - 22) - (clamp(v, lo, hi) - lo) / (hi - lo) * (H - 30);
    c.strokeStyle = color; c.lineWidth = 2; c.beginPath(); let first = true;
    for (let j = 0; j < N; j++) { const i = (start + j) % L.NB; if (b.t[i] < t0) continue; const x = X(b.t[i]), y = Y(b[key][i]); if (first) c.moveTo(x, y); else c.lineTo(x, y); first = false; }
    c.stroke();
  };
  tr('M', col.och, labGR.M); tr('I', col.red, labGR.I); tr('n', col.blu, labGR.n);
}
function labLoop(ts) {
  labRaf = 0;
  if (tab !== 'lab' || !L || !$('#lab-rot')) { labLast = 0; return; }
  const dt = labLast ? Math.min(0.05, (ts - labLast) / 1000) : 0; labLast = ts;
  if (LAB.run && dt > 0) labAdvance(dt * LAB.sp);
  labDraw();
  labRaf = requestAnimationFrame(labLoop);
}
function labStartLoop() { if (!labRaf) { labLast = 0; labRaf = requestAnimationFrame(labLoop); } }

/* ---------- ovládání ---------- */
document.addEventListener('click', e => {
  if (tab !== 'lab' || !L) return;
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'lb-go') { LAB.run = !LAB.run; t.textContent = LAB.run ? '❚❚ Pozastavit' : '▶ Pokračovat'; return; }
  if (t.id === 'lb-re') { L = null; Object.assign(LAB_AM, { on: false, rev: false, dcb: false }); LAB_DC.on = false; Object.assign(LAB_SM, { on: false, exc: false }); renderLab($('#cards')); return; }
  const A = LAB_AM, C = LAB_DC, S = LAB_SM;
  if (t.dataset.lsrc) { A.src = t.dataset.lsrc; if (A.src === 'mf') A.yd = 'D'; labLogAdd(A.src === 'sit' ? 'napájení ze sítě' : 'napájení z měniče frekvence'); }
  else if (t.dataset.lmode) { C.mode = t.dataset.lmode; L.ci.x = 0; L.cw.x = 0; L.nr = L.s[1]; L.s[3] = C.mode === 'reg' && C.on ? C.U : 0; labLogAdd(C.mode === 'u' ? 'ruční zdroj napětí' : 'regulace rychlosti'); }
  else if (t.dataset.llt) { LAB.lt = t.dataset.llt; document.querySelectorAll('[data-llt]').forEach(b => b.setAttribute('aria-pressed', b.dataset.llt === LAB.lt)); labLogAdd('zátěž: ' + t.textContent); return; }
  else if (t.dataset.lt) {
    const k = t.dataset.lt;
    if (L.m === 'am') {
      if (k === 'on') { A.on = !A.on; if (!A.on) A.dcb = false; labLogAdd(A.on ? 'stykač sepnut' : 'stykač rozepnut'); }
      if (k === 'yd') { A.yd = A.yd === 'Y' ? 'D' : 'Y'; labLogAdd('vinutí přepnuto do ' + (A.yd === 'Y' ? 'hvězdy' : 'trojúhelníku')); }
      if (k === 'rev') { A.rev = !A.rev; labLogAdd(A.rev ? 'přehozeny dvě fáze (opačný sled)' : 'původní sled fází'); }
      if (k === 'dcb') { A.dcb = !A.dcb; if (A.dcb) A.on = true; labLogAdd(A.dcb ? 'stejnosměrné brzdění' : 'konec stejnosměrného brzdění'); }
    } else if (L.m === 'sm') {
      if (k === 'on') { S.on = !S.on; labLogAdd(S.on ? 'připojeno na síť' : 'odpojeno od sítě'); }
      if (k === 'exc') { S.exc = !S.exc; labLogAdd(S.exc ? 'buzení zapnuto' : 'buzení vypnuto'); }
    } else if (k === 'on') { C.on = !C.on; labLogAdd(C.on ? 'zapnuto' : 'vypnuto'); }
  } else return;
  $('#lb-ctl').innerHTML = labCtlHTML();
  $('.lstage').innerHTML = labBench();
});
document.addEventListener('input', e => {
  if (tab !== 'lab' || !L) return;
  const k = e.target.dataset && e.target.dataset.ls; if (!k) return;
  const v = +e.target.value, o = document.getElementById('lv-' + k), st = +e.target.step;
  const unit = { fset: 'Hz', ramp: 'Hz/s', Rp: 'Ω', U: 'V', nset: 'ot/min', Imax: 'A', kf: '% U_fN', load: '% M_N', Ui: 'p.j.' }[k] || '';
  if (o) o.innerHTML = fmt(v, st < 1 ? (st < 0.1 ? 2 : 1) : 0) + ' ' + sub(unit);
  if (k === 'load') LAB.load = v; else if (L.m === 'am') LAB_AM[k] = v; else if (L.m === 'sm') LAB_SM[k] = v; else LAB_DC[k] = v;
});
document.addEventListener('change', e => {
  if (tab !== 'lab') return;
  const id = e.target.id, k = e.target.dataset && e.target.dataset.ls;
  if (k && L) { const names = { load: 'zátěž', fset: 'žádaná frekvence', ramp: 'rampa', Rp: 'odpor R_p', U: 'napětí', nset: 'žádané otáčky', Imax: 'omezení proudu', kf: 'buzení', Ui: 'buzení U_i' }; labLogAdd(names[k] + ' ' + e.target.value); return; }
  if (id === 'lb-m') { LAB.m = e.target.value; L = null; renderLab($('#cards')); }
  else if (id === 'lb-sp') LAB.sp = +e.target.value;
  else if (id === 'lb-J') { LAB.J = +e.target.value; L = null; renderLab($('#cards')); labLogAdd('setrvačnost ' + fmt(LAB.J, 1) + '× (začíná se znovu)'); }
});
window.addEventListener('resize', () => { if (tab === 'lab' && L) labChart(); });
