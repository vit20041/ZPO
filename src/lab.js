/* ===== Laboratoř: stroj simulovaný živě, motor i generátor ===== */
const LAB = { m: 'am', gen: false, sp: 0.2, J: 1, load: 0, lt: 'react', run: true };
const LAB_AM = { src: 'sit', on: false, yd: 'D', rev: false, dcb: false, Rp: 0, fset: 50, ramp: 25 };
const LAB_DC = { mode: 'u', on: false, U: 440, Rp: 0, kf: 100, nset: 1500, Imax: 200 };
const LAB_SM = { on: false, exc: false, Ui: 1.2 };
const G_DC = { on: false, Rz: 20, exc: 'cizi', kf: 100, Rreg: 60, drv: 'asm', drvOn: false, ns: 1500, v: 0 };
const G_AM = { on: false, v: 0 };
const G_SM = { on: false, exc: true, Ui: 1.0, v: 0 };
let L = null, labRaf = 0, labLast = 0, labCol = null, labGR = {}, labLog = [];

function niceUp(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e; }
const lsub = s => String(s).replace(/([A-Za-zΦΩβ])_([A-Za-z0-9]+)/g, '$1<tspan baseline-shift="sub" font-size="72%">$2</tspan>');

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
    L.s[2] = LAB.gen ? 0 : d.ifN;                                          /* motor nabuzený; dynamo začíná bez buzení */
  } else {
    const P = { U: 1, Xd: 1.0, Xq: 0.7, TN: 1.5 * LAB.J, MD: 1.5, sD: 0.3, f: 50, pp: 2 };
    L = { m: 'sm', P, s: new Float64Array(1), nu: 0, MN: 1, ws: TAU * P.f / P.pp };
  }
  Object.assign(L, { gen: LAB.gen, t: 0, thv: 0, fang: 0, fmag: 0, NB, bi: 0, bn: 0, nextS: 0, Mp: 0 });
  L.buf = { t: new Float64Array(NB), n: new Float64Array(NB), I: new Float64Array(NB), M: new Float64Array(NB) };
  L.meas = { U: 0, I: 0, n: 0, M: 0, b: 0, x1: 0, x2: 0, x3: 0, x4: 0 };
  L.K = [0, 1, 2, 3].map(() => new Float64Array(L.s.length)); L.tmp = new Float64Array(L.s.length);
  labLog = [];
}
const labWb = () => L.m === 'am' ? L.d.Ws : L.m === 'dc' ? L.d.Wn : L.ws;
function labMz(W) {                                                      /* zátěž motoru; u generátoru turbína = záporná zátěž */
  if (L.gen) { const p = primeMover(W); return p.loss - p.Mp; }       /* generátor: pohon = záporná zátěž */
  const M0 = LAB.load / 100 * L.MN, Wb = labWb();
  if (!M0) return 0;
  if (LAB.lt === 'fan') return M0 * (W / Wb) * Math.abs(W / Wb);
  if (LAB.lt === 'pot') return M0;
  return null;                                                            /* pasivní tření */
}
function passive(Mm, W, M0) { if (Math.abs(W) > 1e-3 * labWb()) return M0 * Math.sign(W); return clamp(Mm, -M0, M0); }
function rk4s(s, dt, fn, K, tmp) {
  const n = s.length; fn(s, K[0]);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + 0.5 * dt * K[0][i]; fn(tmp, K[1]);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + 0.5 * dt * K[1][i]; fn(tmp, K[2]);
  for (let i = 0; i < n; i++) tmp[i] = s[i] + dt * K[2][i]; fn(tmp, K[3]);
  for (let i = 0; i < n; i++) s[i] += dt / 6 * (K[0][i] + 2 * K[1][i] + 2 * K[2][i] + K[3][i]);
}
/* pohon generátoru bez regulátoru: přirozené charakteristiky
   turbína: M_t = v·2M_N·(1 − Ω/2Ω_s) (s rostoucími otáčkami klesá), ventilační ztráty 0,1·M_N·(Ω/Ω_s)²
   asynchronní pohonný motor: Klossův vztah, M_zv = 2,5 M_N, s_zv = 0,1 */
function primeMover(W) {
  const Ws = labWb(), MN = L.MN, x = W / Ws, loss = 0.1 * MN * x * Math.abs(x);
  let Mp = 0;
  if (L.m === 'dc' && G_DC.drv === 'asm') { if (G_DC.drvOn) { const Wd = toRad(G_DC.ns), s = (Wd - W) / Wd; Mp = Math.abs(s) < 1e-9 ? 0 : 2 * 2.5 * MN / (s / 0.1 + 0.1 / s); } }
  else { const v = (L.m === 'dc' ? G_DC.v : L.m === 'am' ? G_AM.v : G_SM.v) / 100; Mp = v * 2 * MN * Math.max(0, 1 - x / 2); }
  return { Mp, loss };
}

