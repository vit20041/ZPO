/* ===== Jádro simulace (ověřeno v Node, vkládá se do stránky) ===== */
const TAU = 2 * Math.PI, SQ3 = Math.sqrt(3);
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const toRpm = w => w * 60 / TAU, toRad = n => n * TAU / 60;

/* Zátěžný moment podle kap. 2: aktivní (potenciální), pasivní (tření), ventilátorový, kalandrový */
function loadTorque(type, M0, W, Wb, Mdrive) {
  if (M0 === 0) return 0;
  if (type === 'pot') return M0;
  if (type === 'react') {
    if (Math.abs(W) > 0.05) return M0 * Math.sign(W);
    return clamp(Mdrive, -Math.abs(M0), Math.abs(M0));   /* klid: tření drží, dokud M < M_z */
  }
  const r = W / Wb;
  if (type === 'fan') return M0 * r * Math.abs(r);
  return M0 * r;                                            /* 'lin' kalandrová */
}

/* PI regulátor K_P(1 + 1/(sT_I)) s podmíněnou integrací (anti-windup); T_I = 0 → jen P */
function mkPI(kp, ti) { return { kp, ti, x: 0 }; }
function pi(c, e, lo, hi, dt, ff) {
  ff = ff || 0;
  const u = c.kp * e + c.x + ff, us = u < lo ? lo : u > hi ? hi : u;
  if (c.ti > 0 && !((u > hi && e > 0) || (u < lo && e < 0))) c.x += c.kp / c.ti * e * dt;
  return us;
}

