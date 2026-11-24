/* ===== Další kapitoly: mechanika, oteplení, regulace, sériový DC, synchronní, speciální ===== */

/* ---------- Kap. 2–3: mechanika, stabilita, rozběh ---------- */
function mechMotor(P, W) {
  const W0 = toRad(P.n0), Wn = toRad(P.nN), Mk = P.Mk;
  if (P.mt === 'der') return clamp(P.MN * (W0 - W) / (W0 - Wn), -Mk, Mk);
  if (P.mt === 'as') { const s = (W0 - W) / W0; return Math.abs(s) < 1e-9 ? 0 : 2 * Mk / (s / P.szv + P.szv / s); }
  /* sériová: Ω = K1/M − K2 → M = K1/(Ω + K2), K2 = 0,25 Ω_N, bodem (M_N, Ω_N) */
  const K2 = 0.25 * Wn, K1 = P.MN * (Wn + K2);
  return W <= 0 ? Mk : Math.min(Mk, K1 / (W + K2));
}
function mechLoad(P, W, Mdrive) {
  const Wn = toRad(P.nN), x = Math.abs(W) / Wn, k = +P.k;
  const g = k === 0 ? 1 : k === 1 ? x : k === 2 ? x * x : 1 / Math.max(x, 0.1);
  const b = P.MzN;
  if (Math.abs(W) < 0.05 && (k === 0 || k === -1)) {                 /* klid: tření drží */
    const fr = b * g, net = Mdrive - P.a;
    return P.a + clamp(net, -fr, fr);
  }
  return P.a + Math.sign(W) * b * g;
}
function mechEquilibria(P) {
  const W0 = toRad(P.n0), lo = -0.3 * W0, hi = 1.3 * W0, N = 1300, out = [];
  const f = W => mechMotor(P, W) - mechLoad(P, W, mechMotor(P, W));
  let pW = lo, pf = f(lo);
  for (let i = 1; i <= N; i++) {
    const W = lo + (hi - lo) * i / N, fv = f(W);
    if (Math.abs(W) > 0.06 && Math.abs(pW) > 0.06 && pf * fv < 0) {
      let a = pW, b = W;
      for (let j = 0; j < 50; j++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; }
      const Wx = (a + b) / 2, h = 1e-3 * W0, k = (mechMotor(P, Wx + h) - mechMotor(P, Wx - h)) / (2 * h), kz = (mechLoad(P, Wx + h, 0) - mechLoad(P, Wx - h, 0)) / (2 * h);
      out.push({ n: toRpm(Wx), M: mechMotor(P, Wx), k, kz, stable: k < kz });
    }
    pW = W; pf = fv;
  }
  return out;
}
function simMech(P) {
  const N = 12000, dt = P.tEnd / N, rec = 4;
  let W = toRad(P.nS);
  const R = { t: [], n: [], M: [], Mz: [], Md: [] };
  const f = Wx => { const Mm = mechMotor(P, Wx); return (Mm - mechLoad(P, Wx, Mm)) / P.J; };
  for (let k = 0; k <= N; k++) {
    if (k % rec === 0) { const Mm = mechMotor(P, W), Mz = mechLoad(P, W, Mm); R.t.push(k * dt); R.n.push(toRpm(W)); R.M.push(Mm); R.Mz.push(Mz); R.Md.push(Mm - Mz); }
    const k1 = f(W), k2 = f(W + dt / 2 * k1), k3 = f(W + dt / 2 * k2), k4 = f(W + dt * k3);
    W += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  R.eq = mechEquilibria(P); return R;
}

/* ---------- Kap. 4–5: ztráty, oteplení, druhy zatížení ---------- */
function thermLoad(P, t) {                                             /* vrací [M v p.j., běží?] */
  if (P.mode === 'S1') return [P.M1, true];
  if (P.mode === 'S2') return t < P.tz ? [P.M1, true] : [0, false];
  const Tc = P.c1 + P.c2 + P.c0, x = t % Tc;
  return x < P.c1 ? [P.M1, true] : x < P.c1 + P.c2 ? [P.M2, true] : [0, false];
}
function simTherm(P) {
  const N = 20000, dt = P.tEnd / N, rec = 5, r = P.r;
  const A = 1 / P.dTN, C = P.tau * A;                                  /* p.j.: ΔP_N = 1 → Δϑ_∞ = Δϑ_N */
  let th = P.th0;
  const R = { t: [], th: [], dP: [], M: [], dov: [] };
  for (let k = 0; k <= N; k++) {
    const t = k * dt, [M, run] = thermLoad(P, t);
    const dP = run ? (r + M * M) / (1 + r) : 0, Aa = run ? A : P.alpha * A;
    if (k % rec === 0) { R.t.push(t); R.th.push(th); R.dP.push(dP); R.M.push(run ? M : NaN); R.dov.push(P.dTN); }
    const e = Math.exp(-Aa / C * dt), inf = dP / Aa;                    /* přesné řešení na kroku */
    th = inf + (th - inf) * e;
  }
  return R;
}
function effCurve(P) {
  const pts = []; for (let i = 1; i <= 200; i++) { const p = 1.5 * i / 200; pts.push([p, 100 / (1 + P.p0 / p + P.pj * p)]); }
  const pm = Math.sqrt(P.p0 / P.pj); return { pts, pm, em: 100 / (1 + P.p0 / pm + P.pj * pm), eN: 100 / (1 + P.p0 + P.pj) };
}

/* ---------- Kap. 6: regulační obvod ---------- */
function regGs(P, w) {                                                 /* frekvenční přenos soustavy */
  const lag = T => { const d = 1 + w * w * T * T; return [1 / d, -w * T / d]; };
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  let g = [P.Ks, 0];
  if (P.pt === 'ast') { g = mul(g, [0, -1 / (w * P.T1)]); g = mul(g, lag(P.TS)); }
  else { g = mul(g, lag(P.T1)); if (P.T2 > 0) g = mul(g, lag(P.T2)); g = mul(g, lag(P.TS)); }
  return g;
}
function regGr(P, w) {
  const Kp = P.Kp, Td = P.rt === 'PID' ? P.Td : 0, Ti = P.rt === 'P' ? 0 : P.Ti, N = 10;
  let re = Kp, im = 0;
  if (Ti > 0) im += -Kp / (w * Ti);
  if (Td > 0) { const a = w * Td / N, d = 1 + a * a; re += Kp * (w * Td) * a / d; im += Kp * (w * Td) / d; }
  return [re, im];
}
function regBode(P) {
  const base = P.pt === 'ast' ? P.TS : Math.min(P.TS, P.T2 > 0 ? P.T2 : 1e9);
  const wlo = 0.01 / Math.max(P.T1, P.TS), whi = 100 / base, out = [];
  let wc = NaN, pm = NaN, prev = null;
  for (let i = 0; i <= 400; i++) {
    const w = wlo * (whi / wlo) ** (i / 400), a = regGs(P, w), b = regGr(P, w);
    const g = [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], mag = 20 * Math.log10(Math.hypot(g[0], g[1]));
    let ph = Math.atan2(g[1], g[0]) * 180 / Math.PI;
    if (prev && ph - prev.ph > 180) ph -= 360; while (prev && prev.ph - ph > 180) ph += 360;
    if (P.pt === 'ast' && i === 0 && ph > 0) ph -= 360;
    if (prev && prev.mag > 0 && mag <= 0 && isNaN(wc)) { wc = w; pm = 180 + ph; }
    out.push({ w, mag, ph }); prev = { mag, ph };
  }
  return { pts: out, wc, pm };
}
function regZN(P) {                                                    /* kritické zesílení P regulátoru */
  if (P.pt === 'ast' && true) {
    /* integrátor + 1 zpoždění: fáze nedosáhne −180° → mez stability neexistuje */
    return null;
  }
  let lo = 1e-3 / P.T1, hi = 1e4 / P.TS;
  const ph = w => { const g = regGs(P, w); let a = Math.atan2(g[1], g[0]); if (a > 0) a -= 2 * Math.PI; return a; };
  if (P.T2 <= 0) {
    /* dvě zpoždění: −180° jen asymptoticky */
    const T = [P.T1, P.TS];
    if (T.length < 3) return null;
  }
  for (let i = 0; i < 200; i++) { const m = Math.sqrt(lo * hi); if (ph(m) > -Math.PI) lo = m; else hi = m; }
  const w = Math.sqrt(lo * hi), g = regGs(P, w);
  return { Kkr: 1 / Math.hypot(g[0], g[1]), Tkr: 2 * Math.PI / w };
}
function regTune(P, kind) {
  const T1 = P.T1, T2 = P.T2 > 0 ? P.T2 : 0, TS = P.TS;
  if (kind === 'OM') {
    if (P.pt === 'ast') return null;
    if (P.rt === 'PID' && T2 > 0) return { Kp: (T1 + T2) / (2 * P.Ks * TS), Ti: T1 + T2, Td: T1 * T2 / (T1 + T2) };
    return { Kp: T1 / (2 * P.Ks * (TS + T2)), Ti: T1, Td: 0, rt: 'PI' };
  }
  if (kind === 'SO') {
    if (P.pt !== 'ast') return null;
    return { Kp: T1 / (2 * P.Ks * TS), Ti: 4 * TS, Td: 0, rt: 'PI', wf: 1 };
  }
  const z = regZN(P); if (!z) return null;
  if (kind === 'ZNPI') return { Kp: 0.45 * z.Kkr, Ti: 0.85 * z.Tkr, Td: 0, rt: 'PI' };
  if (kind === 'ZNP') return { Kp: 0.5 * z.Kkr, Ti: 0, Td: 0, rt: 'P' };
  return { Kp: 0.59 * z.Kkr, Ti: 0.5 * z.Tkr, Td: 0.12 * z.Tkr, rt: 'PID' };
}
function simReg(P) {
  const N = 20000, dt = P.tEnd / N, rec = 5, ast = P.pt === 'ast';
  const s = new Float64Array(3), K = mkK(3);
  let v = 0, xi = 0, xd = 0, wf = 0, ePrev = 0;
  const TwF = P.wf ? 4 * P.TS : 0;
  const f = (y, o) => {
    if (ast) { o[0] = P.Ks * v / P.T1; o[1] = (y[0] - y[1]) / P.TS; o[2] = 0; }
    else {
      o[0] = (P.Ks * v - y[0]) / P.T1;
      if (P.T2 > 0) o[1] = (y[0] - y[1]) / P.T2; else o[1] = 0;
      const in2 = P.T2 > 0 ? y[1] : y[0]; o[2] = (in2 - y[2]) / P.TS;
    }
  };
  const out = () => ast ? s[1] : s[2];
  const R = { t: [], y: [], w: [], u: [], e: [], z: [] };
  const Ti = P.rt === 'P' ? 0 : P.Ti, Td = P.rt === 'PID' ? P.Td : 0, Nf = 10;
  for (let k = 0; k <= N; k++) {
    const t = k * dt, w = t >= P.t1 ? P.w : 0, z = t >= P.t2 ? P.z : 0;
    wf = TwF > 0 ? wf + Math.min(1, dt / TwF) * (w - wf) : w;
    const y = out(), e = wf - y;
    /* PID: K_P(1 + 1/(sT_I) + sT_D/(1 + sT_D/N)), derivace z měřené veličiny (bez rázu od skoku) */
    let dpart = 0;
    if (Td > 0) { const a = Td / Nf; xd += dt / a * (-y - xd); dpart = P.Kp * Td * (-y - xd) / a; }
    const unsat = P.Kp * e + xi + dpart, u = clamp(unsat, -P.umax, P.umax);
    if (Ti > 0 && !((unsat > P.umax && e > 0) || (unsat < -P.umax && e < 0))) xi += P.Kp / Ti * e * dt;
    v = u + z;
    if (k % rec === 0) { R.t.push(t); R.y.push(y); R.w.push(wf); R.u.push(u); R.e.push(e); R.z.push(z); }
    rk4(s, dt, f, K); ePrev = e;
  }
  return R;
}

/* ---------- Kap. 8: sériový motor ---------- */
const serXi = (P, i) => P.Is > 0 ? P.C * P.Is * Math.tanh(i / P.Is) : P.C * i;   /* C_U·i v lineární oblasti, pak sycení */
function serTune(P) { const tmu = P.tmu / 1e3, L = P.L / 1e3; return { Kpi: r3n(L / (2 * tmu)), Tii: r3n(L / P.R * 1e3) }; }
const r3n = v => +(+v).toPrecision(3);
function simSer(P) {
  const dt = 2e-5, N = Math.round(P.tEnd / dt), rec = Math.max(1, Math.floor(N / 3000)), L = P.L / 1e3, Wb = toRad(P.nb);
  const s = new Float64Array(2), K = mkK(2);
  let u = 0, Rt = P.R, M0 = 0, brake = false, iref = NaN, wr = 0, nr = 0;
  const ci = mkPI(P.Kpi, P.Tii / 1e3), cw = mkPI(P.Kpw, P.Tiw / 1e3);
  const R = { t: [], n: [], nref: [], i: [], iref: [], M: [], Mz: [], u: [], ui: [], xi: [], R: [], br: [] };
  const fn = (y, o) => {
    const i = Math.max(y[0], 0);
    let di, M;
    if (brake) { const xb = P.C * P.Is * Math.tanh((i + P.ir) / P.Is); di = (xb * y[1] - Rt * i) / L; M = -xb * i; }
    else { const xi = serXi(P, i); di = (u - Rt * i - xi * y[1]) / L; M = xi * i; }
    if (y[0] <= 0 && di < 0) di = 0;
    o[0] = di; o[1] = (M - P.B * y[1] - loadTorque(P.load, M0, y[1], Wb, M - P.B * y[1])) / P.J;
  };
  for (let k = 0; k <= N; k++) {
    const t = k * dt; M0 = (t >= P.tz1 && t < P.tz2) ? P.Mz : 0;
    brake = P.mode === 'brake' && t >= P.tb;
    if (P.mode === 'open' || P.mode === 'brake') {
      const tgt = t < P.t1 ? 0 : (t < P.t2 ? P.U1 : P.U2);
      if (P.Tr > 0) { const r = P.U / P.Tr * dt; u += clamp(tgt - u, -r, r); } else u = tgt;
      Rt = brake ? P.R + P.Rbr : P.R + (t < P.tp ? P.Rp : 0);
    } else {
      Rt = P.R;
      if (P.mode === 'ireg') iref = t < P.t1 ? 0 : (t < P.t2 ? P.I1 : P.I2);
      else {
        const tgt = t < P.t1 ? 0 : toRad(t < P.t2 ? P.n1 : P.n2);
        if (P.ramp > 0) { const r = toRad(P.ramp) * dt; nr += clamp(tgt - nr, -r, r); } else nr = tgt;
        wr = nr; iref = pi(cw, wr - s[1], 0, P.Imax, dt);
      }
      u = pi(ci, iref - s[0], 0, P.U, dt);                               /* pulzní měnič, jen I. kvadrant */
    }
    if (k % rec === 0) {
      const i = s[0], xi = brake ? P.C * P.Is * Math.tanh((i + P.ir) / P.Is) : serXi(P, i), M = brake ? -xi * i : xi * i;
      R.t.push(t); R.n.push(toRpm(s[1])); R.nref.push(P.mode === 'wreg' ? toRpm(wr) : NaN); R.i.push(i); R.iref.push(iref);
      R.M.push(M); R.Mz.push(loadTorque(P.load, M0, s[1], Wb, M)); R.u.push(brake ? Rt * i : u); R.ui.push(xi * s[1]);
      R.xi.push(xi); R.R.push(Rt); R.br.push(brake ? 1 : 0);
    }
    rk4(s, dt, fn, K); if (s[0] < 0) s[0] = 0;
  }
  return R;
}

/* ---------- Kap. 10: synchronní motor (poměrné jednotky) ---------- */
const smTorque = (P, b, Ui) => P.U * Ui / P.Xd * Math.sin(b) + P.U * P.U / 2 * (1 / P.Xq - 1 / P.Xd) * Math.sin(2 * b);
const smDamper = (P, s) => Math.abs(s) < 1e-9 ? 0 : 2 * P.MD / (s / P.sD + P.sD / s);
function smEquil(P, Ui, Mz) {                                          /* stabilní β pro daný moment */
  let best = null, bmax = 0, mmax = -Infinity;
  for (let i = 0; i <= 1800; i++) { const b = i / 1800 * Math.PI, m = smTorque(P, b, Ui); if (m > mmax) { mmax = m; bmax = b; } }
  if (Mz > mmax) return { b: NaN, bmax, mmax };
  let a = 0, c = bmax; if (Mz < 0) { a = -bmax; c = 0; }
  for (let i = 0; i < 60; i++) { const m = (a + c) / 2; if (smTorque(P, m, Ui) < Mz) a = m; else c = m; }
  return { b: (a + c) / 2, bmax, mmax };
}
function simSM(P) {
  const w1 = TAU * P.f, dt = 5e-5, N = Math.round(P.tEnd / dt), rec = Math.max(1, Math.floor(N / 3000));
  let b, nu;
  const UiAt = t => P.mode === 'start' ? (t < P.tf ? 0 : P.Ui) : P.Ui;
  if (P.mode === 'start') { b = 0; nu = P.nu0; } else { const e = smEquil(P, P.Ui, P.Mz0); b = isFinite(e.b) ? e.b : 0; nu = 1; }
  const R = { t: [], b: [], n: [], M: [], Me: [], MD: [], Mz: [], Ui: [] };
  let t = 0;
  const f = (bb, nn, tt) => { const Ui = UiAt(tt), Mz = tt >= P.tz ? P.Mz1 : P.Mz0; const s = 1 - nn; return [w1 * s, (smTorque(P, bb, Ui) + smDamper(P, s) - Mz) / P.TN]; };
  for (let k = 0; k <= N; k++) {
    t = k * dt;
    if (k % rec === 0) { const Ui = UiAt(t), Me = smTorque(P, b, Ui), MD = smDamper(P, 1 - nu); R.t.push(t); R.b.push(b * 180 / Math.PI); R.n.push(nu); R.Me.push(Me); R.MD.push(MD); R.M.push(Me + MD); R.Mz.push(t >= P.tz ? P.Mz1 : P.Mz0); R.Ui.push(Ui); }
    const a1 = f(b, nu, t), a2 = f(b + dt / 2 * a1[0], nu + dt / 2 * a1[1], t + dt / 2), a3 = f(b + dt / 2 * a2[0], nu + dt / 2 * a2[1], t + dt / 2), a4 = f(b + dt * a3[0], nu + dt * a3[1], t + dt);
    b += dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]); nu += dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]);
  }
  return R;
}
function smVcurves(P) {                                                /* hladký rotor (X_q = X_d), R_s = 0 */
  const out = [];
  for (const Pw of [0, 0.5, 1]) {
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const Ui = 0.05 + 2.95 * i / 200, sb = Pw * P.Xd / (P.U * Ui);
      if (sb > 1) continue;
      const b = Math.asin(sb), re = P.U - Ui * Math.cos(b), im = Ui * Math.sin(b);
      pts.push([Ui, Math.hypot(re, im) / P.Xd]);
    }
    out.push({ P: Pw, pts });
  }
  return out;
}