function stepAM(dt) {
  const P = L.P, d = L.d, s = L.s, A = LAB_AM, G = G_AM, gen = L.gen, pp = P.pp, R1 = P.R1, R2 = P.R2 + (gen ? 0 : A.Rp), { Lh, L1, L2, D } = d;
  let ua = 0, ub = 0, mode = 'off', kv = 1;
  if (gen) { if (G.on) { mode = 'ac'; L.f = P.fN; } }
  else if (A.on && A.dcb) { mode = 'dc'; ua = 40; L.f = 0; }
  else if (A.on && A.src === 'sit') { mode = 'ac'; kv = A.yd === 'Y' ? 1 / SQ3 : 1; L.f = A.rev ? -P.fN : P.fN; }
  else if (A.on) { mode = 'ac'; const r = A.ramp * dt, tg = A.rev ? -A.fset : A.fset; L.f += clamp(tg - L.f, -r, r); }
  else if (A.src === 'mf') L.f = 0;
  if (mode === 'ac') {
    L.th += TAU * L.f * dt;
    const U = gen || A.src === 'sit' ? d.Um * kv : Math.min(P.Udc / SQ3, P.U0 + (d.Um - P.U0) * Math.min(Math.abs(L.f), P.fN) / P.fN);
    ua = U * Math.cos(L.th); ub = U * Math.sin(L.th);
  }
  const Mz0 = LAB.load / 100 * L.MN;
  if (mode === 'off') {                                                  /* odpojeno: i₁ = 0, rotorový tok doznívá */
    const W = s[4], tau = L2 / R2, w = pp * W, a = s[2], b = s[3];
    s[2] += dt * (-a / tau - w * b); s[3] += dt * (-b / tau + w * a); s[0] = Lh / L2 * s[2]; s[1] = Lh / L2 * s[3];
    if (gen) { s[4] = W + dt * (-labMz(W) - P.B * W) / P.J; L.Mp = primeMover(W).Mp; }
    else { let Mz = labMz(W); if (Mz === null) Mz = passive(0, W, Mz0); const Wn = W + dt * (-Mz - P.B * W) / P.J; s[4] = (LAB.lt === 'react' && Mz0 && Math.sign(Wn) !== Math.sign(W)) ? 0 : Wn; }
    return { M: 0, i: 0, u: 0, p: 0, q: 0 };
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
  if (gen) L.Mp = primeMover(s[4]).Mp;
  return { M: 1.5 * pp * (s[0] * i1b - s[1] * i1a), i: Math.hypot(i1a, i1b) * kv, u: Math.hypot(ua, ub) / kv, p: 1.5 * (ua * i1a + ub * i1b), q: 1.5 * (ub * i1a - ua * i1b) };
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
/* dynamo: magnetizační křivka s remanencí (3 %) a sycením */
const xiSat = (d, ifl) => d.xiN * (0.03 + 0.97 * Math.tanh(1.2 * ifl / d.ifN) / Math.tanh(1.2));
function stepDCgen(dt) {
  const P = L.P, d = L.d, s = L.s, G = G_DC;                             /* s: i zátěže, Ω, i_f */
  const RL = P.Rd + G.Rz, uf = P.UfN * G.kf / 100;
  const fn = (y, o) => {
    const xi = xiSat(d, y[2]), Ui = xi * y[1], U = G.on ? G.Rz * y[0] : Ui;
    o[0] = G.on ? (Ui - RL * y[0]) / d.Ld : 0; o[3] = 0;
    const W = Math.max(y[1], 0); o[1] = (-labMz(W) - xi * y[0] - P.B * y[1]) / P.J;
    o[2] = G.exc === 'cizi' ? (uf - P.Rf * y[2]) / P.Lf : (U - (P.Rf + G.Rreg) * y[2]) / P.Lf;
  };
  if (!G.on) s[0] = 0;
  rk4s(s, dt, fn, L.K, L.tmp);
  if (s[1] < 0) s[1] = 0;
  const xi = xiSat(d, s[2]), Ui = xi * s[1], U = G.on ? G.Rz * s[0] : Ui;
  L.Mp = primeMover(s[1]).Mp;
  return { M: -xi * s[0], i: s[0], u: U, ui: Ui, if: s[2] };
}
function smCur(P, b, Ui) {                                               /* ustálený fázor proudu, R = 0 */
  const Iq = -P.U * Math.sin(b) / P.Xq, Id = (Ui - P.U * Math.cos(b)) / P.Xd;
  const qr = Math.cos(-b), qi = Math.sin(-b), dr = Math.cos(-b - Math.PI / 2), di = Math.sin(-b - Math.PI / 2);
  const Ir = Id * dr + Iq * qr, Ii = Id * di + Iq * qi;                 /* generátorová konvence */
  return { I: Math.hypot(Ir, Ii), P: -P.U * Ir, Q: P.U * Ii };          /* P, Q odebírané ze sítě */
}
function stepSM(dt) {
  const P = L.P, gen = L.gen, S = gen ? G_SM : LAB_SM, Ui = (gen ? S.exc : S.on && S.exc) ? S.Ui : 0, Mz0 = LAB.load / 100;
  L.fang += L.ws * dt;
  const b = Math.atan2(Math.sin(P.pp * (L.fang - L.thv)), Math.cos(P.pp * (L.fang - L.thv))), sl = 1 - L.nu;
  let M = 0;
  if (S.on) M = smTorque(P, b, Ui) + smDamper(P, sl);
  {
    let Mz = labMz(L.nu * L.ws); if (Mz === null) Mz = passive(M, L.nu * L.ws, Mz0);
    const nn = L.nu + dt * (M - Mz) / P.TN;
    L.nu = (!gen && LAB.lt === 'react' && Mz0 && !S.on && Math.sign(nn) !== Math.sign(L.nu)) ? 0 : nn;
    if (gen) L.Mp = primeMover(L.nu * L.ws).Mp;
  }
  const c = S.on ? smCur(P, b, Ui) : { I: 0, P: 0, Q: 0 };
  return { M, b, Ui, c, sl };
}
function labAdvance(simT) {
  const dt = L.m === 'am' ? 5e-5 : L.m === 'dc' ? 2e-5 : 1e-4, cap = L.m === 'am' ? 3000 : 6000;
  const n = Math.min(Math.round(simT / dt), cap); let r = null;
  for (let k = 0; k < n; k++) {
    r = L.m === 'am' ? stepAM(dt) : L.m === 'dc' ? (L.gen ? stepDCgen(dt) : stepDC(dt)) : stepSM(dt);
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
  m.n = toRpm(W); m.M = r.M; m.Mp = L.Mp;
  if (L.m === 'am') {
    m.U = r.u * Math.sqrt(1.5); m.I = r.i * Math.SQRT1_2; m.x1 = L.f;
    const ns = 60 * L.f / L.P.pp, on = L.gen ? G_AM.on : LAB_AM.on && !LAB_AM.dcb;
    m.x2 = Math.abs(ns) > 1 && on ? (ns - m.n) / ns * 100 : NaN; m.x3 = r.M * W / 1e3; m.p = r.p; m.q = r.q;
  } else if (L.m === 'dc') { m.U = r.u; m.I = r.i; m.x1 = r.ui; m.x2 = r.if; m.x3 = r.u * r.i / 1e3; }
  else {
    const on = L.gen ? G_SM.on : LAB_SM.on, syn = on && Math.abs(r.sl) < 0.01, sg = L.gen ? -1 : 1;  /* generátor: P, Q, β dodávané */
    m.I = r.c.I; m.b = on ? sg * r.b * 180 / Math.PI : NaN; m.x1 = r.Ui; m.x2 = syn ? sg * r.c.P : NaN; m.x3 = syn ? sg * r.c.Q : NaN;
    m.x4 = syn && r.c.I > 0.01 ? Math.abs(r.c.P) / Math.hypot(r.c.P, r.c.Q) : NaN; m.sl = r.sl;
    if (L.gen) {                                                         /* synchronoskop: napětí generátoru vůči síti */
      const bg = -r.b, Ug = r.Ui * L.nu; m.df = 50 * (L.nu - 1); m.dphi = bg * 180 / Math.PI;
      m.dU = Math.hypot(Ug * Math.cos(bg) - 1, Ug * Math.sin(bg)); m.Ug = Ug;
    }
  }
}

/* ---------- měřicí přístroje ---------- */
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
  const g = L.gen;
  labGR = L.m === 'am' ? { U: [0, 500], I: [0, 100], n: [g ? 0 : -2000, 2000], M: g ? [-200, 100] : [-100, 200] }
    : L.m === 'dc' ? (g ? { U: [0, 500], I: [0, 50], n: [0, 2000], M: [-500, 100] } : { U: [0, 500], I: [-250, 250], n: [-2000, 2000], M: [-500, 500] })
    : { I: [0, 3], n: [0, 2000], M: g ? [-3, 2] : [-2, 3], b: [-180, 180] };
}
function labNeedle(k, v) {
  let [lo, hi] = labGR[k];
  if (k !== 'b' && isFinite(v) && (v > hi || v < lo)) {
    if (v > hi) hi = niceUp(v * 1.1); if (v < lo) lo = -niceUp(-v * 1.1); labGR[k] = [lo, hi];
    const w = document.getElementById('gw-' + k); if (w) w.innerHTML = gaugeSVG(k, lo, hi);
  }
  const e = document.getElementById('nd-' + k); if (!e) return;
  const a = -125 + ((isFinite(v) ? clamp(v, lo, hi) : lo) - lo) / (hi - lo) * 250; e.setAttribute('transform', `rotate(${a.toFixed(2)} 110 112)`);
}

/* ---------- schéma zapojení ---------- */
const sT = (x, y, t, a = 'start', c = 'ls', id = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}"${id ? ` id="${id}"` : ''}>${lsub(t)}</text>`;
const sW = d => `<path d="${d}" class="lw"/>`;
const sBox = (x, y, w, h, t1, t2, id2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" class="lbx"/>` + sT(x + w / 2, y + h / 2 - (t2 ? 4 : -5), t1, 'middle', 'lb') + (t2 ? sT(x + w / 2, y + h / 2 + 15, t2, 'middle', 'ls', id2) : '');
const sDot = (x, y) => `<circle cx="${x}" cy="${y}" r="3.5" class="lkf"/>`;
const sKnife = (x, y, on) => `<circle cx="${x}" cy="${y}" r="3" class="lkf"/><circle cx="${x + 28}" cy="${y}" r="3" class="lkf"/>` + (on ? `<line x1="${x}" y1="${y}" x2="${x + 28}" y2="${y}" class="lw2 on"/>` : `<line x1="${x}" y1="${y}" x2="${x + 24}" y2="${y - 14}" class="lw2"/>`);
const sMeter = (x, y, l, r = 15) => `<circle cx="${x}" cy="${y}" r="${r}" class="lmeter"/>` + sT(x, y + 5, l, 'middle', 'lb');
function sRes(x, y, w, lab, val, zero) {                                   /* proměnný odpor vodorovně; R = 0 → přemostěn */
  let g = `<rect x="${x}" y="${y - 8}" width="${w}" height="16" rx="2" class="lres${zero ? ' off' : ''}"/><line x1="${x - 2}" y1="${y + 12}" x2="${x + w + 2}" y2="${y - 12}" class="larr" marker-end="url(#lahr)"/>`;
  if (zero) g += `<path d="M${x - 6} ${y}v-20h${w + 12}v20" class="lw dash"/>`;
  return g + sT(x + w / 2, y - (zero ? 26 : 22), lab, 'middle', 'lsb') + sT(x + w / 2, y + 26, val, 'middle', 'ls');
}
const sResV = (x, y, h, lab, val) => `<rect x="${x - 8}" y="${y}" width="16" height="${h}" rx="2" class="lres"/><line x1="${x - 16}" y1="${y + h - 4}" x2="${x + 14}" y2="${y + 4}" class="larr" marker-end="url(#lahr)"/>` + sT(x + 20, y + h / 2 - 4, lab, 'start', 'lsb') + sT(x + 20, y + h / 2 + 14, val, 'start', 'ls');
const sCoilV = (x, y, len, n = 4) => { const r = len / n / 2; let d = `M${x} ${y}`; for (let i = 0; i < n; i++) d += `a${r} ${r} 0 0 1 0 ${2 * r}`; return `<path d="${d}" class="lw coil"/>`; };
const sLamp = (x, y, i) => `<circle cx="${x}" cy="${y}" r="7" class="llamp" id="lab-lamp${i}"/><circle cx="${x}" cy="${y}" r="7" class="lw thin"/><path d="M${x - 5} ${y - 5}l10 10M${x + 5} ${y - 5}l-10 10" class="lw thin"/>`;

function labMachine() {
  const dc = L.m === 'dc', sm = L.m === 'sm', cx = 455, cy = 140;
  let g = `<circle cx="${cx}" cy="${cy}" r="128" class="lfe"/><circle cx="${cx}" cy="${cy}" r="${dc ? 96 : 92}" class="lgap"/>`;
  if (dc) {
    g += `<path d="M${cx - 30} ${cy - 127}h60v32l14 4a92 92 0 0 0 -88 0l14 -4z" class="lfe2"/><path d="M${cx - 30} ${cy + 127}h60v-32l14 -4a92 92 0 0 1 -88 0l14 4z" class="lfe2"/>`;
    g += `<text x="${cx}" y="${cy - 102}" text-anchor="middle" class="lpole">N</text><text x="${cx}" y="${cy + 114}" text-anchor="middle" class="lpole">S</text>`;
  } else for (let i = 0; i < 24; i++) g += `<g transform="rotate(${i * 15 + 7.5} ${cx} ${cy})"><rect x="${cx - 5}" y="${cy - 122}" width="10" height="26" rx="2" class="lph${Math.floor(i / 2) % 3}"/></g>`;
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
  return `<g transform="translate(78 28) scale(0.9)">${g}</g>`;           /* střed (487,154), poloměr 115 */
}
function labBench() {
  const dc = L.m === 'dc', sm = L.m === 'sm', gen = L.gen, A = LAB_AM, C = LAB_DC;
  let g = `<defs><marker id="lah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--red)"/></marker><marker id="lahr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--red)"/></marker></defs>`;
  const T = 372;                                                          /* svorky stroje */
  if (dc && !gen) {
    const reg = C.mode === 'reg';
    g += sBox(8, 40, 96, 104, reg ? 'Usměrňovač' : 'Zdroj', reg ? 'řízený' : 'U = ' + C.U + ' V');
    g += sW(`M104 62H122M150 62H178M208 62H${reg ? T : 232}M104 124H${T}`) + sKnife(122, 62, C.on) + sT(136, 40, 'vypínač', 'middle');
    g += sMeter(193, 62, 'A');
    if (!reg) g += sRes(232, 62, 56, 'předřadný odpor R_p', C.Rp > 0 ? fmt(C.Rp, 1) + ' Ω' : '0 Ω: vyřazen', C.Rp <= 0) + sW(`M288 62H${T}`);
    else g += sT(280, 46, 'regulátor omezuje proud', 'middle');
    g += sW('M330 62V80M330 106V124') + sMeter(330, 93, 'V', 13) + sDot(330, 62) + sDot(330, 124);
    g += sT(T - 4, 54, 'A1', 'end', 'lsb') + sT(T - 4, 116, 'A2', 'end', 'lsb') + sT(T - 4, 148, 'kotva', 'end');
    g += sBox(8, 196, 96, 84, 'Budicí zdroj', 'U_f = ' + Math.round(L.P.UfN * C.kf / 100) + ' V') + sW('M104 214H250M104 268H250') + sCoilV(250, 214, 54) + sT(262, 236, 'budicí vinutí', 'start', 'lsb') + sT(262, 254, 'I_f = 0 A', 'start', 'ls', 'lab-if');
    g += `<path d="M300 280H392" class="lw dash"/>` + sT(346, 298, 'na póly N, S', 'middle');
  } else if (dc && gen) {
    const G = G_DC;
    g += sResV(40, 72, 44, 'zátěž', 'R_z = ' + G.Rz + ' Ω') + sW(`M40 62V72M40 116V124M40 62H96M124 62H178M208 62H${T}M40 124H${T}`) + sKnife(96, 62, G.on) + sT(110, 40, 'vypínač zátěže', 'middle');
    g += sMeter(193, 62, 'A') + sW('M330 62V80M330 106V124') + sMeter(330, 93, 'V', 13) + sDot(330, 62) + sDot(330, 124);
    g += sT(T - 4, 54, 'A1', 'end', 'lsb') + sT(T - 4, 116, 'A2', 'end', 'lsb') + sT(T - 4, 148, 'kotva', 'end');
    if (G.exc === 'cizi') g += sBox(8, 196, 96, 84, 'Budicí zdroj', 'U_f = ' + Math.round(L.P.UfN * G.kf / 100) + ' V') + sW('M104 214H250M104 268H250') + sCoilV(250, 214, 54) + sT(262, 236, 'budicí vinutí', 'start', 'lsb') + sT(262, 254, 'I_f = 0 A', 'start', 'ls', 'lab-if');
    else g += sDot(290, 62) + sDot(270, 124) + sW('M290 62V214H232M180 214H140') + sRes(180, 214, 52, 'R_reg', G.Rreg + ' Ω', false) + sCoilV(140, 214, 54) + sW('M140 268H270V124') + sT(150, 290, 'derivační budicí vinutí', 'start', 'lsb') + sT(20, 236, 'I_f = 0 A', 'start', 'ls', 'lab-if') + sT(20, 254, 'samobuzení', 'start');
    g += `<path d="M300 280H392" class="lw dash"/>` + sT(346, 298, 'na póly N, S', 'middle');
  } else {
    const ys = [52, 78, 104], src = sm ? ['Síť', 'tvrdá, 50 Hz'] : gen ? ['Síť', '400 V, 50 Hz'] : A.dcb ? ['Ss zdroj', 'brzdění 40 V'] : A.src === 'sit' ? ['Síť', '400 V, 50 Hz'] : ['Měnič', 'f = ' + fmt(L.f || 0, 0) + ' Hz'];
    g += sBox(8, 30, 92, 96, src[0], src[1], 'lab-srcv');
    const on = sm ? (gen ? G_SM.on : LAB_SM.on) : gen ? G_AM.on : A.on, rev = !gen && !sm && A.rev;
    ys.forEach((y, k) => { g += sT(104, y - 5, 'L' + (k + 1), 'start', 'lsb') + sW(`M100 ${y}H132M160 ${y}H178`) + sKnife(132, y, on); });
    g += `<line x1="146" y1="${ys[0] - 22}" x2="146" y2="${ys[2] + 6}" class="lw dash"/>` + sT(146, 22, sm ? 'vypínač' : 'stykač', 'middle');
    if (sm && gen) { ys.forEach((y, k) => { g += `<path d="M132 ${y}C132 ${y + 8} 136 ${y + 13} 137 ${y + 13}M160 ${y}C160 ${y + 8} 156 ${y + 13} 155 ${y + 13}" class="lw thin"/>` + sLamp(146, y + 13, k); }); g += sT(146, 140, 'synchronoskop', 'middle'); }
    if (rev) g += sW(`M178 ${ys[0]}H218M178 ${ys[1]}L218 ${ys[2]}M178 ${ys[2]}L218 ${ys[1]}`) + sT(198, 128, 'přehozeny L2, L3', 'middle', 'lsr');
    else g += sW(ys.map(y => `M178 ${y}H218`).join(''));
    g += sW(ys.map(y => `M218 ${y}H300`).join('')) + sMeter(240, ys[0], 'A', 12) + `<path d="M268 ${ys[0]}V56M268 ${ys[1]}V74" class="lw thin"/>` + sMeter(268, 65, 'V', 9) + sDot(268, ys[0]) + sDot(268, ys[1]);
    const yd = !sm && !gen && A.src === 'sit' ? A.yd : 'D';
    g += `<rect x="300" y="36" width="58" height="84" rx="8" class="lbx"/>` + sT(329, 136, 'svorkovnice', 'middle');
    if (yd === 'Y') g += `<path d="M329 78L329 56M329 78L310 90M329 78L348 90" class="lw"/><circle cx="329" cy="78" r="3" class="lkf"/>` + sT(329, 112, 'Y', 'middle', 'lb');
    else g += `<path d="M329 52L348 88L310 88Z" class="lw"/>` + sT(329, 112, 'D', 'middle', 'lb');
    g += sW(`M358 60H${T}M358 78H${T}M358 96H${T}`);
    if (sm) {
      const S = gen ? G_SM : LAB_SM;
      g += sBox(8, 196, 92, 84, 'Budič', 'U_i = ' + fmt(S.Ui, 2) + ' p.j.') + sW('M100 214H150M178 214H306M100 268H306') + sKnife(150, 214, S.exc) + sT(164, 200, 'buzení', 'middle');
      g += `<ellipse cx="312" cy="214" rx="6" ry="12" class="lbx"/><ellipse cx="312" cy="268" rx="6" ry="12" class="lbx"/>` + `<path d="M318 214H352V268H318" class="lw dash"/>` + sT(200, 296, 'kroužky → budicí vinutí rotoru', 'middle');
    } else if (!gen && A.Rp > 0) {
      g += [0, 1, 2].map(k => { const x = 200 + k * 46; return sW(`M${x} 176V188`) + `<rect x="${x - 7}" y="188" width="14" height="44" rx="2" class="lres"/><line x1="${x - 14}" y1="228" x2="${x + 12}" y2="192" class="larr" marker-end="url(#lahr)"/>` + sW(`M${x} 232V244`); }).join('');
      g += sW('M200 244H292M200 176H372') + sT(246, 266, 'odporník v rotoru R_p = ' + fmt(A.Rp, 1) + ' Ω', 'middle', 'lsb') + sT(246, 284, 'přes kroužky a kartáče', 'middle');
      g += [0, 1, 2].map(k => `<ellipse cx="${360 - k * 14}" cy="176" rx="4" ry="9" class="lbx"/>`).join('');
    } else if (!gen) g += sT(20, 200, 'rotor nakrátko', 'start', 'lsb') + sT(20, 218, '(klec, nebo kroužky spojené nakrátko)', 'start');
    if (!gen && !sm && A.dcb) g += sT(20, 250, 'stejnosměrné brzdění: do vinutí', 'start', 'lsr') + sT(20, 268, 'teče stejnosměrný proud', 'start', 'lsr');
  }
  g += labMachine();
  const right = gen ? (dc && G_DC.drv === 'asm' ? 'Asynchronní motor' : 'Turbína') : 'Zátěž (brzda)';
  g += `<path d="M602 154H640" class="lshl"/><rect x="640" y="104" width="150" height="100" rx="10" class="lbx"/>` + sT(715, 128, right, 'middle', 'lb') + sT(715, 152, 'M_z = 0', 'middle', 'ls', 'lab-mz') + sT(715, 174, '', 'middle', 'ls', 'lab-st');
  if (sm && gen) g += sT(715, 236, '', 'middle', 'lsb', 'lab-syn') + sT(715, 256, '', 'middle', 'ls', 'lab-syn2');
  return `<svg viewBox="0 0 800 310" class="bench" role="img" aria-label="Schéma zapojení laboratoře">${g}</svg>`;
}

/* ---------- ovládací panel ---------- */
const tg = (id, on, t) => `<button type="button" class="btn tgl" data-lt="${id}" aria-pressed="${!!on}">${t}</button>`;
const decOf = st => st < 1 ? (st < 0.1 ? 2 : 1) : 0;
const sl = (id, l, min, max, st, v, u) => `<label class="lsl"><span><span>${sub(l)}</span> <b id="lv-${id}">${fmt(v, decOf(st))} ${sub(u)}</b></span><input type="range" data-ls="${id}" min="${min}" max="${max}" step="${st}" value="${v}"></label>`;
const seg = (attr, cur, opts) => `<span class="seg">${opts.map(([k, t]) => `<button type="button" ${attr}="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</span>`;
function labCtlHTML() {
  if (L.gen) {
    if (L.m === 'dc') { const G = G_DC; return `<div class="lgrp"><p class="lgh">Dynamo</p><div class="lrow">${seg('data-lexc', G.exc, [['cizi', 'cizí buzení'], ['der', 'derivační (samobuzení)']])}${tg('on', G.on, G.on ? 'Odpojit zátěž' : 'Připojit zátěž')}</div>
${sl('Rz', 'Zátěžný odpor R_z', 2, 100, 1, G.Rz, 'Ω')}${G.exc === 'cizi' ? sl('kf', 'Budicí napětí', 0, 100, 5, G.kf, '% U_fN') : sl('Rreg', 'Regulační odpor v buzení R_reg', 0, 400, 10, G.Rreg, 'Ω')}</div>`; }
    if (L.m === 'am') { const G = G_AM; return `<div class="lgrp"><p class="lgh">Asynchronní generátor</p><div class="lrow">${tg('on', G.on, G.on ? 'Odpojit od sítě' : 'Připojit na síť')}</div><p class="note">Otáčky a výkon nastavíte ventilem turbíny vpravo.</p></div>`; }
    const G = G_SM; return `<div class="lgrp"><p class="lgh">Synchronní generátor</p><div class="lrow">${tg('on', G.on, G.on ? 'Odpojit od sítě' : 'Fázovat (připojit na síť)')}${tg('exc', G.exc, G.exc ? 'Buzení zapnuto' : 'Buzení vypnuto')}</div>
${sl('Ui', 'Napětí od buzení U_i (~ I_f)', 0, 2.5, 0.05, G.Ui, 'p.j.')}</div>`;
  }
  if (L.m === 'am') {
    const A = LAB_AM;
    return `<div class="lgrp"><p class="lgh">Napájení</p><div class="lrow">${seg('data-lsrc', A.src, [['sit', 'Síť 400 V'], ['mf', 'Měnič frekvence']])}</div>
<div class="lrow">${tg('on', A.on, A.on ? 'Vypnout stykač' : 'Zapnout stykač')}${A.src === 'sit' ? tg('yd', A.yd === 'Y', A.yd === 'Y' ? 'Hvězda (přepnout na D)' : 'Trojúhelník (přepnout na Y)') : ''}${tg('rev', A.rev, 'Reverzace (2 fáze)')}${tg('dcb', A.dcb, 'Stejnosměrné brzdění')}</div>
${A.src === 'mf' ? sl('fset', 'Žádaná frekvence', 0, 80, 1, A.fset, 'Hz') + sl('ramp', 'Rampa frekvence', 5, 200, 5, A.ramp, 'Hz/s') : ''}${sl('Rp', 'Odpor v rotoru R_p (kroužkový motor)', 0, 4, 0.1, A.Rp, 'Ω')}</div>`;
  }
  if (L.m === 'sm') { const S = LAB_SM; return `<div class="lgrp"><p class="lgh">Napájení a buzení</p><div class="lrow">${tg('on', S.on, S.on ? 'Odpojit od sítě' : 'Připojit na síť')}${tg('exc', S.exc, S.exc ? 'Buzení zapnuto' : 'Buzení vypnuto')}</div>${sl('Ui', 'Napětí od buzení U_i (~ I_f)', 0, 2.5, 0.05, S.Ui, 'p.j.')}</div>`; }
  const C = LAB_DC;
  return `<div class="lgrp"><p class="lgh">Napájení kotvy</p><div class="lrow">${seg('data-lmode', C.mode, [['u', 'Zdroj napětí'], ['reg', 'Regulace rychlosti']])}${tg('on', C.on, C.on ? 'Vypnout' : 'Zapnout')}</div>
${C.mode === 'u' ? sl('U', 'Napětí zdroje U', 0, 500, 5, C.U, 'V') + sl('Rp', 'Předřadný odpor R_p', 0, 5, 0.1, C.Rp, 'Ω') : sl('nset', 'Žádané otáčky n*', -2000, 2000, 50, C.nset, 'ot/min') + sl('Imax', 'Omezení proudu I_max', 50, 300, 10, C.Imax, 'A')}
${sl('kf', 'Budicí napětí (buzení)', 0, 100, 5, C.kf, '% U_fN')}</div>`;
}
function labLoadHTML() {
  if (L.gen) {
    const turb = L.m !== 'dc' || G_DC.drv === 'turb', v = L.m === 'dc' ? G_DC.v : L.m === 'am' ? G_AM.v : G_SM.v;
    const vSl = sl('v', 'Otevření ventilu turbíny', 0, 100, L.m === 'sm' ? 0.1 : 0.5, v, '%');
    const note = 'Bez regulátoru: moment turbíny klesá s otáčkami a proti němu působí ventilační ztráty. Naprázdno dá ventil asi 10 % zhruba 1500 ot/min (k ustálení se blíží pomalu; pro rychlejší rozběh ventil nejdřív otevřete víc a pak přivřete). Po připojení k síti určuje otevření ventilu výkon: zhruba (ventil − 10 %) M_N. Pozor na přeběh při odlehčení.';
    if (L.m === 'dc') return `<div class="lgrp"><p class="lgh">Pohon dynama</p><div class="lrow">${seg('data-ldrv', G_DC.drv, [['asm', 'asynchronní motor'], ['turb', 'turbína s ventilem']])}</div>
${turb ? vSl + `<p class="note">${note}</p>` : `<div class="lrow">${tg('drv', G_DC.drvOn, G_DC.drvOn ? 'Vypnout pohonný motor' : 'Zapnout pohonný motor')}${seg('data-lns', String(G_DC.ns), [['1000', 'n_s 1000'], ['1500', '1500'], ['3000', '3000 ot/min']])}</div><p class="note">Asynchronní motor má tvrdou charakteristiku: se zatížením dynama otáčky klesnou jen o skluz.</p>`}</div>`;
    return `<div class="lgrp"><p class="lgh">Turbína</p>${vSl}<p class="note">${note}</p></div>`;
  }
  return `<div class="lgrp"><p class="lgh">Zátěž</p><div class="lrow">${seg('data-llt', LAB.lt, [['react', 'tření (pasivní)'], ['pot', 'jeřáb (aktivní)'], ['fan', 'ventilátor']])}</div>${sl('load', 'Zátěžný moment', 0, 300, 5, LAB.load, '% M_N')}</div>`;
}
function labTips() {
  const li = a => `<ul class="ltips">${a.map(x => `<li>${sub(x)}</li>`).join('')}</ul>`;
  if (L.gen) {
    if (L.m === 'dc') return li(['Zapněte pohonný motor (nebo otevřete ventil turbíny). Cizí buzení: voltmetr ukazuje napětí naprázdno U_0 = U_i ~ Φ n.', 'Připojte zátěž: teče proud, svorkové napětí klesne o R_a I a pohonný motor musí dodat moment.', 'Derivační buzení: dynamo se nabudí jen z remanence a jen při odporu budicího obvodu menším než kritický. Při R_reg kolem 180–200 Ω se nabudí jen málo nebo vůbec.', 'Snižte otáčky (n_s 1000, nebo méně otevřený ventil): kritický odpor klesá a derivační dynamo se odbudí.', 'Malý R_z: velký proud; u derivačního dynama napětí může zkolabovat.']);
    if (L.m === 'am') return li(['Otevřete ventil asi na 10 %: turbína se roztočí přibližně na 1500 ot/min. Připojte na síť; stroj se vybudí ze sítě (odebírá jalový výkon).', 'Otevřete ventil víc: otáčky stoupnou nad synchronní, skluz je záporný a činný výkon teče do sítě (P > 0).', 'Jalový výkon Q stroj stále odebírá: asynchronní generátor potřebuje cizí zdroj magnetizace (síť nebo kondenzátory).', 'Ventil příliš otevřený (moment nad momentem zvratu generátoru): stroj „uteče“. Po odpojení od sítě se turbína rozběhne do přeběhu.', 'Zavřete ventil: stroj odebírá ze sítě a pracuje jako motor (pohání turbínu).']);
    return li(['Fázování: buzení zapnuto, U_i ≈ 1. Ventilem (asi 10 %) doladíte otáčky na 1500 ot/min: žárovky synchronoskopu blikají s rozdílovým kmitočtem Δf. Připojte, když zhasnou (Δφ ≈ 0).', 'Připojení mimo fázi vyvolá velký proudový a momentový ráz a kývání.', 'Po připojení otevírejte ventil: roste zátěžný úhel β a činný výkon P. Nad statickou mezí stroj vypadne ze synchronizmu.', 'Buzení mění jalový výkon: přebuzený generátor dodává Q > 0, podbuzený odebírá. Činný výkon určuje turbína.']);
  }
  if (L.m === 'sm') return li(['Asynchronní rozběh: připojte na síť bez buzení. Moment dává tlumicí klec, motor se rozběhne těsně pod synchronní otáčky.', 'Pak zapněte buzení: rotor „zaskočí“ do synchronizmu a zátěžný úhel β se ustálí.', 'Zvyšujte zátěž: roste β. Nad statickou mezí stroj vypadne ze synchronizmu.', 'Měňte buzení: mění se proud a účiník (V-křivka); přebuzený motor dodává jalový výkon (Q < 0).', 'Šipka ukazuje točivé pole statoru, rotor s póly N/S se točí za ním o β/p.']);
  return L.m === 'am' ? li(['Zapněte stykač: proud vyskočí na 5–7× I_N, moment v prvních periodách kmitá, pak se ustálí skluz.', 'Přidejte zátěž: skluz a proud rostou. Nad momentem zvratu se motor zastaví.', 'Rozběh Y–D: přepněte na hvězdu, zapněte, po rozběhu přepněte na trojúhelník (druhý proudový ráz).', 'Reverzace za chodu = brzdění protiproudem; v nule vypněte, jinak se rozběhne opačně.', 'Odpor v rotoru: menší záběrný proud, větší záběrný moment, ale větší skluz za chodu.', 'Stejnosměrné brzdění: pole stojí (šipka se nehýbe), rotor v něm brzdí.'])
    : li(['Zapněte na plné napětí bez odporu: velký proudový ráz. S R_p je menší; po jeho zmenšení proud krátce vyskočí.', 'Snižte buzení: motor zrychlí (odbuzování), proud krátce naroste. Budicí proud se mění s časovou konstantou L_f/R_f = 1 s.', 'Snižte napětí pod indukované: proud změní smysl a motor brzdí rekuperačně.', 'Regulace rychlosti: proud drží omezení, otáčky sledují rampu, po zatížení se vrátí na žádanou hodnotu.']);
}
function labMeters() {
  const dc = L.m === 'dc', sm = L.m === 'sm', g = L.gen;
  if (sm) return { meters: [['I', 'Ampérmetr: proud (p.j.)', 'p.j.'], ['n', 'Otáčkoměr', 'ot/min'], ['M', 'Moment stroje (motorický +)', 'p.j.'], ['b', g ? 'Zátěžný úhel β (generátor +)' : 'Zátěžný úhel β', '°']],
    extra: g ? [['x2', 'Činný výkon do sítě P', 'p.j.'], ['x3', 'Jalový výkon do sítě Q', 'p.j.'], ['x4', 'Účiník cos φ', ''], ['df', 'Synchronoskop Δf', 'Hz'], ['dphi', 'Synchronoskop Δφ', '°'], ['t', 'Čas simulace', 's']]
      : [['x1', 'Napětí od buzení U_i', 'p.j.'], ['x2', 'Činný příkon P', 'p.j.'], ['x3', 'Jalový příkon Q', 'p.j.'], ['x4', 'Účiník cos φ', ''], ['t', 'Čas simulace', 's']] };
  if (dc) return { meters: [['U', g ? 'Voltmetr: svorkové napětí' : 'Voltmetr: napětí na kotvě', 'V'], ['I', g ? 'Ampérmetr: proud do zátěže' : 'Ampérmetr: proud kotvy', 'A'], ['n', 'Otáčkoměr', 'ot/min'], ['M', 'Moment stroje (motorický +)', 'N·m']],
    extra: g ? [['x1', 'Indukované napětí U_i', 'V'], ['x2', 'Budicí proud I_f', 'A'], ['x3', 'Výkon do zátěže U·I', 'kW'], ['Mp', 'Moment pohonného motoru', 'N·m'], ['t', 'Čas simulace', 's']]
      : [['x1', 'Indukované napětí U_i', 'V'], ['x2', 'Budicí proud I_f', 'A'], ['x3', 'Příkon kotvy U·I', 'kW'], ['t', 'Čas simulace', 's']] };
  return { meters: [['U', 'Voltmetr: napětí (ef., sdružené)', 'V'], ['I', 'Ampérmetr: proud (ef.)', 'A'], ['n', 'Otáčkoměr', 'ot/min'], ['M', 'Moment stroje (motorický +)', 'N·m']],
    extra: g ? [['x2', 'Skluz s', '%'], ['pg', 'Činný výkon do sítě P', 'kW'], ['qg', 'Jalový výkon ze sítě Q', 'kVAr'], ['Mp', 'Moment turbíny', 'N·m'], ['t', 'Čas simulace', 's']]
      : [['x1', 'Frekvence f₁', 'Hz'], ['x2', 'Skluz s', '%'], ['x3', 'Výkon M·Ω', 'kW'], ['t', 'Čas simulace', 's']] };
}
function renderLab(el) {
  if (!L || L.m !== LAB.m || L.gen !== LAB.gen) { labInit(); labGaugeInit(); }
  const { meters, extra } = labMeters();
  el.innerHTML = `<div class="wrap lab"><h2>Laboratoř: stroj naživo</h2><p class="lead">Stroj se počítá průběžně a běží, dokud ho nevypnete; za chodu můžete přepínat napájení, zátěž i buzení. Ručky ukazují okamžité hodnoty${L.m === 'sm' ? '' : ' (u střídavého stroje efektivní)'}; červená šipka je osa magnetického pole${L.m === 'dc' ? '' : ' statoru'}, bílý pruh značka na rotoru.</p>
<div class="lbar">
<label>Stroj<select id="lb-m">${[['am', 'asynchronní 400 V'], ['dc', 'stejnosměrný 440 V'], ['sm', 'synchronní s vyniklými póly']].map(([k, t]) => `<option value="${k}"${L.m === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label>Režim<span class="seg">${[['mot', 'motor'], ['gen', L.m === 'dc' ? 'dynamo' : 'generátor']].map(([k, t]) => `<button type="button" data-lgen="${k}" aria-pressed="${(k === 'gen') === L.gen}">${t}</button>`).join('')}</span></label>
<label>Zpomalení<select id="lb-sp">${[[1, 'skutečný čas'], [0.5, '2×'], [0.2, '5×'], [0.1, '10×'], [0.05, '20×'], [0.02, '50×']].map(([v, t]) => `<option value="${v}"${+v === LAB.sp ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
<label>Setrvačnost<select id="lb-J">${[0.5, 1, 2, 4].map(v => `<option value="${v}"${v === LAB.J ? ' selected' : ''}>${fmt(v, 1)}× J</option>`).join('')}</select></label>
<span class="lrun"><button type="button" class="btn big" id="lb-go">${LAB.run ? '❚❚ Pozastavit' : '▶ Pokračovat'}</button><button type="button" class="btn" id="lb-re">↺ Znovu (stroj v klidu)</button></span>
</div>
<div id="lb-scnp" class="lgrp lscnp">${labScnHTML()}</div>
<div class="lctl"><div id="lb-ctl">${labCtlHTML()}</div><div id="lb-load">${labLoadHTML()}</div></div>
<div class="lstage">${labBench()}</div>
<div class="gauges">${meters.map(([k, t, u]) => `<div class="meter"><p>${t}</p><div id="gw-${k}">${gaugeSVG(k, ...labGR[k])}</div><div class="lcd"><span id="lcd-${k}">0</span><small>${u}</small></div></div>`).join('')}</div>
<div class="lcds">${extra.map(([k, t, u]) => `<div class="meter sm"><p>${sub(t)}</p><div class="lcd"><span id="lcx-${k}">0</span><small>${u}</small></div></div>`).join('')}</div>
<div class="lchart"><canvas id="lb-cv" aria-label="Průběh otáček, proudu a momentu za poslední 3 sekundy"></canvas><p class="note">Poslední 3 s simulace: <span class="k-n">■ otáčky</span> <span class="k-i">■ proud</span> <span class="k-m">■ moment</span> (každá veličina ve stupnici svého měřáku)</p></div>
<div class="cols2"><div><h3>Co zkusit</h3>${labTips()}</div><div><h3>Záznam</h3><ol id="lb-ev" class="lev"></ol></div></div></div>`;
  labCol = null; labLogDraw(); labDraw(); labStartLoop();
}
function labLogAdd(t) { labLog.unshift(`<li class="done"><b>${fmt(L.t, 2)} s</b> ${t}</li>`); labLog = labLog.slice(0, 10); labLogDraw(); }
function labLogDraw() { const e = $('#lb-ev'); if (e) e.innerHTML = labLog.join('') || '<li>Zatím nic; zapněte stroj.</li>'; }
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
  const m = L.meas, dc = L.m === 'dc', sm = L.m === 'sm', g = L.gen;
  const set = (id, v, d) => { const e = document.getElementById(id); if (e) e.textContent = isFinite(v) ? fmt(Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v, d) : '–'; };
  const txt = (id, t) => { const e = document.getElementById(id); if (e) e.innerHTML = lsub(t); };
  for (const k of (sm ? ['I', 'n', 'M', 'b'] : ['U', 'I', 'n', 'M'])) { labNeedle(k, m[k]); set('lcd-' + k, m[k], sm ? (k === 'n' || k === 'b' ? 0 : 2) : k === 'n' ? 0 : k === 'M' ? 1 : Math.abs(m[k]) < 100 ? 1 : 0); }
  if (sm) { set('lcx-x1', m.x1, 2); set('lcx-x2', m.x2, 2); set('lcx-x3', m.x3, 2); set('lcx-x4', m.x4, 3); if (g) { set('lcx-df', G_SM.on ? NaN : m.df, 2); set('lcx-dphi', G_SM.on ? NaN : m.dphi, 0); } }
  else if (dc) { set('lcx-x1', m.x1, 0); set('lcx-x2', m.x2, 2); set('lcx-x3', m.x3, 1); set('lcx-Mp', m.Mp, 0); }
  else { set('lcx-x1', m.x1, 1); set('lcx-x2', m.x2, 1); set('lcx-x3', m.x3, 1); set('lcx-pg', -(m.p || 0) / 1e3, 1); set('lcx-qg', (m.q || 0) / 1e3, 1); set('lcx-Mp', m.Mp, 1); }
  set('lcx-t', L.t, 1);
  $('#lab-rot').setAttribute('transform', `rotate(${(-L.thv * 180 / Math.PI % 360).toFixed(2)} 455 140)`);
  const fl = $('#lab-fld');
  if (dc) fl.style.opacity = clamp(g ? xiSat(L.d, L.s[2]) / L.d.xiN : L.s[2] / L.d.ifN, 0.05, 1).toFixed(2);
  else if (sm) { const on = g ? G_SM.on : LAB_SM.on; fl.setAttribute('transform', `rotate(${(-L.fang * 180 / Math.PI % 360).toFixed(2)} 455 140)`); fl.style.opacity = on ? 1 : 0.12; }
  else { fl.setAttribute('transform', `rotate(${(-L.fang * 180 / Math.PI % 360 + 90).toFixed(2)} 455 140)`); fl.style.opacity = Math.min(1, (L.fmag || 0) / 0.9).toFixed(2); }
  if (dc) txt('lab-if', 'I_f = ' + fmt(L.s[2], 2) + ' A');
  if (!dc && !sm && !g && LAB_AM.src === 'mf' && !LAB_AM.dcb) txt('lab-srcv', 'f = ' + fmt(L.f, 0) + ' Hz');
  const W = dc ? L.s[1] : sm ? L.nu * L.ws : L.s[4];
  if (g) {
    if (dc) { txt('lab-mz', G_DC.drv === 'asm' ? (G_DC.drvOn ? 'zapnut, n_s = ' + G_DC.ns : 'vypnut') : 'ventil ' + fmt(G_DC.v, 1) + ' %'); txt('lab-st', 'M_p = ' + fmt(m.Mp, 0) + ' N·m'); }
    else if (sm) {
      txt('lab-mz', 'ventil ' + fmt(G_SM.v, 1) + ' %'); txt('lab-st', 'M_t = ' + fmt(m.Mp, 2) + ' p.j.');
      txt('lab-syn', G_SM.on ? (Math.abs(m.sl) < 2e-3 ? 'v synchronizmu' : 'mimo synchronizmus!') : 'Δf = ' + fmt(m.df, 2) + ' Hz, Δφ = ' + fmt(m.dphi, 0) + '°'); txt('lab-syn2', G_SM.on ? '' : 'U_gen = ' + fmt(m.Ug, 2) + ' p.j. (síť 1)');
      for (let k = 0; k < 3; k++) { const e = document.getElementById('lab-lamp' + k); if (e) e.style.opacity = G_SM.on ? 0.05 : clamp(m.dU / 2, 0.05, 1).toFixed(2); }
    } else { txt('lab-mz', 'ventil ' + fmt(G_AM.v, 1) + ' %'); txt('lab-st', 'M_t = ' + fmt(m.Mp, 1) + ' N·m'); }
  } else {
    const Mz0 = LAB.load / 100 * L.MN, mzv = LAB.lt === 'fan' ? Mz0 * (W / labWb()) ** 2 : Mz0;
    txt('lab-mz', 'M_z = ' + fmt(mzv, sm ? 2 : 1) + (sm ? ' p.j.' : ' N·m'));
    txt('lab-st', sm ? (!LAB_SM.on ? 'odpojeno' : Math.abs(m.sl) < 2e-3 ? 'v synchronizmu' : 'asynchronní chod, s = ' + fmt(m.sl * 100, 1) + ' %') : '');
  }
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
  if (LAB.run && dt > 0) { labAdvance(dt * LAB.sp); labScnTick(); }
  labDraw();
  labRaf = requestAnimationFrame(labLoop);
}
function labStartLoop() { if (!labRaf) { labLast = 0; labRaf = requestAnimationFrame(labLoop); } }
function labRefresh() { $('#lb-ctl').innerHTML = labCtlHTML(); $('.lstage').innerHTML = labBench(); }

/* ---------- ovládání ---------- */
document.addEventListener('click', e => {
  if (tab !== 'lab' || !L) return;
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'lb-go') { LAB.run = !LAB.run; t.textContent = LAB.run ? '❚❚ Pozastavit' : '▶ Pokračovat'; return; }
  if (t.id === 'lb-re') { SCN = null; L = null; Object.assign(LAB_AM, { on: false, rev: false, dcb: false }); LAB_DC.on = false; Object.assign(LAB_SM, { on: false, exc: false }); G_DC.on = false; G_DC.drvOn = false; G_AM.on = false; G_SM.on = false; G_DC.v = G_AM.v = G_SM.v = 0; renderLab($('#cards')); return; }
  if (t.dataset.lgen) { SCN = null; LAB.gen = t.dataset.lgen === 'gen'; if (LAB.gen) LAB.sp = 1; L = null; renderLab($('#cards')); return; }
  const A = LAB_AM, C = LAB_DC, S = LAB_SM;
  if (t.dataset.lsrc) { A.src = t.dataset.lsrc; if (A.src === 'mf') A.yd = 'D'; labLogAdd(A.src === 'sit' ? 'napájení ze sítě' : 'napájení z měniče frekvence'); }
  else if (t.dataset.lmode) { C.mode = t.dataset.lmode; L.ci.x = 0; L.cw.x = 0; L.nr = L.s[1]; L.s[3] = C.mode === 'reg' && C.on ? C.U : 0; labLogAdd(C.mode === 'u' ? 'ruční zdroj napětí' : 'regulace rychlosti'); }
  else if (t.dataset.ldrv) { G_DC.drv = t.dataset.ldrv; $('#lb-load').innerHTML = labLoadHTML(); labLogAdd(G_DC.drv === 'asm' ? 'pohon asynchronním motorem' : 'pohon turbínou'); }
  else if (t.dataset.lns) { G_DC.ns = +t.dataset.lns; $('#lb-load').innerHTML = labLoadHTML(); labLogAdd('pohonný motor n_s = ' + G_DC.ns + ' ot/min'); }
  else if (t.dataset.lexc) { G_DC.exc = t.dataset.lexc; labLogAdd(G_DC.exc === 'cizi' ? 'cizí buzení' : 'derivační buzení'); }
  else if (t.dataset.llt) { LAB.lt = t.dataset.llt; document.querySelectorAll('[data-llt]').forEach(b => b.setAttribute('aria-pressed', b.dataset.llt === LAB.lt)); labLogAdd('zátěž: ' + t.textContent); return; }
  else if (t.dataset.lt) {
    const k = t.dataset.lt;
    if (L.gen) {
      const G = L.m === 'dc' ? G_DC : L.m === 'am' ? G_AM : G_SM;
      if (k === 'on') {
        G.on = !G.on;
        if (L.m === 'sm' && G.on) { const m = L.meas; labLogAdd(`fázováno při Δf = ${fmt(m.df, 2)} Hz, Δφ = ${fmt(m.dphi, 0)}°`); }
        else labLogAdd(L.m === 'dc' ? (G.on ? 'zátěž připojena' : 'zátěž odpojena') : G.on ? 'připojeno na síť' : 'odpojeno od sítě');
      }
      if (k === 'exc') { G.exc = !G.exc; labLogAdd(G.exc ? 'buzení zapnuto' : 'buzení vypnuto'); }
      if (k === 'drv') { G_DC.drvOn = !G_DC.drvOn; $('#lb-load').innerHTML = labLoadHTML(); labLogAdd(G_DC.drvOn ? 'pohonný motor zapnut' : 'pohonný motor vypnut'); }
    } else if (L.m === 'am') {
      if (k === 'on') { A.on = !A.on; if (!A.on) A.dcb = false; labLogAdd(A.on ? 'stykač sepnut' : 'stykač rozepnut'); }
      if (k === 'yd') { A.yd = A.yd === 'Y' ? 'D' : 'Y'; labLogAdd('vinutí přepnuto do ' + (A.yd === 'Y' ? 'hvězdy' : 'trojúhelníku')); }
      if (k === 'rev') { A.rev = !A.rev; labLogAdd(A.rev ? 'přehozeny dvě fáze (opačný sled)' : 'původní sled fází'); }
      if (k === 'dcb') { A.dcb = !A.dcb; if (A.dcb) A.on = true; labLogAdd(A.dcb ? 'stejnosměrné brzdění' : 'konec stejnosměrného brzdění'); }
    } else if (L.m === 'sm') {
      if (k === 'on') { S.on = !S.on; labLogAdd(S.on ? 'připojeno na síť' : 'odpojeno od sítě'); }
      if (k === 'exc') { S.exc = !S.exc; labLogAdd(S.exc ? 'buzení zapnuto' : 'buzení vypnuto'); }
    } else if (k === 'on') { C.on = !C.on; labLogAdd(C.on ? 'zapnuto' : 'vypnuto'); }
  } else return;
  labRefresh();
});
const LAB_UNITS = { fset: 'Hz', ramp: 'Hz/s', Rp: 'Ω', U: 'V', nset: 'ot/min', Imax: 'A', kf: '% U_fN', load: '% M_N', Ui: 'p.j.', Rz: 'Ω', Rreg: 'Ω' };
document.addEventListener('input', e => {
  if (tab !== 'lab' || !L) return;
  const k = e.target.dataset && e.target.dataset.ls; if (!k) return;
  const v = +e.target.value, o = document.getElementById('lv-' + k), st = +e.target.step;
  const unit = k === 'v' ? '%' : LAB_UNITS[k] || '';
  if (o) o.innerHTML = fmt(v, decOf(st)) + ' ' + sub(unit);
  if (k === 'load') LAB.load = v;
  else if (L.gen) (L.m === 'dc' ? G_DC : L.m === 'am' ? G_AM : G_SM)[k] = v;
  else if (L.m === 'am') LAB_AM[k] = v; else if (L.m === 'sm') LAB_SM[k] = v; else LAB_DC[k] = v;
});
document.addEventListener('change', e => {
  if (tab !== 'lab') return;
  const id = e.target.id, k = e.target.dataset && e.target.dataset.ls;
  if (k && L) {
    const names = { load: 'zátěž', fset: 'žádaná frekvence', ramp: 'rampa', Rp: 'odpor R_p', U: 'napětí', nset: 'otáčky', Imax: 'omezení proudu', kf: 'buzení', Ui: 'buzení U_i', Rz: 'zátěžný odpor', Rreg: 'R_reg', v: 'ventil turbíny' };
    labLogAdd(sub(names[k]) + ' ' + e.target.value); $('.lstage').innerHTML = labBench(); return;
  }
  if (id === 'lb-m') { SCN = null; LAB.m = e.target.value; L = null; renderLab($('#cards')); }
  else if (id === 'lb-sp') LAB.sp = +e.target.value;
  else if (id === 'lb-J') { LAB.J = +e.target.value; L = null; renderLab($('#cards')); labLogAdd('setrvačnost ' + fmt(LAB.J, 1) + '× (začíná se znovu)'); }
});
window.addEventListener('resize', () => { if (tab === 'lab' && L) labChart(); });

/* ===== Scénáře: řízený průběh pokusu s komentářem ===== */
const LAB_DEF = JSON.parse(JSON.stringify({ LAB, LAB_AM, LAB_DC, LAB_SM, G_DC, G_AM, G_SM }));
function labResetAll() {
  const D = JSON.parse(JSON.stringify(LAB_DEF));
  Object.assign(LAB, D.LAB, { run: true }); Object.assign(LAB_AM, D.LAB_AM); Object.assign(LAB_DC, D.LAB_DC); Object.assign(LAB_SM, D.LAB_SM);
  Object.assign(G_DC, D.G_DC); Object.assign(G_AM, D.G_AM); Object.assign(G_SM, D.G_SM);
}
const mN = () => L.meas.n, mS = () => L.meas.sl;
/* krok: t = prodleva po předchozím kroku [s simulace], w = podmínka, a = akce, s = komentář */
const LAB_SCN = [
  { g: 'Asynchronní motor', id: 'am-dol', n: 'Přímý rozběh a zatížení', m: 'am', sp: 0.2, steps: [
    { t: 0.3, a: () => { LAB_AM.on = true; }, s: 'Stykač sepnut. Proud skočí na 5–7násobek I_N a moment v prvních periodách kmitá: v toku jsou stejnosměrné složky, které doznívají.' },
    { w: () => mN() > 1480, t: 0.3, s: 'Motor je rozběhnutý naprázdno: skluz pod 1 %, ampérmetr ukazuje už jen magnetizační proud.' },
    { t: 0.2, a: () => { LAB.load = 100; }, s: 'Připojena jmenovitá zátěž: otáčky klesnou asi na 1450 ot/min (skluz kolem 3 %) a proud vzroste na jmenovitý.' },
    { t: 1.5, a: () => { LAB.load = 0; }, s: 'Odlehčení: motor se vrátí těsně pod synchronní otáčky.' },
    { t: 1, s: 'Konec scénáře. Zkuste si zátěž a stykač dál ovládat sami.' }] },
  { g: 'Asynchronní motor', id: 'am-yd', n: 'Rozběh hvězda–trojúhelník', m: 'am', sp: 0.2, init: () => { LAB_AM.yd = 'Y'; LAB.lt = 'fan'; LAB.load = 80; }, steps: [
    { t: 0.3, a: () => { LAB_AM.on = true; }, s: 'Zapnuto ve hvězdě: na vinutí je U/√3, proud ze sítě i moment jsou třetinové proti přímému připojení.' },
    { w: () => mN() > 1300, t: 0.5, s: 'Motor se rozběhl do ustálených otáček ve hvězdě (ventilátorová zátěž roste s n²).' },
    { t: 0.1, a: () => { LAB_AM.yd = 'D'; }, s: 'Přepnuto na trojúhelník: druhý proudový ráz, ale menší než při přímém rozběhu, protože motor už běží.' },
    { t: 1.5, s: 'Motor pracuje v trojúhelníku s plným napětím: skluz se zmenšil. Konec scénáře.' }] },
  { g: 'Asynchronní motor', id: 'am-rp', n: 'Kroužkový motor: odstupňovaný rotorový odpor', m: 'am', sp: 0.2, init: () => { LAB_AM.Rp = 2.5; LAB.load = 100; }, steps: [
    { t: 0.3, a: () => { LAB_AM.on = true; }, s: 'Rozběh s odporem 2,5 Ω v rotoru: záběrný proud je menší a moment větší (moment zvratu se posunul k malým otáčkám).' },
    { w: () => mN() > 600, t: 0, a: () => { LAB_AM.Rp = 1.2; }, s: 'První stupeň vyřazen (1,2 Ω): proud i moment krátce vyskočí, motor zrychlí.' },
    { w: () => mN() > 1050, t: 0, a: () => { LAB_AM.Rp = 0.4; }, s: 'Druhý stupeň (0,4 Ω).' },
    { w: () => mN() > 1300, t: 0, a: () => { LAB_AM.Rp = 0; }, s: 'Rotor nakrátko: motor jede na přirozené charakteristice se skluzem kolem 3 %.' },
    { t: 1.5, s: 'Konec scénáře. Se stálým odporem v rotoru by motor jel s velkým skluzem a ztrátami v odporníku.' }] },
  { g: 'Asynchronní motor', id: 'am-plug', n: 'Brzdění protiproudem', m: 'am', sp: 0.2, init: () => { LAB.load = 30; }, steps: [
    { t: 0.3, a: () => { LAB_AM.on = true; }, s: 'Rozběh.' },
    { w: () => mN() > 1440, t: 0.5, a: () => { LAB_AM.rev = true; }, s: 'Přehozeny dvě fáze: pole se točí opačně, skluz je téměř 2. Proud je velký (jako při záběru) a moment brzdí.' },
    { w: () => mN() < 20, t: 0, a: () => { LAB_AM.on = false; LAB_AM.rev = false; }, s: 'V nule je nutné motor odpojit (to dělá čidlo nulových otáček), jinak by se rozběhl opačně.' },
    { t: 1, s: 'Konec scénáře. Zkuste reverzaci bez vypnutí: motor se rozběhne na opačnou stranu.' }] },
  { g: 'Asynchronní motor', id: 'am-dcb', n: 'Stejnosměrné (dynamické) brzdění', m: 'am', sp: 0.2, steps: [
    { t: 0.3, a: () => { LAB_AM.on = true; }, s: 'Rozběh.' },
    { w: () => mN() > 1480, t: 0.5, a: () => { LAB_AM.dcb = true; }, s: 'Stator odpojen od sítě a napájen stejnosměrným proudem: pole stojí (šipka se nehýbe), rotor v něm pracuje jako generátor do vlastního odporu a brzdí.' },
    { w: () => Math.abs(mN()) < 10, t: 0.2, a: () => { LAB_AM.dcb = false; LAB_AM.on = false; }, s: 'Motor stojí, brzdění vypnuto. Na rozdíl od protiproudu se motor sám nerozběhne opačně.' }] },
  { g: 'Asynchronní motor', id: 'am-over', n: 'Přetížení nad moment zvratu', m: 'am', sp: 0.2, init: () => { LAB.lt = 'pot'; }, steps: [
    { t: 0.3, a: () => { LAB_AM.on = true; }, s: 'Rozběh naprázdno.' },
    { w: () => mN() > 1480, t: 0.3, a: () => { LAB.load = 100; }, s: 'Zátěž 100 % M_N (aktivní, např. zdvih).' },
    { t: 1.2, a: () => { LAB.load = 180; }, s: '180 % M_N: skluz roste, motor se blíží momentu zvratu (u tohoto motoru asi 2,5 M_N).' },
    { t: 1.2, a: () => { LAB.load = 240; }, s: '240 % M_N: těsně pod momentem zvratu, skluz je kolem 15 %.' },
    { t: 1.2, a: () => { LAB.load = 270; }, s: '270 % M_N: zátěž je větší než moment zvratu. Motor se zastaví a aktivní zátěž ho roztočí opačně (břemeno padá).' },
    { t: 1.2, a: () => { LAB_AM.on = false; LAB.lt = 'react'; LAB.load = 100; }, s: 'Vypnuto a zabrzděno mechanickou brzdou. Proto se u zdvihů hlídá přetížení a vždy je tam brzda.' }] },
  { g: 'Asynchronní motor', id: 'am-uf', n: 'Měnič U/f: rampa, zpomalení, reverzace', m: 'am', sp: 0.2, init: () => { LAB_AM.src = 'mf'; LAB_AM.fset = 50; LAB_AM.ramp = 25; }, steps: [
    { t: 0.3, a: () => { LAB_AM.on = true; }, s: 'Měnič zvyšuje frekvenci rampou 25 Hz/s a napětí úměrně (U/f = konst., při malých f s kompenzací R₁). Proud zůstává malý, motor sleduje točivé pole se skluzem.' },
    { w: () => mN() > 1480, t: 0.3, a: () => { LAB.load = 100; }, s: 'Jmenovitá zátěž při 50 Hz.' },
    { t: 1.2, a: () => { LAB_AM.fset = 25; }, s: 'Snížení na 25 Hz: pole zpomaluje rychleji než rotor, motor je chvíli nad synchronními otáčkami a brzdí generátorově (moment záporný).' },
    { t: 2.5, a: () => { LAB_AM.rev = true; LAB.load = 50; }, s: 'Reverzace: frekvence projde nulou a pole se roztočí opačně; plynulý přechod bez proudového rázu.' },
    { t: 4, s: 'Konec scénáře.' }] },
  { g: 'Stejnosměrný motor', id: 'dc-rp', n: 'Rozběh s odstupňovaným předřadným odporem', m: 'dc', sp: 0.2, init: () => { LAB_DC.Rp = 2.5; LAB.load = 100; }, steps: [
    { t: 0.3, a: () => { LAB_DC.on = true; }, s: 'Zapnuto přes R_p = 2,5 Ω: v záběru je U_i = 0 a proud omezí jen odpor, I ≈ 440/2,7 ≈ 163 A. S rostoucími otáčkami roste U_i a proud klesá.' },
    { w: () => mN() > 450, t: 0, a: () => { LAB_DC.Rp = 1.0; }, s: 'Vyřazen první stupeň (zbývá 1,0 Ω): proud skočí nahoru a motor zrychlí.' },
    { w: () => mN() > 1000, t: 0, a: () => { LAB_DC.Rp = 0.4; }, s: 'Druhý stupeň (zbývá 0,4 Ω).' },
    { w: () => mN() > 1300, t: 0, a: () => { LAB_DC.Rp = 0; }, s: 'Odpor vyřazen úplně: motor na přirozené charakteristice.' },
    { t: 1.5, s: 'Konec scénáře. Pro porovnání: přímé zapnutí bez odporu by dalo proud přes 2000 A.' }] },
  { g: 'Stejnosměrný motor', id: 'dc-fw', n: 'Odbuzování (zeslabení toku)', m: 'dc', sp: 0.2, init: () => { LAB_DC.Rp = 2; LAB.load = 50; }, steps: [
    { t: 0.3, a: () => { LAB_DC.on = true; }, s: 'Rozběh přes předřadný odpor.' },
    { w: () => mN() > 1100, t: 0, a: () => { LAB_DC.Rp = 0; }, s: 'Odpor vyřazen.' },
    { t: 1.5, a: () => { LAB_DC.kf = 70; }, s: 'Budicí napětí na 70 %: tok klesá s časovou konstantou buzení (1 s), indukované napětí klesne, proud vzroste a motor zrychlí nad jmenovité otáčky.' },
    { t: 3, a: () => { LAB_DC.kf = 50; }, s: '50 %: rychlost ještě vzroste, ale pro stejný moment je potřeba větší proud (M = cΦI).' },
    { t: 3, a: () => { LAB_DC.kf = 100; }, s: 'Plné buzení: motor zpomalí a krátce brzdí (proud se obrátí).' },
    { t: 3, s: 'Konec scénáře.' }] },
  { g: 'Stejnosměrný motor', id: 'dc-reg', n: 'Rekuperační brzdění snížením napětí', m: 'dc', sp: 0.2, init: () => { LAB_DC.Rp = 2; }, steps: [
    { t: 0.3, a: () => { LAB_DC.on = true; }, s: 'Rozběh.' },
    { w: () => mN() > 1300, t: 0, a: () => { LAB_DC.Rp = 0; }, s: 'Odpor vyřazen, motor běží naprázdno při 440 V.' },
    { t: 1, a: () => { LAB_DC.U = 300; }, s: 'Napětí sníženo na 300 V: indukované napětí je větší než napětí zdroje, proud i moment změní smysl a motor vrací energii do zdroje (rekuperace, II. kvadrant).' },
    { t: 2.5, a: () => { LAB_DC.U = 150; }, s: 'Další snížení: znovu brzdný proud a pokles rychlosti.' },
    { t: 2.5, a: () => { LAB_DC.U = 440; }, s: 'Zpět na 440 V: motor zrychlí (I. kvadrant).' },
    { t: 2, s: 'Konec scénáře. Zdroj musí umět přijmout proud opačného smyslu (např. reverzační usměrňovač).' }] },
  { g: 'Stejnosměrný motor', id: 'dc-casc', n: 'Kaskádní regulace: rozběh, zatížení, reverzace', m: 'dc', sp: 0.2, init: () => { LAB_DC.mode = 'reg'; LAB_DC.nset = 1500; }, steps: [
    { t: 0.3, a: () => { LAB_DC.on = true; }, s: 'Žádaná rychlost 1500 ot/min s rampou: regulátor rychlosti žádá proud až do omezení I_max = 200 A, regulátor proudu ho drží. Rozběh je rychlý a bez proudového rázu.' },
    { w: () => mN() > 1490, t: 0.5, a: () => { LAB.load = 100; }, s: 'Jmenovitá zátěž: rychlost krátce poklesne a PI regulátor ji vrátí na žádanou hodnotu (žádná trvalá odchylka).' },
    { t: 1.5, a: () => { LAB_DC.nset = -1500; }, s: 'Reverzace na −1500 ot/min: motor brzdí rekuperačně s omezeným proudem, projde nulou a rozběhne se opačně (čtyřkvadrantový pohon).' },
    { t: 3, s: 'Konec scénáře.' }] },
  { g: 'Synchronní motor', id: 'sm-start', n: 'Asynchronní rozběh a vtažení do synchronizmu', m: 'sm', sp: 0.5, init: () => { LAB.load = 30; LAB_SM.Ui = 1.2; }, steps: [
    { t: 0.3, a: () => { LAB_SM.on = true; }, s: 'Připojeno na síť bez buzení: moment dává tlumicí (rozběhová) klec jako u asynchronního motoru. Proud kolísá s rozdílovým kmitočtem.' },
    { w: () => mS() < 0.05, t: 0.5, s: 'Motor se rozběhl těsně pod synchronní otáčky; skluz je několik procent.' },
    { t: 0.1, a: () => { LAB_SM.exc = true; }, s: 'Zapnuto buzení: rotor se „vtáhne“ do synchronizmu (zaskočí), skluz je nula a zátěžný úhel β se ustálí po tlumeném kývání.' },
    { t: 3, s: 'Motor běží synchronně. Konec scénáře.' }] },
  { g: 'Synchronní motor', id: 'sm-pullout', n: 'Vypadnutí ze synchronizmu přetížením', m: 'sm', sp: 0.5, init: () => { LAB.load = 30; LAB_SM.Ui = 1.2; LAB.lt = 'pot'; }, steps: [
    { t: 0.3, a: () => { LAB_SM.on = true; }, s: 'Asynchronní rozběh.' },
    { w: () => mS() < 0.05, t: 0.3, a: () => { LAB_SM.exc = true; }, s: 'Buzení zapnuto, motor v synchronizmu.' },
    { t: 2.5, a: () => { LAB.load = 80; }, s: 'Zátěž 0,8 p.j.: zátěžný úhel β vzroste.' },
    { t: 2.5, a: () => { LAB.load = 115; }, s: '1,15 p.j.: β se blíží statické mezi (u U_i = 1,2 je největší moment asi 1,27 p.j.).' },
    { t: 2.5, a: () => { LAB.load = 140; }, s: '1,4 p.j.: zátěž je nad statickou mezí. Motor vypadne ze synchronizmu: β roste nad 180°, moment i proud prudce kmitají, rotor prokluzuje.' },
    { t: 3, a: () => { LAB.load = 30; }, s: 'Odlehčení: tlumič a moment stroje ho mohou znovu vtáhnout do synchronizmu.' },
    { t: 3, s: 'Konec scénáře. V provozu by ochrana při ztrátě synchronizmu motor odpojila.' }] },
  { g: 'Synchronní motor', id: 'sm-v', n: 'V-křivka: změna buzení při stálé zátěži', m: 'sm', sp: 0.5, init: () => { LAB.load = 50; LAB_SM.Ui = 1.0; }, steps: [
    { t: 0.3, a: () => { LAB_SM.on = true; }, s: 'Asynchronní rozběh.' },
    { w: () => mS() < 0.05, t: 0.3, a: () => { LAB_SM.exc = true; }, s: 'Buzení zapnuto (U_i = 1,0), motor v synchronizmu se zátěží 0,5 p.j.' },
    { t: 2.5, a: () => { LAB_SM.Ui = 0.7; }, s: 'Podbuzení (U_i = 0,7): motor odebírá jalový výkon (Q > 0), proud vzroste, účiník je induktivní. Zátěžný úhel se zvětšil.' },
    { t: 2.5, a: () => { LAB_SM.Ui = 1.15; }, s: 'U_i ≈ 1,15: blízko minima proudu, cos φ ≈ 1 (dno V-křivky).' },
    { t: 2.5, a: () => { LAB_SM.Ui = 1.7; }, s: 'Přebuzení (U_i = 1,7): motor dodává jalový výkon (Q < 0), chová se jako kondenzátor a může kompenzovat účiník továrny. Proud zase roste.' },
    { t: 2.5, s: 'Činný výkon se celou dobu neměnil, buzení mění jen jalový výkon. Konec scénáře.' }] },
  { g: 'Synchronní motor', id: 'sm-noexc', n: 'Ztráta buzení za chodu', m: 'sm', sp: 0.5, init: () => { LAB.load = 20; LAB_SM.Ui = 1.2; }, steps: [
    { t: 0.3, a: () => { LAB_SM.on = true; }, s: 'Asynchronní rozběh s malou zátěží.' },
    { w: () => mS() < 0.05, t: 0.3, a: () => { LAB_SM.exc = true; }, s: 'Buzení zapnuto, motor v synchronizmu.' },
    { t: 2, a: () => { LAB.load = 60; }, s: 'Zátěž zvýšena na 0,6 p.j.' },
    { t: 2.5, a: () => { LAB_SM.exc = false; }, s: 'Výpadek buzení: zbývá jen reluktanční moment (vyniklé póly) a ten na zátěž nestačí. Motor vypadne ze synchronizmu a běží asynchronně na tlumiči s velkým proudem.' },
    { t: 4, a: () => { LAB_SM.exc = true; }, s: 'Buzení obnoveno: motor se znovu vtáhne do synchronizmu.' },
    { t: 3, s: 'Konec scénáře.' }] },
  { g: 'Synchronní generátor', id: 'sg-sync', n: 'Fázování na síť a dodávka výkonu', m: 'sm', gen: true, sp: 1, init: () => { G_SM.exc = true; G_SM.Ui = 1.0; }, steps: [
    { t: 0.2, a: () => { G_SM.v = 40; }, s: 'Ventil turbíny otevřen na 40 %: soustrojí se rozbíhá. Buzení je zapnuté, napětí generátoru roste s otáčkami.' },
    { w: () => mN() > 1450, t: 0, a: () => { G_SM.v = 10.2; }, s: 'Ventil přivřen na 10,2 %: otáčky se ustalují těsně nad 1500 ot/min. Žárovky synchronoskopu blikají s rozdílovým kmitočtem Δf.' },
    { w: () => { const m = L.meas; return Math.abs(m.df) < 0.4 && Math.abs(m.dphi) < 8; }, t: 0, a: () => { G_SM.on = true; }, s: 'Podmínky splněny: stejný sled fází, napětí, kmitočet a fáze (žárovky zhasly). Vypínač sepnut: téměř bez rázu.' },
    { t: 2, a: () => { G_SM.v = 40; }, s: 'Ventil 40 %: zátěžný úhel β roste a generátor dodává činný výkon do sítě. Otáčky drží síť.' },
    { t: 3, a: () => { G_SM.v = 80; }, s: 'Ventil 80 %: výkon asi 0,7 p.j.' },
    { t: 3, a: () => { G_SM.Ui = 1.6; }, s: 'Přibuzení: generátor dodává do sítě i jalový výkon (Q > 0), zátěžný úhel se zmenší. Činný výkon se nezměnil.' },
    { t: 3, s: 'Konec scénáře.' }] },
  { g: 'Synchronní generátor', id: 'sg-bad', n: 'Chybné fázování mimo fázi', m: 'sm', gen: true, sp: 1, init: () => { G_SM.exc = true; G_SM.Ui = 1.0; }, steps: [
    { t: 0.2, a: () => { G_SM.v = 40; }, s: 'Rozběh turbínou.' },
    { w: () => mN() > 1450, t: 0, a: () => { G_SM.v = 10.4; }, s: 'Otáčky se ustalují kolem 1500 ot/min.' },
    { w: () => { const m = L.meas; return Math.abs(m.df) < 0.8 && Math.abs(m.dphi) > 120 && Math.abs(m.dphi) < 150; }, t: 0, a: () => { G_SM.on = true; }, s: 'Sepnuto při fázovém rozdílu přes 120° (žárovky svítí naplno). Napětí generátoru a sítě jsou téměř proti sobě: velký proudový i momentový ráz, rotor se prudce kývá. Ve skutečnosti hrozí poškození hřídele a vinutí.' },
    { t: 4, s: 'Stroj se po kývání stáhl do synchronizmu díky tlumiči. Konec scénáře.' }] },
  { g: 'Synchronní generátor', id: 'sg-under', n: 'Odbuzení generátoru na síti', m: 'sm', gen: true, sp: 1, init: () => { G_SM.exc = true; G_SM.Ui = 1.0; }, steps: [
    { t: 0.2, a: () => { G_SM.v = 40; }, s: 'Rozběh turbínou.' },
    { w: () => mN() > 1450, t: 0, a: () => { G_SM.v = 10.2; }, s: 'Dolaďování otáček.' },
    { w: () => { const m = L.meas; return Math.abs(m.df) < 0.4 && Math.abs(m.dphi) < 8; }, t: 0, a: () => { G_SM.on = true; }, s: 'Nafázováno.' },
    { t: 1.5, a: () => { G_SM.v = 60; }, s: 'Výkon asi 0,5 p.j.' },
    { t: 3, a: () => { G_SM.Ui = 0.7; }, s: 'Podbuzení (U_i = 0,7): generátor odebírá jalový výkon ze sítě, zátěžný úhel β se zvětší.' },
    { t: 3, a: () => { G_SM.Ui = 0.45; }, s: 'U_i = 0,45: β se blíží mezi stability.' },
    { t: 3, a: () => { G_SM.Ui = 0.25; }, s: 'U_i = 0,25: maximální výkon stroje je menší než výkon turbíny. Generátor vypadne ze synchronizmu a prokluzuje (asynchronní chod nad synchronními otáčkami).' },
    { t: 3, a: () => { G_SM.v = 0; G_SM.on = false; }, s: 'Ochrana odpojila generátor a zavřela ventil. Proto má buzení dolní mez (omezovač podbuzení).' }] },
  { g: 'Synchronní generátor', id: 'sg-trip', n: 'Odpojení zatíženého generátoru a přeběh turbíny', m: 'sm', gen: true, sp: 1, init: () => { G_SM.exc = true; G_SM.Ui = 1.2; }, steps: [
    { t: 0.2, a: () => { G_SM.v = 40; }, s: 'Rozběh turbínou.' },
    { w: () => mN() > 1450, t: 0, a: () => { G_SM.v = 10.2; }, s: 'Dolaďování otáček.' },
    { w: () => { const m = L.meas; return Math.abs(m.df) < 0.4 && Math.abs(m.dphi) < 8; }, t: 0, a: () => { G_SM.on = true; }, s: 'Nafázováno.' },
    { t: 1.5, a: () => { G_SM.v = 80; }, s: 'Plný výkon.' },
    { t: 3, a: () => { G_SM.on = false; }, s: 'Vypínač vypnul (porucha v síti). Turbína má stále otevřený ventil a nic ji nebrzdí: otáčky prudce rostou (přeběh).' },
    { t: 2.5, a: () => { G_SM.v = 0; }, s: 'Rychlouzávěr zavřel ventil, turbína dobíhá. V reálu hlídá přeběh ochrana a regulátor otáček.' },
    { t: 4, s: 'Konec scénáře.' }] },
  { g: 'Asynchronní generátor', id: 'ag', n: 'Připojení na síť a dodávka výkonu', m: 'am', gen: true, sp: 1, steps: [
    { t: 0.2, a: () => { G_AM.v = 30; }, s: 'Ventil 30 %: turbína roztáčí stroj (zatím odpojený, bez buzení).' },
    { w: () => mN() > 1460, t: 0, a: () => { G_AM.v = 11; G_AM.on = true; }, s: 'Připojeno na síť blízko synchronních otáček: stroj se vybudí ze sítě a odebírá jalový (magnetizační) proud. Synchronizace není potřeba.' },
    { t: 2, a: () => { G_AM.v = 50; }, s: 'Ventil 50 %: otáčky stoupnou nad synchronní (záporný skluz kolem 1 %) a činný výkon teče do sítě. Jalový výkon stroj dál odebírá.' },
    { t: 3, a: () => { G_AM.v = 90; }, s: 'Ventil 90 %: větší výkon a větší záporný skluz.' },
    { t: 3, a: () => { G_AM.v = 0; }, s: 'Ventil zavřen: stroj přejde do motorického chodu a pohání turbínu (bere činný výkon ze sítě).' },
    { t: 3, a: () => { G_AM.on = false; }, s: 'Odpojeno. Konec scénáře.' }] },
  { g: 'Dynamo', id: 'dg-self', n: 'Samobuzení derivačního dynama a kritický odpor', m: 'dc', gen: true, sp: 1, init: () => { G_DC.exc = 'der'; G_DC.Rreg = 60; }, steps: [
    { t: 0.2, a: () => { G_DC.drvOn = true; }, s: 'Pohonný asynchronní motor roztáčí dynamo. Na kotvě je zpočátku jen malé napětí z remanence.' },
    { t: 3, s: 'Remanentní napětí protlačí budicím obvodem proud, který tok zesílí: napětí roste, až se ustálí v průsečíku magnetizační křivky s odporovou přímkou (R_f + R_reg).' },
    { t: 5, a: () => { G_DC.Rreg = 170; }, s: 'R_reg = 170 Ω: odporová přímka je strmější, průsečík leží níž, napětí klesne.' },
    { t: 5, a: () => { G_DC.Rreg = 260; }, s: 'R_reg = 260 Ω: odpor budicího obvodu je nad kritickým (asi 290 Ω celkem). Dynamo se odbudí, zbude jen remanentní napětí.' },
    { t: 6, a: () => { G_DC.Rreg = 60; }, s: 'Zpět na 60 Ω: dynamo se znovu nabudí.' },
    { t: 6, a: () => { G_DC.ns = 1000; }, s: 'Pohonný motor 1000 ot/min: při menších otáčkách je kritický odpor menší a napětí klesne víc než úměrně otáčkám.' },
    { t: 5, s: 'Konec scénáře.' }] },
  { g: 'Dynamo', id: 'dg-ext', n: 'Vnější (zatěžovací) charakteristika', m: 'dc', gen: true, sp: 1, init: () => { G_DC.exc = 'cizi'; G_DC.Rz = 60; }, steps: [
    { t: 0.2, a: () => { G_DC.drvOn = true; }, s: 'Pohonný motor zapnut, dynamo s cizím buzením běží naprázdno: U = U_i.' },
    { t: 5, a: () => { G_DC.on = true; }, s: 'Zátěž 60 Ω: teče proud, svorkové napětí klesne o úbytek R_a I, pohonný motor musí dodat moment.' },
    { t: 2, a: () => { G_DC.Rz = 20; }, s: 'R_z = 20 Ω: větší proud, větší úbytek napětí. Pohonný motor trochu zpomalí (skluz).' },
    { t: 2, a: () => { G_DC.Rz = 8; }, s: 'R_z = 8 Ω: přetížení; napětí dál klesá.' },
    { t: 2, a: () => { G_DC.exc = 'der'; G_DC.Rreg = 60; }, s: 'Přepnuto na derivační buzení se stejnou zátěží: s poklesem napětí klesá i budicí proud, takže napětí klesá výrazněji (měkčí charakteristika).' },
    { t: 4, a: () => { G_DC.on = false; }, s: 'Zátěž odpojena. Konec scénáře.' }] }
];
let SCN = null;
function labScnStart(id) {
  const sc = LAB_SCN.find(x => x.id === id); if (!sc) return;
  labResetAll(); LAB.m = sc.m; LAB.gen = !!sc.gen; LAB.sp = sc.sp || 0.2;
  if (sc.init) sc.init();
  L = null; SCN = { sc, i: 0, t0: 0 }; renderLab($('#cards'));
  SCN.t0 = L.t; labLogAdd('scénář: ' + sc.n);
}
function labScnTick() {
  if (!SCN || !L) return;
  let changed = false;
  while (SCN.i < SCN.sc.steps.length) {
    const st = SCN.sc.steps[SCN.i];
    if (st.w && !SCN.wok) { if (!st.w()) break; SCN.wok = true; SCN.t0 = L.t; }
    if (L.t - SCN.t0 < (st.t || 0)) break;
    if (st.a) st.a();
    labLogAdd(st.s.length > 70 ? st.s.slice(0, 68).replace(/\s\S*$/, '') + '…' : st.s);
    SCN.i++; SCN.t0 = L.t; SCN.wok = false; changed = true; SCN.last = st.s;
  }
  if (changed) { labRefresh(); $('#lb-load').innerHTML = labLoadHTML(); labScnDraw(); }
}
function labScnHTML() {
  const groups = [...new Set(LAB_SCN.map(x => x.g))];
  return `<div class="lscn"><label>Scénář<select id="lb-scn"><option value="">vyberte…</option>${groups.map(g => `<optgroup label="${g}">${LAB_SCN.filter(x => x.g === g).map(x => `<option value="${x.id}"${SCN && SCN.sc.id === x.id ? ' selected' : ''}>${x.n}</option>`).join('')}</optgroup>`).join('')}</select></label>
<button type="button" class="btn big" id="lb-scn-go">▶ Spustit scénář</button>${SCN ? '<button type="button" class="btn" id="lb-scn-stop">Ukončit scénář</button>' : ''}</div><div id="lb-scn-box">${labScnBox()}</div>`;
}
function labScnBox() {
  if (!SCN) return '';
  const sc = SCN.sc, done = SCN.i >= sc.steps.length;
  return `<div class="lnow"><p class="lgh">${sc.n}${done ? ' (dokončeno)' : ''}</p><p class="lnowt">${sub(SCN.last || 'Připravuji…')}</p><ol class="lsteps">${sc.steps.map((s, k) => `<li class="${k < SCN.i ? 'done' : k === SCN.i ? 'cur' : ''}">${sub(s.s.split(':')[0].split('.')[0])}</li>`).join('')}</ol></div>`;
}
function labScnDraw() { const b = $('#lb-scn-box'); if (b) b.innerHTML = labScnBox(); }
document.addEventListener('click', e => {
  if (tab !== 'lab') return;
  if (e.target.id === 'lb-scn-go') { const v = $('#lb-scn').value; if (v) labScnStart(v); }
  if (e.target.id === 'lb-scn-stop') { SCN = null; const p = $('#lb-scnp'); if (p) p.innerHTML = labScnHTML(); }
});