function rk4(s, dt, fn, K) {
  const n = s.length, k1 = K[0], k2 = K[1], k3 = K[2], k4 = K[3], y = K[4];
  fn(s, k1); for (let i = 0; i < n; i++) y[i] = s[i] + 0.5 * dt * k1[i];
  fn(y, k2); for (let i = 0; i < n; i++) y[i] = s[i] + 0.5 * dt * k2[i];
  fn(y, k3); for (let i = 0; i < n; i++) y[i] = s[i] + dt * k3[i];
  fn(y, k4); for (let i = 0; i < n; i++) s[i] += dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
const mkK = n => [0, 1, 2, 3, 4].map(() => new Float64Array(n));
const DC_CONV = {
  rev:  { name: 'Reverzační usměrňovač (2 antiparalelní můstky)', q: 'I.–IV.', uNeg: true, iNeg: true, tmu: 1.667 },
  nerev:{ name: 'Nereverzační tyristorový usměrňovač', q: 'I. a IV.', uNeg: true, iNeg: false, tmu: 1.667 },
  pm2:  { name: 'Pulzní měnič se spínači S₁ a S₂', q: 'I. a II.', uNeg: false, iNeg: true, tmu: 0.1 },
  pm1:  { name: 'Pulzní měnič jen se spínačem S₁', q: 'I.', uNeg: false, iNeg: false, tmu: 0.1 }
};

/* ---------- Cize buzený stejnosměrný motor (kap. 7) ---------- */
function dcDerived(P) {
  const Wn = toRad(P.nN), xiN = (P.UN - P.Rd * P.IN) / Wn, ifN = P.UfN / P.Rf, Ld = P.Ld / 1e3;
  return { Wn, xiN, ifN, Ld, MN: xiN * P.IN, PN: xiN * P.IN * Wn, n0: toRpm(P.UN / xiN),
    taud: Ld / P.Rd, taum: P.J * P.Rd / (xiN * xiN), tauf: P.Lf / P.Rf, TN: P.J * Wn / (xiN * P.IN),
    Izab: P.UN / P.Rd };
}
function dcTune(P) {
  const d = dcDerived(P), tmu = P.tmu / 1e3, ts = 2 * tmu + P.Tfw / 1e3;
  return { Kpi: d.Ld / (2 * tmu), Tii: d.taud * 1e3, Kpw: P.J / (2 * d.xiN * ts), Tiw: 4 * ts * 1e3, ts };
}
function simDC(P) {
  const d = dcDerived(P), casc = P.mode === 'casc';
  const dt = 2e-5, N = Math.max(1, Math.round(P.tEnd / dt)), rec = Math.max(1, Math.floor(N / 3000));
  const cv = DC_CONV[P.conv] || DC_CONV.rev;
  const tmu = Math.max(P.tmu / 1e3, 1e-5), Tfw = P.Tfw / 1e3, ts = 2 * tmu + Tfw;
  const uLo = casc && !cv.uNeg ? 0 : -P.Umax, uHi = P.Umax, iPos = casc && !cv.iNeg;
  const ci = mkPI(P.Kpi, P.Tii / 1e3), cw = mkPI(P.Kpw, P.Tiw / 1e3);
  const cf = mkPI(P.Lf / (2 * 0.01), d.tauf), UfMax = 2 * P.UfN;      /* R_If podle OM, T_Σ = 10 ms */
  const ce = mkPI(0.002, 0.04);                                        /* regulátor u_i → i_f* */
  ce.x = d.ifN;
  const s = new Float64Array([0, 0, casc ? d.ifN : P.Uf / P.Rf, 0]), K = mkK(4);
  let nr = 0, wr = 0, wf = 0, ucmd = 0, uf = casc ? P.UfN : P.Uf, ifRef = d.ifN, iref = 0, Rtot = P.Rd, M0 = 0, uiRec = 0;
  const R = { t: [], n: [], nref: [], iq: [], iref: [], M: [], Mz: [], u: [], ui: [], If: [], IfRef: [], xi: [], R: [] };
  const f = (y, o) => {
    const xi = d.xiN * y[2] / d.ifN, u = casc ? y[3] : ucmd;
    let diq = (u - Rtot * y[0] - xi * y[1]) / d.Ld;
    if (iPos && y[0] <= 0 && diq < 0) diq = 0;                          /* proud nemůže změnit smysl */
    const Mm = xi * y[0] - P.B * y[1];
    o[0] = diq; o[1] = (Mm - loadTorque(P.load, M0, y[1], d.Wn, Mm)) / P.J;
    o[2] = (uf - P.Rf * y[2]) / P.Lf; o[3] = casc ? (ucmd - y[3]) / tmu : 0;
  };
  let bad = false;
  for (let k = 0; k <= N; k++) {
    const t = k * dt;
    M0 = (t >= P.tz1 && t < P.tz2) ? P.Mz : 0;
    const xiM = d.xiN * s[2] / d.ifN;
    if (casc) {
      const tgt = t < P.t1 ? 0 : toRad(t < P.t2 ? P.n1 : P.n2);
      if (P.ramp > 0) { const r = toRad(P.ramp) * dt; nr += clamp(tgt - nr, -r, r); } else nr = tgt;
      wr = P.rf ? wr + Math.min(1, dt / (4 * ts)) * (nr - wr) : nr;
      wf = Tfw > 0 ? wf + Math.min(1, dt / Tfw) * (s[1] - wf) : s[1];
      iref = pi(cw, wr - wf, iPos ? 0 : -P.Imax, P.Imax, dt);
      ucmd = pi(ci, iref - s[0], uLo, uHi, dt, P.emf ? xiM * wf : 0);
      uiRec = s[3] - P.Rd * s[0];                                       /* rekonstrukce u_i = u_q − R_d i_q */
      ifRef = P.fw ? pi(ce, P.Uist - Math.abs(uiRec), 0.5 * d.ifN, d.ifN, dt) : d.ifN;
      uf = pi(cf, ifRef - s[2], -UfMax, UfMax, dt);
      Rtot = P.Rd;
    } else {
      const tgt = t < P.t1 ? 0 : (t < P.t2 ? P.U1 : P.U2);
      if (P.Tr > 0) { const r = P.UN / P.Tr * dt; ucmd += clamp(tgt - ucmd, -r, r); } else ucmd = tgt;
      Rtot = P.Rd + (t < P.tp ? P.Rp : 0); uf = P.Uf;
    }
    if (k % rec === 0) {
      const xi = d.xiN * s[2] / d.ifN, Mm = xi * s[0];
      R.t.push(t); R.n.push(toRpm(s[1]));
      R.nref.push(casc ? toRpm(wr) : (xi > 1e-6 ? toRpm(ucmd / xi) : 0));
      R.iq.push(s[0]); R.iref.push(casc ? iref : NaN); R.M.push(Mm);
      R.Mz.push(loadTorque(P.load, M0, s[1], d.Wn, Mm - P.B * s[1]));
      R.u.push(casc ? s[3] : ucmd); R.ui.push(xi * s[1]); R.If.push(s[2]);
      R.IfRef.push(casc ? ifRef : NaN); R.xi.push(xi); R.R.push(Rtot);
      if (!isFinite(s[0]) || Math.abs(s[0]) > 1e6) { bad = true; break; }
    }
    rk4(s, dt, f, K);
    if (iPos && s[0] < 0) s[0] = 0;
  }
  R.bad = bad; R.d = d; return R;
}

/* ---------- Asynchronní motor (kap. 9), prostorové vektory, K = 2/3 ---------- */
function imDerived(P) {
  const Lh = P.Lh / 1e3, L1s = P.L1s / 1e3, L2s = P.L2s / 1e3, L1 = Lh + L1s, L2 = Lh + L2s, D = L1 * L2 - Lh * Lh;
  const Um = P.UN * Math.SQRT2 / SQ3, wN = TAU * P.fN, Ws = wN / P.pp;
  const d = { Lh, L1s, L2s, L1, L2, D, Um, wN, Ws, nS: toRpm(Ws), sigL1: D / L2, sigma: D / (L1 * L2),
    tau2: L2 / P.R2, Rsig: P.R1 + P.R2 * (Lh / L2) ** 2, psiNat: Um / wN * Lh / L1 };
  /* ustálené hodnoty z T-schématu při U_N, f_N */
  let Mmax = 0, szv = 0;
  for (let i = 0; i <= 4000; i++) { const sl = 10 ** (-4 + 4 * i / 4000), r = imSteady(P, d, Um, P.fN, sl); if (r.M > Mmax) { Mmax = r.M; szv = sl; } }
  const z = imSteady(P, d, Um, P.fN, 1), o = imSteady(P, d, Um, P.fN, 1e-9);
  /* jmenovitý bod: skluz, při kterém M = M_N */
  let lo = 1e-6, hi = szv;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (imSteady(P, d, Um, P.fN, m).M < P.MN) lo = m; else hi = m; }
  const nb = imSteady(P, d, Um, P.fN, lo);
  Object.assign(d, { Mmax, szv, Mzab: z.M, Izab: z.I1, I0: o.I1, sN: lo, nN: d.nS * (1 - lo), IN: nb.I1,
    cosN: nb.cos, PN: P.MN * toRad(d.nS * (1 - lo)), TN: P.J * toRad(d.nS * (1 - lo)) / P.MN,
    MmaxSimple: 3 * P.pp / (2 * (L1s + L2s)) * (Um / Math.SQRT2 / wN) ** 2, szvSimple: P.R2 / (wN * (L1s + L2s)) });
  return d;
}
/* T-schéma: U_amp = amplituda fázového napětí, vrací M a efektivní I1 */
function imSteady(P, d, Uamp, f, sl) {
  const w1 = TAU * f, U = Uamp / Math.SQRT2;
  const Z1r = P.R1, Z1i = w1 * d.L1s, Zhi = w1 * d.Lh, Z2r = P.R2 / sl, Z2i = w1 * d.L2s;
  /* Zp = Zh·Z2/(Zh+Z2) */
  const nr = -Zhi * Z2i, ni = Zhi * Z2r, dr = Z2r, di = Zhi + Z2i, dd = dr * dr + di * di;
  const Zpr = (nr * dr + ni * di) / dd, Zpi = (ni * dr - nr * di) / dd;
  const Zr = Z1r + Zpr, Zi = Z1i + Zpi, Zm2 = Zr * Zr + Zi * Zi;
  const I1r = U * Zr / Zm2, I1i = -U * Zi / Zm2, I1 = Math.hypot(I1r, I1i);
  /* I2 = I1·Zh/(Zh+Z2) → |I2| = |I1|·|Zh|/|Zh+Z2| */
  const I2 = I1 * Zhi / Math.sqrt(dd);
  return { M: 3 * P.pp / w1 * I2 * I2 * P.R2 / sl, I1, cos: Zr / Math.sqrt(Zm2) };
}
/* ustálená charakteristika pro dané U, f (f může být záporná) v rozsahu otáček */
function imCurve(P, d, Uamp, f, nlo, nhi) {
  const out = [];
  if (Math.abs(f) < 0.3 || Uamp < 1) return out;
  const sg = Math.sign(f), fa = Math.abs(f), ns = 60 * fa / P.pp;
  for (let i = 0; i <= 240; i++) {
    const n = nlo + (nhi - nlo) * i / 240, sl = (ns - sg * n) / ns;
    const M = Math.abs(sl) < 1e-9 ? 0 : sg * imSteady(P, d, Uamp, fa, sl).M;   /* s < 0 → generátor, M < 0 */
    out.push([M, n]);
  }
  return out;
}
function imTune(P) {
  const d = imDerived(P), tmu = P.tmu / 1e3, ts = 2 * tmu + P.Tfw / 1e3, tau2c = d.L2 / (P.R2);
  return { Kpc: d.sigL1 / (2 * tmu), Tic: d.sigL1 / d.Rsig * 1e3, Kpf: tau2c / (2 * d.Lh * 2 * tmu),
    Tif: tau2c * 1e3, Kpw: P.J / (2 * ts), Tiw: 4 * ts * 1e3, ts };
}
function simIM(P) {
  const d = imDerived(P), mode = P.mode, inv = mode !== 'dol';
  const { Lh, L1, L2, D, Um, wN, Ws } = d, R1 = P.R1, R2 = P.R2, pp = P.pp;
  const dt = 1e-5, N = Math.max(1, Math.round(P.tEnd / dt)), rec = Math.max(1, Math.floor(N / 3000));
  const tmu = Math.max(P.tmu / 1e3, 1e-6), uMax = inv ? P.Udc / SQ3 : Infinity, Tfw = P.Tfw / 1e3, ts = 2 * tmu + Tfw;
  const s = new Float64Array(7), K = mkK(7);
  let uca = 0, ucb = 0, M0 = 0, th = 0, f1 = 0, fcmd = 0, nr = 0, wr = 0, wf = 0, kv = 1;
  let psim = 0, idRef = NaN, iqRef = NaN, Mref = NaN, psiRef = NaN;
  const cs = mkPI(P.Kps, P.Tis / 1e3), cw = mkPI(P.Kpw, P.Tiw / 1e3), cpsi = mkPI(P.Kpf, P.Tif / 1e3);
  const cd = mkPI(P.Kpc, P.Tic / 1e3), cq = mkPI(P.Kpc, P.Tic / 1e3);
  const tau2c = L2 / (P.kR2 * R2), sigL1c = d.sigL1;
  let R2v = R2;                                                           /* kroužkový motor: R_2 + R_p */
  const Uf = fa => fa === 0 ? 0 : Math.min(uMax, P.U0 + (Um - P.U0) * Math.min(fa, P.fN) / P.fN);
  const R = { t: [], n: [], nsync: [], nref: [], M: [], Mz: [], Mref: [], ia: [], imag: [], psi1: [], psi2: [],
    psiRef: [], psim: [], umag: [], f1: [], id: [], iq: [], idRef: [], iqRef: [], R2: [] };
  const fn = (y, o) => {
    const i1a = (L2 * y[0] - Lh * y[2]) / D, i1b = (L2 * y[1] - Lh * y[3]) / D;
    const i2a = (L1 * y[2] - Lh * y[0]) / D, i2b = (L1 * y[3] - Lh * y[1]) / D;
    const ua = inv ? y[5] : uca, ub = inv ? y[6] : ucb, w = pp * y[4];
    o[0] = ua - R1 * i1a; o[1] = ub - R1 * i1b;
    o[2] = -R2v * i2a - w * y[3]; o[3] = -R2v * i2b + w * y[2];
    const Mm = 1.5 * pp * (y[0] * i1b - y[1] * i1a) - P.B * y[4];
    o[4] = (Mm - loadTorque(P.load, M0, y[4], Ws, Mm)) / P.J;
    o[5] = inv ? (uca - y[5]) / tmu : 0; o[6] = inv ? (ucb - y[6]) / tmu : 0;
  };
  let bad = false;
  for (let k = 0; k <= N; k++) {
    const t = k * dt;
    M0 = (t >= P.tz1 && t < P.tz2) ? P.Mz : 0;
    const i1a = (L2 * s[0] - Lh * s[2]) / D, i1b = (L2 * s[1] - Lh * s[3]) / D, W = s[4];
    if (mode === 'dol') {
      const on = t >= P.t1; kv = (P.yd && t < P.tp) ? 1 / SQ3 : 1;
      R2v = R2 + (P.Rp2 > 0 && t < P.tR ? P.Rp2 : 0);
      th = wN * (t - P.t1); f1 = on ? P.fN : 0;
      const br = P.brk && P.brk !== 'none' && t >= P.tb;
      if (br && P.brk === 'plug') { uca = kv * Um * Math.cos(th); ucb = -kv * Um * Math.sin(th); f1 = -P.fN; }   /* přehozené dvě fáze */
      else if (br && P.brk === 'dcb') { uca = P.Udcb; ucb = 0; f1 = 0; }                                          /* stejnosměrné brzdění */
      else { uca = on ? kv * Um * Math.cos(th) : 0; ucb = on ? kv * Um * Math.sin(th) : 0; }
    } else if (mode === 'uf') {
      const tgt = t < P.t1 ? 0 : (t < P.t2 ? P.f1 : P.f2);
      if (P.rampF > 0) { const r = P.rampF * dt; fcmd += clamp(tgt - fcmd, -r, r); } else fcmd = tgt;
      f1 = fcmd; const U = Uf(Math.abs(fcmd)); th += TAU * fcmd * dt;
      uca = U * Math.cos(th); ucb = U * Math.sin(th);
    } else {
      const tgt = t < P.t1 ? 0 : toRad(t < P.t2 ? P.n1 : P.n2);
      if (P.ramp > 0) { const r = toRad(P.ramp) * dt; nr += clamp(tgt - nr, -r, r); } else nr = tgt;
      wr = nr;
      const Wm = W * (1 + (mode === 'foc' ? P.encErr / 100 : 0));       /* čidlo rychlosti */
      wf = Tfw > 0 ? wf + Math.min(1, dt / Tfw) * (Wm - wf) : Wm;
      if (mode === 'ufw') {
        if (t < P.t1) { cs.x = 0; f1 = 0; uca = ucb = 0; }
        else {
          const f2 = pi(cs, wr - wf, -P.f2max, P.f2max, dt);
          f1 = pp * wf / TAU + f2; const U = Uf(Math.max(Math.abs(f1), 1e-3)); th += TAU * f1 * dt;
          uca = U * Math.cos(th); ucb = U * Math.sin(th);
        }
      } else {                                                          /* vektorové řízení (nepřímé) */
        const c = Math.cos(th), sn = Math.sin(th);
        const id = i1a * c + i1b * sn, iq = -i1a * sn + i1b * c;
        psiRef = P.psiN * ((P.fw && Math.abs(wf) > toRad(P.nb)) ? toRad(P.nb) / Math.abs(wf) : 1);
        idRef = pi(cpsi, psiRef - psim, 0, 0.9 * P.Imax, dt);
        const iqLim = Math.sqrt(Math.max(P.Imax * P.Imax - idRef * idRef, 0));
        const kM = 1.5 * pp * Lh / L2, pm = Math.max(psim, 0.02);
        const Mlim = Math.min(P.Mlim, kM * pm * iqLim);
        Mref = pi(cw, wr - wf, -Mlim, Mlim, dt);
        iqRef = Mref / (kM * pm);
        psim += dt / tau2c * (Lh * id - psim);                          /* proudový model toku */
        const w2 = Lh * iqRef / (tau2c * pm), w1 = pp * Wm + w2;
        const udff = -w1 * sigL1c * iq, uqff = w1 * (sigL1c * id + Lh / L2 * psim);
        let ud = P.Kpc * (idRef - id) + cd.x + udff, uq = P.Kpc * (iqRef - iq) + cq.x + uqff;
        const um = Math.hypot(ud, uq), lim = um > uMax;
        if (lim) { ud *= uMax / um; uq *= uMax / um; }
        if (!lim && P.Tic > 0) { cd.x += P.Kpc / (P.Tic / 1e3) * (idRef - id) * dt; cq.x += P.Kpc / (P.Tic / 1e3) * (iqRef - iq) * dt; }
        uca = ud * c - uq * sn; ucb = ud * sn + uq * c;
        f1 = w1 / TAU; th += w1 * dt;
      }
    }
    if (k % rec === 0) {
      const p2 = Math.hypot(s[2], s[3]), ca = p2 > 1e-6 ? s[2] / p2 : 1, sa = p2 > 1e-6 ? s[3] / p2 : 0;
      const Me = 1.5 * pp * (s[0] * i1b - s[1] * i1a);
      const lineK = (mode === 'dol' && P.yd && t < P.tp) ? 1 / SQ3 : 1;   /* v hvězdě je síťový proud √3× menší než v náhradním modelu */
      R.t.push(t); R.n.push(toRpm(W)); R.nsync.push(60 * f1 / pp);
      R.nref.push(mode === 'ufw' || mode === 'foc' ? toRpm(wr) : NaN);
      R.M.push(Me); R.Mz.push(loadTorque(P.load, M0, W, Ws, Me - P.B * W)); R.Mref.push(mode === 'foc' ? Mref : NaN);
      R.ia.push(i1a * lineK); R.imag.push(Math.hypot(i1a, i1b) * lineK);
      R.psi1.push(Math.hypot(s[0], s[1])); R.psi2.push(p2);
      R.psiRef.push(mode === 'foc' ? psiRef : NaN); R.psim.push(mode === 'foc' ? psim : NaN);
      R.umag.push(inv ? Math.hypot(s[5], s[6]) : Math.hypot(uca, ucb)); R.f1.push(f1);
      R.id.push(i1a * ca + i1b * sa); R.iq.push(-i1a * sa + i1b * ca);
      R.idRef.push(mode === 'foc' ? idRef : NaN); R.iqRef.push(mode === 'foc' ? iqRef : NaN); R.R2.push(R2v);
      if (!isFinite(s[0]) || Math.abs(i1a) > 1e6) { bad = true; break; }
    }
    rk4(s, dt, fn, K);
  }
  R.bad = bad; R.d = d; R.uMax = uMax; return R;
}
/*EXPORT*/if (typeof module !== 'undefined') module.exports = { simDC, simIM, dcDerived, dcTune, imDerived, imTune, imSteady, imCurve, toRpm, toRad, DC_CONV };