/* ---------- Kap. 11: PMSM s vektorovým řízením ---------- */
function pmTune(P) {
  const L = P.L / 1e3, tmu = P.tmu / 1e3, ts = 2 * tmu + P.Tfw / 1e3, kM = 1.5 * P.pp * P.psim;
  return { Kpc: r3n(L / (2 * tmu)), Tic: r3n(L / P.R * 1e3), Kpw: r3n(P.J / (2 * kM * ts)), Tiw: r3n(4 * ts * 1e3) };
}
function simPM(P) {
  const L = P.L / 1e3, dt = 1e-5, N = Math.round(P.tEnd / dt), rec = Math.max(1, Math.floor(N / 3000));
  const tmu = Math.max(P.tmu / 1e3, 1e-6), Umax = P.Udc / SQ3, kM = 1.5 * P.pp * P.psim, Tfw = P.Tfw / 1e3, Wb = toRad(3000);
  const s = new Float64Array(5), K = mkK(5);                           /* i_d, i_q, Ω, u_d, u_q */
  let udc = 0, uqc = 0, M0 = 0, wf = 0, nr = 0, idr = 0, iqr = 0;
  const cd = mkPI(P.Kpc, P.Tic / 1e3), cq = mkPI(P.Kpc, P.Tic / 1e3), cw = mkPI(P.Kpw, P.Tiw / 1e3), cu = mkPI(P.Kpu, P.Tiu / 1e3);
  const fn = (y, o) => {
    const w = P.pp * y[2];
    o[0] = (y[3] - P.R * y[0] + w * L * y[1]) / L;
    o[1] = (y[4] - P.R * y[1] - w * (L * y[0] + P.psim)) / L;
    const M = kM * y[1] - P.B * y[2];
    o[2] = (M - loadTorque(P.load, M0, y[2], Wb, M)) / P.J;
    o[3] = (udc - y[3]) / tmu; o[4] = (uqc - y[4]) / tmu;
  };
  const R = { t: [], n: [], nref: [], M: [], Mz: [], id: [], iq: [], idr: [], iqr: [], u: [], umax: [] };
  for (let k = 0; k <= N; k++) {
    const t = k * dt; M0 = (t >= P.tz1 && t < P.tz2) ? P.Mz : 0;
    const tgt = t < P.t1 ? 0 : toRad(t < P.t2 ? P.n1 : P.n2);
    if (P.ramp > 0) { const r = toRad(P.ramp) * dt; nr += clamp(tgt - nr, -r, r); } else nr = tgt;
    wf = Tfw > 0 ? wf + Math.min(1, dt / Tfw) * (s[2] - wf) : s[2];
    const w = P.pp * s[2];
    /* nepřímé odbuzování: regulátor napětí dává záporné i_d* */
    idr = P.fw ? pi(cu, 0.95 * Umax - Math.hypot(udc, uqc), -0.9 * P.Imax, 0, dt) : 0;
    const iqLim = Math.sqrt(Math.max(P.Imax * P.Imax - idr * idr, 0));
    iqr = pi(cw, nr - wf, -iqLim, iqLim, dt);
    const ffd = -w * L * s[1], ffq = w * (L * s[0] + P.psim);
    let ud = P.Kpc * (idr - s[0]) + cd.x + ffd, uq = P.Kpc * (iqr - s[1]) + cq.x + ffq;
    const um = Math.hypot(ud, uq), lim = um > Umax;
    if (lim) { ud *= Umax / um; uq *= Umax / um; }
    if (!lim) { cd.x += P.Kpc / (P.Tic / 1e3) * (idr - s[0]) * dt; cq.x += P.Kpc / (P.Tic / 1e3) * (iqr - s[1]) * dt; }
    udc = ud; uqc = uq;
    if (k % rec === 0) { const M = kM * s[1]; R.t.push(t); R.n.push(toRpm(s[2])); R.nref.push(toRpm(nr)); R.M.push(M); R.Mz.push(loadTorque(P.load, M0, s[2], Wb, M)); R.id.push(s[0]); R.iq.push(s[1]); R.idr.push(idr); R.iqr.push(iqr); R.u.push(Math.hypot(s[3], s[4])); R.umax.push(Umax); }
    rk4(s, dt, fn, K);
  }
  R.Umax = Umax; return R;
}

/* ---------- Kap. 11: krokový motor (dvoufázový, aktivní rotor) ---------- */
function simStep(P) {
  const dt = 4e-6, N = Math.round(P.tEnd / dt), rec = Math.max(1, Math.floor(N / 3000)), L = P.L / 1e3, Nr = P.Nr, J = P.J * 1e-6;
  const half = P.seq === 'half', tab = half ? [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] : [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const stepAng = TAU / (Nr * (half ? 8 : 4));
  const s = new Float64Array(4), K = mkK(4);                           /* i_A, i_B, θ, ω */
  let uA = 0, uB = 0, ph = 0, cnt = 0, fs = 0;
  const fn = (y, o) => {
    const sn = Math.sin(Nr * y[2]), cs = Math.cos(Nr * y[2]);
    o[0] = (uA - P.Rw * y[0] + P.Km * y[3] * sn) / L;
    o[1] = (uB - P.Rw * y[1] - P.Km * y[3] * cs) / L;
    const M = P.Km * (-y[0] * sn + y[1] * cs) - P.Bv * 1e-6 * y[3];
    let Mz = 0;
    if (P.Mt > 0) { if (Math.abs(y[3]) > 1e-3) Mz = P.Mt * Math.sign(y[3]); else Mz = clamp(M, -P.Mt, P.Mt); }
    o[2] = y[3]; o[3] = (M - Mz) / J;
  };
  const chop = (ref, i) => ref !== 0 ? (ref - i > 0 ? P.U : -P.U) : (Math.abs(i) > 0.01 ? -Math.sign(i) * P.U : -P.Rw * i);
  const R = { t: [], cmd: [], pos: [], iA: [], iB: [], M: [], n: [], fs: [] };
  for (let k = 0; k <= N; k++) {
    const t = k * dt;
    fs = t < P.t1 ? 0 : P.f0 + (P.f1 - P.f0) * Math.min(1, (t - P.t1) / Math.max(P.tr, 1e-6));
    if (P.tstop > 0 && t >= P.tstop) fs = 0;
    ph += fs * dt; while (ph >= 1) { ph -= 1; cnt++; }
    const st = tab[cnt % tab.length], sc = half && st[0] && st[1] ? 1 : 1;
    const rA = st[0] * P.I * sc, rB = st[1] * P.I * sc;
    uA = chop(rA, s[0]); uB = chop(rB, s[1]);
    if (k % rec === 0) {
      const sn = Math.sin(Nr * s[2]), cs = Math.cos(Nr * s[2]);
      R.t.push(t); R.cmd.push(cnt * stepAng * 180 / Math.PI); R.pos.push(s[2] * 180 / Math.PI); R.iA.push(s[0]); R.iB.push(s[1]);
      R.M.push(P.Km * (-s[0] * sn + s[1] * cs)); R.n.push(toRpm(s[3])); R.fs.push(fs);
    }
    rk4(s, dt, fn, K);
  }
  R.stepDeg = stepAng * 180 / Math.PI; return R;
}

/* ---------- Kap. 11: spínaný reluktanční motor 6/4 ---------- */
function srmL(P, ang) {                                                 /* ang ve stupních, perioda 90° */
  const a = ((ang % 90) + 90) % 90, Lmin = P.Lmin / 1e3, Lmax = P.Lmax / 1e3, k = (Lmax - Lmin) / 30;
  if (a < 15) return [Lmin, 0];
  if (a < 45) return [Lmin + k * (a - 15), k * 180 / Math.PI];
  if (a < 60) return [Lmax, 0];
  return [Lmax - k * (a - 60), -k * 180 / Math.PI];
}
function simSRM(P) {
  const W = toRad(P.n), degPerS = W * 180 / Math.PI, periods = 4, Tend = periods * 90 / degPerS, dt = Math.min(2e-6, Tend / 400000), N = Math.round(Tend / dt);
  const psi = [0, 0, 0], on = [false, false, false];
  const R = { t: [], iA: [], iB: [], iC: [], MA: [], M: [], uA: [], LA: [] };
  let Wd = 0, Wv = 0, Msum = 0, Mcnt = 0, Mmax = -Infinity, Mmin = Infinity;
  const rec = Math.max(1, Math.floor(N / periods / 1200));
  for (let k = 0; k <= N; k++) {
    const t = k * dt, ang = t * degPerS;
    let Mt = 0; const row = [];
    for (let j = 0; j < 3; j++) {
      const a = ang - 30 * j, am = ((a % 90) + 90) % 90, [L, dL] = srmL(P, a), i = psi[j] / L;
      let u;
      if (P.ctl === 'volt') u = (am >= P.aon && am < P.aoff) ? P.U : (i > 1e-4 ? -P.U : 0);
      else {
        if (am >= P.aon && am < 45) { if (i < P.Iref - P.h) on[j] = true; else if (i > P.Iref + P.h) on[j] = false; u = on[j] ? P.U : 0; }
        else u = i > 1e-4 ? -P.U : 0;
      }
      psi[j] += (u - P.Rs * i) * dt; if (psi[j] < 0) psi[j] = 0;
      const M = 0.5 * dL * i * i; Mt += M;
      if (k > N * (periods - 2) / periods) { const p = u * i; if (p > 0) Wd += p * dt; else Wv -= p * dt; }
      row.push([i, M, u, L]);
    }
    if (k > N * (periods - 2) / periods) { Msum += Mt; Mcnt++; Mmax = Math.max(Mmax, Mt); Mmin = Math.min(Mmin, Mt); if (k % rec === 0) { R.t.push(ang - 180); R.iA.push(row[0][0]); R.iB.push(row[1][0]); R.iC.push(row[2][0]); R.MA.push(row[0][1]); R.M.push(Mt); R.uA.push(row[0][2]); R.LA.push(row[0][3] * 1e3); } }
  }
  R.Mavg = Msum / Mcnt; R.Mmax = Mmax; R.Mmin = Mmin; R.ER = Wd > 0 ? (Wd - Wv) / Wd : NaN; return R;
}
