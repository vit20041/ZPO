/* ===== Definice záložek (modulů) ===== */
const LOADS = [['react', 'pasivní – tření (mění smysl se směrem otáčení)'], ['pot', 'aktivní – zdvih (stálý smysl, I. a IV. kv.)'], ['fan', 'ventilátorová, M_z ~ Ω²'], ['lin', 'kalandrová, M_z ~ Ω']];
const V = (v, d, u) => `<span class="v">${fmt(v, d)}${u ? ' ' + u : ''}</span>`;
const expI = (link, txt) => `<li>${txt}<br><button type="button" class="btn" data-load="${link}">Načíst scénář</button></li>`;
const amax = a => a.reduce((m, v) => isFinite(v) ? Math.max(m, Math.abs(v)) : m, 0);
const amaxS = a => a.reduce((m, v) => isFinite(v) ? Math.max(m, v) : m, -Infinity);
const aminS = a => a.reduce((m, v) => isFinite(v) ? Math.min(m, v) : m, Infinity);
const lastOf = a => a[a.length - 1];
const pick = (st, pre) => { const o = {}; for (const k in st) if (k.startsWith(pre)) o[k.slice(pre.length)] = st[k]; return o; };
const loadCurve = (st, Mz, nl, nh, Wb) => {
  const lp = [];
  for (let i = 0; i <= 160; i++) {
    const n = nl + (nh - nl) * i / 160, W0 = toRad(n);
    if (st.load === 'react' && Math.abs(W0) < 0.05) { lp.push([NaN, NaN]); continue; }
    lp.push([st.load === 'pot' ? Mz : st.load === 'react' ? Mz * Math.sign(W0) : st.load === 'fan' ? Mz * (W0 / Wb) * Math.abs(W0 / Wb) : Mz * W0 / Wb, n]);
  }
  return lp;
};
const trajMN = R => R.t.map((_, i) => [R.M[i], R.n[i]]);
const rngOf = (arrs, pad, inc) => { let lo = Infinity, hi = -Infinity; for (const a of arrs) for (const v of a) if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } for (const v of (inc || [])) { lo = Math.min(lo, v); hi = Math.max(hi, v); } if (!isFinite(lo)) { lo = 0; hi = 1; } const p = (hi - lo) * (pad || 0.08) || 1; return [lo - p, hi + p]; };

/* hodnocení odezvy rychlosti (DC, AM, sériový, PMSM) */
function speedTiles(st, R, reg, ev) {
  const T = R.t, n = R.n, te = lastOf(T);
  const evs = [st.t2, st.tz1, st.tz2].concat(ev || []).filter(v => v != null && v > st.t1 + 1e-9 && v < te);
  const tNext = evs.length ? Math.min(...evs) : te, i1 = bis(T, st.t1), iN = Math.max(i1 + 1, bis(T, tNext) - 1);
  const target = reg ? st.n1 : n[iN];
  let t95 = NaN, over = NaN;
  if (Math.abs(target) > 1) {
    const sg = Math.sign(target);
    for (let i = i1; i <= iN; i++) if (sg * n[i] >= 0.95 * Math.abs(target)) { t95 = T[i] - st.t1; break; }
    if (reg) { let mx = -Infinity; for (let i = i1; i <= iN; i++) mx = Math.max(mx, sg * n[i]); over = Math.max(0, (mx - Math.abs(target)) / Math.abs(target) * 100); }
  }
  let dip = NaN;
  if (st.tz1 > st.t1 && st.tz1 < te && st.Mz) {
    const a = bis(T, st.tz1), later = [st.t2, st.tz2].filter(v => v > st.tz1 && v < te), b = bis(T, Math.min(st.tz1 + 0.5, later.length ? Math.min(...later) : te));
    const n0 = n[a], sg = Math.sign(n0) || 1; let mn = Infinity; for (let i = a; i <= b; i++) mn = Math.min(mn, sg * n[i]); dip = sg * n0 - mn;
  }
  const out = [[reg ? 'Doba do 95 % n*' : 'Doba rozběhu do 95 %', isFinite(t95) ? fmt(t95, 3) + ' s' : '–', reg ? 'od t₁' : 'k ustálené rychlosti před další změnou']];
  if (reg) out.push(['Překmit rychlosti', isFinite(over) ? fmt(over, 1) + ' %' : '–', 'SO teoreticky 43 %, s filtrem ≈ 8 %']);
  out.push(['Propad po zatížení', isFinite(dip) ? fmt(dip, 1) + ' ot/min' : '–', 'nejvýš 0,5 s po zapnutí M_z']);
  return out;
}

const MODS = {};

/* ======================= Úvod (kap. 1, 12, 13) ======================= */
MODS.uvod = { label: 'Úvod', chap: '1, 12, 13', ch: [1, 12, 13], tpl: 'tpl-uvod' };

/* ======================= Kap. 2–3: mechanika ======================= */
MODS.mech = {
  label: 'Mechanika a rozběh', chap: '2–3', ch: [2, 3], tpl: 'tpl-mech',
  def: { mt: 'as', n0: 1500, nN: 1440, MN: 100, Mk: 250, szv: 0.19, J: 2, nS: 0, tEnd: 8, k: '0', MzN: 60, a: 0 },
  fields: [
    { g: 'Motor (mechanická charakteristika)', rows: [{ id: 'mt', type: 'sel', opts: [['as', 'asynchronní – Klossův vztah'], ['der', 'derivační – cize buzený DC, Ω = Ω₀ − M/β'], ['ser', 'sériová – DC sériový, Ω = K₁/M − K₂']] },
      { id: 'n0', l: 'Otáčky naprázdno / synchronní n_0', u: 'ot/min', w: 'mt:as der' }, { id: 'nN', l: 'Jmenovité otáčky n_N', u: 'ot/min' }, { id: 'MN', l: 'Jmenovitý moment M_N', u: 'N·m', w: 'mt:der ser' },
      { id: 'Mk', l: 'Moment zvratu / největší moment M_max', u: 'N·m' }, { id: 'szv', l: 'Skluz zvratu s_zv', u: '–', w: 'mt:as' }] },
    { g: 'Zátěž: M_z = a + sgn(Ω)·b·(Ω/Ω_N)^k', rows: [{ id: 'k', type: 'sel', opts: [['0', 'hoblovková, k = 0 (konstantní)'], ['1', 'kalandrová, k = 1'], ['2', 'ventilátorová, k = 2'], ['-1', 'navíječková, k = −1']] },
      { id: 'MzN', l: 'Pasivní složka b (při n_N)', u: 'N·m' }, { id: 'a', l: 'Aktivní složka a (zdvih)', u: 'N·m', h: 'nemění smysl se směrem otáčení' }] },
    { g: 'Rozběh', rows: [{ id: 'J', l: 'Moment setrvačnosti J_c', u: 'kg·m²' }, { id: 'nS', l: 'Počáteční otáčky', u: 'ot/min' }, { id: 'tEnd', l: 'Doba simulace', u: 's', h: 'nejvýš 60 s' }] }
  ],
  presets: [
    { id: 'base', n: 'Rozběh AM, konstantní zátěž', s: {} },
    { id: 'nostart', n: 'Velká konstantní zátěž: nerozběhne se', s: { MzN: 100, tEnd: 3 } },
    { id: 'fan', n: 'Ventilátor: jeden stabilní bod', s: { k: '2', MzN: 100, tEnd: 4 } },
    { id: 'deep', n: 'Bod na rozběhové větvi', s: { k: '2', MzN: 900, tEnd: 5 } },
    { id: 'der', n: 'Derivační motor: exponenciála s τ_m', s: { mt: 'der', MzN: 50, Mk: 2000, tEnd: 1.5 } },
    { id: 'ser', n: 'Sériový motor s ventilátorem', s: { mt: 'ser', k: '2', MzN: 100, tEnd: 8 } },
    { id: 'lift', n: 'Zdvih: aktivní zátěž', s: { a: 50, MzN: 20 } }
  ],
  valid: st => ['J', 'tEnd', 'Mk', 'nN'].filter(k => !(st[k] > 0)).length ? 'J, t, M_max a n_N musí být kladné.' : st.tEnd > 60 ? 'Doba simulace nejvýš 60 s.' : '',
  sim: st => simMech(st),
  plots: () => [
    { id: 'n', t: 'Rychlost', u: 'ot/min', d: 0, s: [{ k: 'n', l: 'n', c: 'k' }] },
    { id: 'M', t: 'Momenty', u: 'N·m', d: 1, s: [{ k: 'M', l: 'M motoru', c: 'k' }, { k: 'Mz', l: 'M_z', c: 'b' }, { k: 'Md', l: 'M_d = M − M_z', c: 'r', dash: 1 }] }
  ],
  xyTitle: 'Rovina Ω–M: pracovní body', xyNote: 'Plný kroužek = stabilní pracovní bod, prázdný = labilní. Moment vodorovně, rychlost svisle.',
  xy(st, R, idx) {
    const n0 = st.mt === 'ser' ? st.nN * 1.8 : st.n0, nl = Math.min(-0.1 * n0, aminS(R.n) - 50), nh = Math.max(1.12 * n0, amaxS(R.n) + 50);
    const mc = [], lc = [];
    for (let i = 0; i <= 300; i++) { const n = nl + (nh - nl) * i / 300, W = toRad(n); mc.push([mechMotor(st, W), n]); const z = Math.abs(W) < 0.06 ? NaN : mechLoad(st, W, 0); lc.push([z, n]); }
    return { xl: 'M [N·m]', yl: 'n [ot/min]', yr: [nl, nh], xr: rngOf([mc.filter(p => p[1] > nl && p[1] < nh).map(p => p[0]), lc.map(p => p[0])], 0.06, [0]), quad: 1,
      series: [{ pts: lc, c: 'b', dash: 1, w: 2 }, { pts: mc, c: 'r', w: 2 }, { pts: trajMN(R), c: 'k', w: 1.2 }],
      dots: R.eq.map(e => ({ x: e.M, y: e.n, c: 'k', hollow: !e.stable, r: 6 })).concat([{ x: R.M[idx], y: R.n[idx], c: 'r', r: 6 }]),
      leg: [['k', 'trajektorie'], ['r', 'charakteristika motoru'], ['b', 'zátěž M_z(n)', 1]] };
  },
  tiles(st, R) {
    const T = R.t, n = R.n, ne = lastOf(n), Wn = toRad(st.nN), Mn = st.mt === 'as' ? mechMotor(st, Wn) : st.MN;
    let t95 = NaN; const tgt = ne; if (Math.abs(tgt - n[0]) > 1) for (let i = 0; i < T.length; i++) if ((n[i] - n[0]) >= 0.95 * (tgt - n[0])) { t95 = T[i]; break; }
    const TN = st.J * Wn / Mn, eq = R.eq.map(e => fmt(e.n, 0) + (e.stable ? ' (stab.)' : ' (lab.)')).join(', ') || 'žádný';
    const out = [['Pracovní body', R.eq.length + '', eq + ' ot/min'], ['Otáčky na konci', fmt(ne, 0) + ' ot/min', Math.abs(lastOf(R.Md)) < 0.5 ? 'ustáleno' : 'ještě se mění'],
      ['Doba rozběhu do 95 %', isFinite(t95) ? fmt(t95, 3) + ' s' : '–', 'změny rychlosti'], ['Normální doba rozběhu T_N', fmt(TN, 2) + ' s', 'J_c Ω_N/M_N, M_N = ' + fmt(Mn, 0) + ' N·m']];
    if (st.mt === 'der' && +st.k === 0 && st.a === 0) { const kc = st.MN / (toRad(st.n0) - Wn), tm = st.J / kc; out.push(['Analyticky τ_m = J/k_c', fmt(tm, 3) + ' s', '95 % za 3τ_m = ' + fmt(3 * tm, 3) + ' s']); }
    return out;
  },
  theory(st) {
    const Wn = toRad(st.nN), Mn = st.mt === 'as' ? mechMotor(st, Wn) : st.MN;
    return `<h2>Co simulace počítá</h2><div class="cols"><div><p>Jediná rovnice:  J<sub>c</sub>dΩ/dt = M(Ω) − M<sub>z</sub>(Ω). Motor je zadán statickou mechanickou charakteristikou (elektromagnetické děje jsou mnohem rychlejší, kap. 3), zátěž obecným tvarem M<sub>z</sub> = a + sgn(Ω)·b·(Ω/Ω<sub>N</sub>)<sup>k</sup>. Integruje se Runge–Kuttou; pracovní body se hledají jako průsečíky obou charakteristik a jejich stabilita podle znaménka ∂M/∂Ω − ∂M<sub>z</sub>/∂Ω.</p>
<p>Pro zadaný motor je moment při n<sub>N</sub> ${V(Mn, 1, 'N·m')} a T<sub>N</sub> = J<sub>c</sub>Ω<sub>N</sub>/M<sub>N</sub> = ${V(st.J * Wn / Mn, 2, 's')}.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">${expI('mech:nostart', 'Konstantní zátěž větší než záběrný moment: pod momentem zvratu vznikne labilní bod a motor se z klidu nerozběhne. Zkuste počáteční otáčky 300 ot/min.')}
${expI('mech:fan', 'Ventilátorová zátěž má jediný průsečík a ten je stabilní: motor se rozběhne vždy.')}
${expI('mech:deep', 'Průsečík na rozběhové větvi: stabilní (zátěž roste rychleji než moment), ale motor tam bere několikanásobek jmenovitého proudu.')}</ol></div>
<div><ol class="exp" start="4">${expI('mech:der', 'Derivační motor a konstantní zátěž: obě charakteristiky jsou přímky, rozběh je exponenciála. Porovnejte dobu do 95 % s 3τ<sub>m</sub> v dlaždici.')}
${expI('mech:ser', 'Sériový motor: obrovský záběrný moment a rychlost klesá se zatížením. Zkuste ventilátor nahradit hoblovkovou zátěží 20 N·m.')}
${expI('mech:lift', 'Aktivní zátěž: když motor nestačí, břemeno ho roztočí opačně (záporné otáčky). Zvyšte a na 95 N·m.')}</ol></div></div>`;
  }
};

/* ======================= Kap. 4–5: ztráty a oteplení ======================= */
MODS.tep = {
  label: 'Ztráty a oteplení', chap: '4–5', ch: [4, 5], tpl: 'tpl-tep', xu: 'min',
  def: { mode: 'S2', tau: 30, dTN: 80, r: 0, alpha: 0.5, th0: 0, M1: 1.88, tz: 10, M2: 0.8, c1: 2, c2: 6, c0: 2, tEnd: 90, p0: 0.03, pj: 0.07 },
  fields: [
    { g: 'Druh zatížení', rows: [{ id: 'mode', type: 'sel', opts: [['S1', 'S1 – trvalé zatížení'], ['S2', 'S2 – krátkodobý chod a klid'], ['cyc', 'Přerušovaný cyklus – ekvivalentní moment']] }] },
    { g: 'Zatížení (v poměru k M_N, M ~ I)', rows: [{ id: 'M1', l: 'Moment M_1', u: 'p.j.' }, { id: 'tz', l: 'Doba chodu t_z', u: 'min', m: 'S2' },
      { id: 'c1', l: 'Doba t_1 s momentem M_1', u: 'min', m: 'cyc' }, { id: 'M2', l: 'Moment M_2', u: 'p.j.', m: 'cyc' }, { id: 'c2', l: 'Doba t_2', u: 'min', m: 'cyc' }, { id: 'c0', l: 'Klid t_0', u: 'min', m: 'cyc' },
      { id: 'tEnd', l: 'Doba simulace', u: 'min' }] },
    { g: 'Tepelný model stroje', rows: [{ id: 'tau', l: 'Tepelná časová konstanta τ_ϑ', u: 'min' }, { id: 'dTN', l: 'Dovolené oteplení Δϑ_N', u: 'K', h: 'oteplení při jmenovitých ztrátách' },
      { id: 'r', l: 'Poměr ztrát ΔP_0/ΔP_jN', u: '–', h: '0 = ztráty naprázdno zanedbány (jako ve skriptech)' }, { id: 'alpha', l: 'Chlazení v klidu α', u: '–', h: 'samochlazený stroj v klidu chladne hůř' }, { id: 'th0', l: 'Počáteční oteplení', u: 'K' }] },
    { g: 'Účinnost (kap. 4)', rows: [{ id: 'p0', l: 'Ztráty naprázdno ΔP_0/P_N', u: '–' }, { id: 'pj', l: 'Ztráty ve vinutí ΔP_jN/P_N', u: '–' }] }
  ],
  presets: [
    { id: 'S2', n: 'S2: příklad ze skript', s: {} },
    { id: 'S2r', n: 'S2 se ztrátami naprázdno', s: { r: 0.5 } },
    { id: 'S1', n: 'S1: jmenovitý moment', s: { mode: 'S1', M1: 1, tEnd: 180 } },
    { id: 'S1o', n: 'S1: přetížení 1,2 M_N', s: { mode: 'S1', M1: 1.2, tEnd: 180 } },
    { id: 'cyc', n: 'Cyklus z příkladu M_ekv', s: { mode: 'cyc', M1: 1.6, M2: 0.8, tEnd: 240 } }
  ],
  valid: st => ['tau', 'dTN', 'tEnd', 'alpha', 'p0', 'pj'].filter(k => !(st[k] > 0)).length ? 'τ, Δϑ, doba, α a ztráty musí být kladné.' : st.tEnd > 2000 ? 'Doba simulace nejvýš 2000 min.' : '',
  sim: st => simTherm(st),
  plots: () => [
    { id: 'th', t: 'Oteplení', u: 'K', d: 1, s: [{ k: 'th', l: 'Δϑ', c: 'k' }, { k: 'dov', l: 'Δϑ_dov', c: 'r', dash: 1 }] },
    { id: 'dP', t: 'Ztráty', u: 'p.j. ΔP_N', d: 2, s: [{ k: 'dP', l: 'ΔP/ΔP_N', c: 'k' }] },
    { id: 'M', t: 'Zatížení', u: 'p.j. M_N', d: 2, s: [{ k: 'M', l: 'M/M_N', c: 'b' }] }
  ],
  xyTitle: 'Účinnost η(P)', xyNote: 'η = 1/(1 + ΔP₀/P + ΔP_jN·P/P_N²); maximum tam, kde se ztráty naprázdno rovnají ztrátám ve vinutí.',
  xy(st) {
    const e = effCurve(st);
    return { xl: 'P/P_N', yl: 'η [%]', xr: [0, 1.5], yr: [Math.max(0, aminS(e.pts.map(p => p[1])) - 2), 100], series: [{ pts: e.pts, c: 'k', w: 2 }, { pts: [[e.pm, 0], [e.pm, e.em]], c: 'r', dash: 1, w: 1 }, { pts: [[1, 0], [1, e.eN]], c: 'b', dash: 1, w: 1 }],
      dots: [{ x: e.pm, y: e.em, c: 'r', r: 5 }, { x: 1, y: e.eN, c: 'b', r: 5 }], leg: [['k', 'η(P)'], ['r', 'maximum'], ['b', 'jmenovitý bod']] };
  },
  tiles(st, R) {
    const e = effCurve(st), out = [['Největší oteplení', fmt(amaxS(R.th), 1) + ' K', amaxS(R.th) <= st.dTN + 0.5 ? 'nepřekračuje Δϑ_dov' : 'PŘEKRAČUJE Δϑ_dov = ' + fmt(st.dTN, 0) + ' K']];
    if (st.mode === 'S1') out.push(['Ustálené oteplení', fmt(st.dTN * (st.r + st.M1 ** 2) / (1 + st.r), 1) + ' K', 'Δϑ_∞ = Δϑ_N (r + M²)/(1 + r)'], ['Za 3τ_ϑ', fmt(95, 0) + ' %', 'ustálení ' + fmt(3 * st.tau, 0) + ' min']);
    if (st.mode === 'S2') { const pt = 1 / (1 - Math.exp(-st.tz / st.tau)), Md = Math.sqrt(pt * (1 + st.r) - st.r); out.push(['Tepelná přetížitelnost p_ϑ', fmt(pt, 2), '1/(1 − e^(−t_z/τ_ϑ))'], ['Proudová p_I = √p_ϑ', fmt(Math.sqrt(pt), 2), 'při ΔP₀ = 0'], ['Dovolený moment s ΔP₀', fmt(Md, 2) + ' M_N', '√(p_ϑ(1 + r) − r)']); }
    if (st.mode === 'cyc') { const Tc = st.c1 + st.c2 + st.c0, Me = Math.sqrt((st.M1 ** 2 * st.c1 + st.M2 ** 2 * st.c2) / (st.c1 + st.c2 + st.alpha * st.c0)), dPa = ((st.r + st.M1 ** 2) * st.c1 + (st.r + st.M2 ** 2) * st.c2) / (1 + st.r) / Tc;
      out.push(['Ekvivalentní moment', fmt(Me, 3) + ' M_N', Me <= 1.001 ? 'vyhovuje (≤ M_N)' : 'nevyhovuje (> M_N)'], ['Střední ztráty', fmt(dPa, 3) + ' ΔP_N', 'ΣΔP_i t_i/T_c'], ['Přetížitelnost', fmt(Math.max(st.M1, st.M2), 2), 'kontrola M_max/M_N zvlášť']); }
    out.push(['Maximum účinnosti', fmt(e.em, 1) + ' %', 'při P = ' + fmt(e.pm, 2) + ' P_N']);
    return out;
  },
  theory(st) {
    return `<h2>Co simulace počítá</h2><div class="cols"><div><p>Stroj je homogenní těleso: C dΔϑ/dt = ΔP − AΔϑ. Ztráty jsou ΔP = ΔP<sub>0</sub> + ΔP<sub>jN</sub>(M/M<sub>N</sub>)² (předpoklad M ~ I), v klidu nulové a s horším chlazením αA. Vše v poměrných jednotkách: ΔP<sub>N</sub> = 1 dává ustálené oteplení Δϑ<sub>N</sub>. Rovnice se řeší přesně exponenciálou na každém kroku.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">${expI('tep:S2', 'Příklad ze skript: τ<sub>ϑ</sub> = 30 min, t<sub>z</sub> = 10 min → p<sub>ϑ</sub> = 3,53, p<sub>I</sub> = 1,88. S momentem 1,88 M<sub>N</sub> dosáhne oteplení přesně 80 K.')}
${expI('tep:S2r', 'Totéž se ztrátami naprázdno (r = 0,5): dovolený moment vychází jinak, dlaždice ukazuje přesný vzorec.')}</ol></div>
<div><ol class="exp" start="3">${expI('tep:S1o', 'Trvalé přetížení 1,2 M<sub>N</sub>: ustálené oteplení 1,44 × Δϑ<sub>N</sub>, dosažené zhruba za 3τ<sub>ϑ</sub>.')}
${expI('tep:cyc', 'Cyklus z příkladu ve skriptech (200/100 N·m při M<sub>N</sub> = 125 N·m): M<sub>ekv</sub> ≈ M<sub>N</sub>, oteplení kmitá kolem dovolené hodnoty.')}</ol></div></div>`;
  }
};

/* ======================= Kap. 6: regulace ======================= */
MODS.reg = {
  label: 'Regulace', chap: '6', ch: [6], tpl: 'tpl-reg',
  def: { pt: 'stat', Ks: 2, T1: 0.1, T2: 0.02, TS: 0.005, rt: 'PI', Kp: 1, Ti: 0.1, Td: 0, umax: 100, wf: 0, w: 1, t1: 0.01, z: 0.5, t2: 0.3, tEnd: 0.6 },
  fields: [
    { g: 'Soustava', rows: [{ id: 'pt', type: 'sel', opts: [['stat', 'statická: K_S/((1+sT_1)(1+sT_2)(1+sT_Σ))'], ['ast', 'astatická: K_S/(sT_1(1+sT_Σ))']] },
      { id: 'Ks', l: 'Zesílení K_S', u: '–' }, { id: 'T1', l: 'Velká časová konstanta T_1', u: 's', h: 'u astatické soustavy integrační konstanta' }, { id: 'T2', l: 'Druhá konstanta T_2', u: 's', w: 'pt:stat', h: '0 = bez ní' }, { id: 'TS', l: 'Součet malých konstant T_Σ', u: 's' }] },
    { g: 'Regulátor K_P(1 + 1/(sT_I) + sT_D)', tunes: [['OM', 'OM'], ['SO', 'SO'], ['ZNPI', 'Z–N PI'], ['ZNPID', 'Z–N PID']], rows: [{ id: 'rt', type: 'sel', opts: [['P', 'P'], ['PI', 'PI'], ['PID', 'PID (D z měřené veličiny, filtr T_D/10)']] },
      { id: 'Kp', l: 'Zesílení K_P', u: '–' }, { id: 'Ti', l: 'Integrační konstanta T_I', u: 's', w: 'rt:PI PID' }, { id: 'Td', l: 'Derivační konstanta T_D', u: 's', w: 'rt:PID' },
      { id: 'umax', l: 'Omezení akční veličiny |u|', u: '–' }, { id: 'wf', type: 'chk', l: 'Filtr žádané hodnoty 1/(1 + 4T_Σ s)' }] },
    { g: 'Scénář', rows: [{ id: 'w', l: 'Skok žádané hodnoty w', u: '–' }, { id: 't1', l: 'v čase', u: 's' }, { id: 'z', l: 'Skok poruchy z na vstupu soustavy', u: '–' }, { id: 't2', l: 'v čase', u: 's' }, { id: 'tEnd', l: 'Doba simulace', u: 's' }] }
  ],
  presets: [
    { id: 'om', n: 'OM: PI kompenzuje T_1', s: {}, tune: 'OM' },
    { id: 'p', n: 'P regulátor: trvalá odchylka', s: { rt: 'P', Kp: 2 } },
    { id: 'pid', n: 'OM: PID kompenzuje T_1 i T_2', s: { rt: 'PID' }, tune: 'OM' },
    { id: 'so', n: 'SO: astatická soustava', s: { pt: 'ast', T1: 0.2, z: 0.2 }, tune: 'SO' },
    { id: 'sof', n: 'SO s filtrem žádané', s: { pt: 'ast', T1: 0.2, z: 0.2 }, tune: 'SO', after: { wf: 1 } },
    { id: 'zn', n: 'Ziegler–Nichols PI', s: {}, tune: 'ZNPI' },
    { id: 'kr', n: 'Na mezi stability (K_kr)', s: { rt: 'P', tEnd: 1, z: 0 }, tune: 'KKR' }
  ],
  tune(kind, st) {
    if (kind === 'KKR') { const z = regZN(st); if (z) { st.Kp = r3(z.Kkr); st.rt = 'P'; } return z ? '' : 'Tato soustava nemá mez stability.'; }
    const t = regTune(st, kind);
    if (!t) return kind === 'SO' ? 'Symetrické optimum je pro astatickou soustavu (s integrátorem).' : kind === 'OM' ? 'OM s PI je pro statickou soustavu; pro astatickou použijte SO.' : 'Z–N potřebuje soustavu, která s P regulátorem dosáhne meze stability (aspoň 3 zpoždění).';
    st.Kp = r3(t.Kp); st.Ti = r3(t.Ti); st.Td = r3(t.Td || 0); if (t.rt) st.rt = t.rt; if (t.wf != null) st.wf = 0;
    return '';
  },
  valid: st => ['Ks', 'T1', 'TS', 'tEnd', 'umax'].filter(k => !(st[k] > 0)).length ? 'K_S, T_1, T_Σ, doba a omezení musí být kladné.' : st.tEnd > 100 ? 'Doba simulace nejvýš 100 s.' : '',
  sim: st => simReg(st),
  plots: () => [
    { id: 'y', t: 'Regulovaná veličina', u: '–', d: 3, s: [{ k: 'y', l: 'y', c: 'k' }, { k: 'w', l: 'w', c: 'r', dash: 1 }] },
    { id: 'u', t: 'Akční veličina', u: '–', d: 3, s: [{ k: 'u', l: 'u', c: 'k' }, { k: 'z', l: 'porucha z', c: 'b', dash: 1 }] },
    { id: 'e', t: 'Regulační odchylka', u: '–', d: 3, s: [{ k: 'e', l: 'e = w − y', c: 'k' }] }
  ],
  xyTitle: 'Bodeův diagram otevřené smyčky', xyNote: 'Modul |G_o| v dB (černě, levá osa) a fáze (červeně, pravá osa). Svislice = průchod nulou ω_c.',
  xy(st) {
    const b = regBode(st), m = b.pts.map(p => [p.w, p.mag]), ph = b.pts.map(p => [p.w, p.ph]);
    const ser = [{ pts: m, c: 'k', w: 2 }, { pts: [[b.pts[0].w, 0], [lastOf(b.pts).w, 0]], c: 'k', w: 0.8, op: 0.5 }];
    if (isFinite(b.wc)) ser.push({ pts: [[b.wc, -400], [b.wc, 400]], c: 'r', dash: 1, w: 1 });
    return { logx: 1, xl: 'ω [rad/s]', yl: '|G_o| [dB]', yr: [Math.max(-80, aminS(m.map(p => p[1]))), Math.min(80, amaxS(m.map(p => p[1])))], series: ser,
      y2: { l: 'φ [°]', r: [Math.max(-300, aminS(ph.map(p => p[1])) - 10), Math.min(30, amaxS(ph.map(p => p[1])) + 10)], series: [{ pts: ph, c: 'r', w: 1.6 }, { pts: [[b.pts[0].w, -180], [lastOf(b.pts).w, -180]], c: 'r', w: 0.8, dash: 1, op: 0.6 }] },
      leg: [['k', 'modul [dB]'], ['r', 'fáze [°], čárkovaně −180°']] };
  },
  tiles(st, R) {
    const T = R.t, y = R.y, w = st.w, i1 = bis(T, st.t1), i2 = st.t2 < lastOf(T) ? bis(T, st.t2) - 1 : T.length - 1;
    const seg = y.slice(i1, i2 + 1), yinf = y[i2], mx = amaxS(seg), over = Math.abs(yinf) > 1e-9 ? (mx - yinf) / yinf * 100 : NaN;
    let T1 = NaN; for (let i = i1; i <= i2; i++) if (y[i] >= yinf) { T1 = T[i] - st.t1; break; }
    let Treg = 0; for (let i = i1; i <= i2; i++) if (Math.abs(y[i] - yinf) > 0.02 * Math.abs(yinf)) Treg = T[i] - st.t1;
    const b = regBode(st), z = regZN(st);
    const out = [['Přeregulování σ', isFinite(over) ? fmt(Math.max(0, over), 1) + ' %' : '–', 'OM 4,3 %, SO 43 %'], ['Rychlost regulace T₁', isFinite(T1) ? fmt(T1 * 1e3, 1) + ' ms' : '–', 'první dosažení h_∞'],
      ['Doba regulace (2 %)', fmt(Treg * 1e3, 1) + ' ms', 'OM 10τ_σ, SO 18τ_σ'], ['Trvalá odchylka', fmt(w - yinf, 4), st.rt === 'P' && st.pt === 'stat' ? 'P: 1/(1 + K_o) = ' + fmt(w / (1 + st.Kp * st.Ks), 4) : 'před skokem poruchy'],
      ['Fázová bezpečnost', isFinite(b.pm) ? fmt(b.pm, 1) + '°' : '–', isFinite(b.wc) ? 'ω_c = ' + fmt(b.wc, 1) + ' rad/s' : '']];
    if (z) out.push(['Mez stability (Z–N)', 'K_kr = ' + fmt(z.Kkr, 2), 'T_kr = ' + fmt(z.Tkr * 1e3, 1) + ' ms']);
    return out;
  },
  theory(st) {
    const ts = st.TS;
    return `<h2>Co simulace počítá</h2><div class="cols"><div><p>Soustava je řetězec zpožďujících členů (nebo integrátor a zpoždění), regulátor PID ve tvaru K<sub>P</sub>(1 + 1/(sT<sub>I</sub>) + sT<sub>D</sub>) s omezením výstupu a podmíněnou integrací. Porucha z se přičítá k akční veličině na vstupu soustavy. Bodeův diagram se počítá z přenosů dosazením s = jω.</p>
<p>Pro τ<sub>σ</sub> = T<sub>Σ</sub> = ${V(ts * 1e3, 2, 'ms')}: OM dává první dosažení za 4,7τ<sub>σ</sub> = ${V(4.7 * ts * 1e3, 1, 'ms')}, SO za 3,1τ<sub>σ</sub> = ${V(3.1 * ts * 1e3, 1, 'ms')}.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">${expI('reg:p', 'P regulátor: trvalá odchylka 1/(1 + K<sub>P</sub>K<sub>S</sub>). Zvyšte K<sub>P</sub> – odchylka klesá, ale roste kmitavost.')}
${expI('reg:om', 'OM: překmit 4,3 % a fázová bezpečnost asi 63°. Porucha se vyreguluje bez trvalé odchylky díky I složce.')}
${expI('reg:pid', 'PID kompenzuje obě konstanty: odezva je rychlejší, ale akční veličina má velké špičky.')}</ol></div>
<div><ol class="exp" start="4">${expI('reg:so', 'SO u astatické soustavy: překmit 43 %, fázová bezpečnost 36,9°. Nastavte K<sub>P</sub> podle OM ručně a porovnejte reakci na poruchu.')}
${expI('reg:sof', 'Filtr žádané hodnoty vykrátí nulu (1 + 4τ<sub>σ</sub>s): překmit klesne asi na 8 %, odezva na poruchu se nezmění.')}
${expI('reg:kr', 'Na mezi stability: P regulátor s K<sub>kr</sub> dává netlumené kmity s periodou T<sub>kr</sub>. Pak stiskněte „Z–N PI“: tabulka dává rychlé, ale málo tlumené nastavení (tady fázová bezpečnost jen pár stupňů). Porovnejte s OM.')}</ol></div></div>`;
  }
};

/* ======================= Kap. 7: cize buzený DC ======================= */
MODS.dc = {
  label: 'Cize buzený DC', chap: '7', ch: [7], tpl: 'tpl-dc',
  def: { mode: 'casc', conv: 'rev', UN: 440, IN: 100, nN: 1500, Rd: 0.2, Ld: 4, J: 1, UfN: 220, Rf: 110, Lf: 110, B: 0,
    tEnd: 1, t1: 0.02, t2: 99, n1: 1500, n2: 1500, U1: 440, U2: 440, Tr: 0, ramp: 0, tz1: 0.6, tz2: 99, Mz: 267, load: 'react',
    Rp: 0, tp: 99, Uf: 220, Umax: 500, tmu: 1.667, Imax: 200, fw: 0, Uist: 420, emf: 0, rf: 0, Tfw: 5 },
  autotune: st => { const t = dcTune(st); return { Kpi: r3(t.Kpi), Tii: r3(t.Tii), Kpw: r3(t.Kpw), Tiw: r3(t.Tiw) }; },
  fields: [
    { g: 'Způsob řízení', rows: [{ id: 'mode', type: 'sel', opts: [['open', 'Ovládání napětím kotvy (bez zpětné vazby)'], ['casc', 'Kaskádní regulace proudu a rychlosti']] }] },
    { g: 'Scénář', rows: [
      { id: 'tEnd', l: 'Doba simulace', u: 's', h: 'nejvýš 5 s' }, { id: 't1', l: 'Čas t_1 – první povel', u: 's' },
      { id: 'U1', l: 'Napětí kotvy od t_1', u: 'V', m: 'open' }, { id: 'n1', l: 'Žádaná rychlost od t_1', u: 'ot/min', m: 'casc' },
      { id: 't2', l: 'Čas t_2 – druhý povel', u: 's', h: 'čas za koncem simulace = nenastane' },
      { id: 'U2', l: 'Napětí kotvy od t_2', u: 'V', m: 'open' }, { id: 'n2', l: 'Žádaná rychlost od t_2', u: 'ot/min', m: 'casc' },
      { id: 'Tr', l: 'Rampa napětí: doba 0 → U_N', u: 's', m: 'open', h: '0 = skok' }, { id: 'ramp', l: 'Rampa žádané rychlosti', u: 'ot/min/s', m: 'casc', h: '0 = skok' },
      { id: 'tz1', l: 'Zátěž zapnout v čase', u: 's' }, { id: 'tz2', l: 'Zátěž vypnout v čase', u: 's' }] },
    { g: 'Zátěž', rows: [{ id: 'load', type: 'sel', opts: LOADS }, { id: 'Mz', l: 'Zátěžný moment M_z', u: 'N·m', h: 'u ventilátorové a kalandrové hodnota při n_N' }, { id: 'B', l: 'Viskózní tření B', u: 'N·m·s/rad' }] },
    { g: 'Spouštění a buzení', m: 'open', rows: [{ id: 'Rp', l: 'Předřadný odpor R_p', u: 'Ω' }, { id: 'tp', l: 'Vyřazení R_p v čase', u: 's' }, { id: 'Uf', l: 'Budicí napětí U_f', u: 'V', h: 'U_fN = jmenovité buzení; menší U_f = odbuzení' }] },
    { g: 'Měnič', m: 'casc', rows: [{ id: 'conv', type: 'sel', opts: Object.entries(DC_CONV).map(([k, v]) => [k, v.name + ' (' + v.q + ' kv.)']) },
      { id: 'Umax', l: 'Největší napětí měniče', u: 'V' }, { id: 'tmu', l: 'Náhradní zpoždění τ_U', u: 'ms', h: 'usměrňovač 6 pulzů: T/(2q) = 1,667 ms; pulzní měnič 1/(2f_sp)' },
      { id: 'Imax', l: 'Omezení proudu I_max', u: 'A' }, { id: 'rf', type: 'chk', l: 'Filtr žádané rychlosti 1/(1 + 4τ_σs)' },
      { id: 'emf', type: 'chk', l: 'Dopředná kompenzace u_i v regulátoru proudu' },
      { id: 'fw', type: 'chk', l: 'Odbuzování přes rekonstrukci u_i' }, { id: 'Uist', l: 'Žádané u_i* (začátek odbuzování)', u: 'V' }] },
    { g: 'Regulátor proudu R_iq', m: 'casc', tunes: [['OM', 'Nastavit podle OM']], rows: [{ id: 'Kpi', l: 'Zesílení K_P', u: 'V/A' }, { id: 'Tii', l: 'Integrační konstanta T_I', u: 'ms', h: '0 = bez I složky' }] },
    { g: 'Regulátor rychlosti R_Ω', m: 'casc', tunes: [['SO', 'Nastavit podle SO']], rows: [{ id: 'Kpw', l: 'Zesílení K_P', u: 'A·s/rad' }, { id: 'Tiw', l: 'Integrační konstanta T_I', u: 'ms', h: '0 = jen P (Ziegler–Nichols)' }, { id: 'Tfw', l: 'Filtr měření rychlosti T_fω', u: 'ms' }] },
    { g: 'Motor', der: 1, rows: [{ id: 'UN', l: 'Jmenovité napětí kotvy U_N', u: 'V' }, { id: 'IN', l: 'Jmenovitý proud I_N', u: 'A' }, { id: 'nN', l: 'Jmenovité otáčky n_N', u: 'ot/min' },
      { id: 'Rd', l: 'Odpor kotvy R_d', u: 'Ω' }, { id: 'Ld', l: 'Indukčnost kotvy L_d', u: 'mH' }, { id: 'J', l: 'Moment setrvačnosti J_c', u: 'kg·m²' },
      { id: 'UfN', l: 'Jmenovité budicí napětí U_fN', u: 'V' }, { id: 'Rf', l: 'Odpor buzení R_f', u: 'Ω' }, { id: 'Lf', l: 'Indukčnost buzení L_f', u: 'H' }] }
  ],
  presets: [
    { id: 'casc', n: 'Kaskáda: rozběh a zatížení', s: { mode: 'casc' } },
    { id: 'dol', n: 'Přímé připojení na napětí', s: { mode: 'open', U1: 440, tz1: 1, tEnd: 1.5 } },
    { id: 'rp', n: 'Rozběh s předřadným odporem', s: { mode: 'open', U1: 440, Rp: 2, tp: 0.9, tz1: 1.3, tEnd: 1.8 } },
    { id: 'u220', n: 'Příklad: U_q = 220 V', s: { mode: 'open', U1: 220, Tr: 0.5, tz1: 0, tEnd: 1.5 } },
    { id: 'phi', n: 'Příklad: poloviční tok', s: { mode: 'open', U1: 440, Tr: 0.5, Uf: 110, Mz: 134, tz1: 0, tEnd: 1.8 } },
    { id: 'ramp', n: 'Kaskáda s rampou a filtrem', s: { mode: 'casc', ramp: 3000, rf: 1 } },
    { id: 'rev', n: 'Reverzace', s: { mode: 'casc', n1: 1000, t2: 0.6, n2: -1000, Mz: 100, tz1: 0, tEnd: 1.4 } },
    { id: 'nerev', n: 'Zdvih: nereverzační usměrňovač', s: { mode: 'casc', conv: 'nerev', load: 'pot', Mz: 200, tz1: 0, n1: 1000, t2: 0.7, n2: -500, tEnd: 1.5 } },
    { id: 'pm1', n: 'Pulzní měnič S₁: brzdit nejde', s: { mode: 'casc', conv: 'pm1', tmu: 0.1, load: 'fan', Mz: 100, tz1: 0, n1: 1500, t2: 0.6, n2: 500, tEnd: 2 }, retune: 1 },
    { id: 'fw', n: 'Odbuzování na 2500 ot/min', s: { mode: 'casc', fw: 1, ramp: 2000, n1: 1500, t2: 0.8, n2: 2500, Mz: 100, tz1: 0, tEnd: 2.2 } }
  ],
  tune(kind, st) { const t = dcTune(st); if (kind === 'OM') { st.Kpi = r3(t.Kpi); st.Tii = r3(t.Tii); } else { st.Kpw = r3(t.Kpw); st.Tiw = r3(t.Tiw); } return ''; },
  onChange(k, st) { if (k === 'conv') { st.tmu = DC_CONV[st.conv].tmu; Object.assign(st, MODS.dc.autotune(st)); return 1; } },
  valid(st) {
    const bad = ['UN', 'IN', 'nN', 'Rd', 'Ld', 'J', 'UfN', 'Rf', 'Lf', 'tEnd', 'Umax', 'Imax'].filter(k => !(st[k] > 0));
    if (bad.length) return 'Tyto hodnoty musí být kladné: ' + bad.join(', ') + '.';
    if (st.tEnd > 5) return 'Doba simulace je omezená na 5 s.';
    if (st.UN <= st.Rd * st.IN) return 'U_N musí být větší než R_d·I_N, jinak vychází záporné ξ.';
    return '';
  },
  sim: st => simDC(st), step: '20 µs',
  plots(st) {
    const c = st.mode === 'casc';
    return [
      { id: 'n', t: 'Rychlost', u: 'ot/min', d: 0, s: [{ k: 'n', l: 'n', c: 'k' }, { k: 'nref', l: c ? 'n*' : 'n_0 = u_q/ξ (naprázdno)', c: 'r', dash: 1 }] },
      { id: 'i', t: 'Proud kotvy', u: 'A', d: 0, s: [{ k: 'iq', l: 'i_q', c: 'k' }].concat(c ? [{ k: 'iref', l: 'i_q*', c: 'r', dash: 1 }] : []), hl: c ? [st.Imax, DC_CONV[st.conv].iNeg ? -st.Imax : null].filter(v => v != null) : [], hlL: c ? '±I_max' : '' },
      { id: 'M', t: 'Moment', u: 'N·m', d: 0, s: [{ k: 'M', l: 'M = ξi_q', c: 'k' }, { k: 'Mz', l: 'M_z', c: 'b' }] },
      { id: 'u', t: 'Napětí kotvy', u: 'V', d: 0, s: [{ k: 'u', l: 'u_q', c: 'k' }, { k: 'ui', l: 'u_i = ξΩ', c: 'b' }] },
      { id: 'f', t: 'Buzení', u: 'A', d: 2, s: [{ k: 'If', l: 'i_f', c: 'k' }].concat(c ? [{ k: 'IfRef', l: 'i_f*', c: 'r', dash: 1 }] : []) }
    ];
  },
  xyTitle: 'Rovina Ω–M', xyNote: 'Moment vodorovně, rychlost svisle (kvadranty I–IV jako ve skriptech). Červeně ustálená charakteristika Ω = u_q/ξ − R·M/ξ² pro okamžité u_q a ξ.',
  xy(st, R, idx) {
    const [nl, nh] = rngOf([R.n], 0.1, [0]), [Ml, Mh] = rngOf([R.M], 0.1, [0, st.Mz, -(st.load === 'pot' ? 0 : st.Mz * (aminS(R.n) < -1 ? 1 : 0))]);
    const u = R.u[idx], xi = R.xi[idx], Rt = R.R[idx], sc = xi > 1e-6 ? [Ml, Mh].map(M => [M, toRpm(u / xi - Rt * M / (xi * xi))]) : [];
    return { xl: 'M [N·m]', yl: 'n [ot/min]', xr: [Ml, Mh], yr: [nl, nh], quad: 1,
      series: [{ pts: st.Mz ? loadCurve(st, st.Mz, nl, nh, toRad(st.nN)) : [], c: 'b', dash: 1, w: 2 }, { pts: sc, c: 'r', w: 2 }, { pts: trajMN(R), c: 'k', w: 1.3 }],
      dots: [{ x: R.M[idx], y: R.n[idx], c: 'r', r: 6 }], leg: [['k', 'trajektorie'], ['r', 'ustálená charakteristika'], ['b', 'zátěž M_z(n)', 1]] };
  },
  derived(st) {
    const d = dcDerived(st);
    return [['ξ_N = CΦ_N', fmt(d.xiN, 3) + ' V·s'], ['M_N = ξ_N I_N', fmt(d.MN, 0) + ' N·m'], ['P_N', fmt(d.PN / 1000, 1) + ' kW'], ['n_0 = U_N/ξ_N', fmt(d.n0, 0) + ' ot/min'],
      ['τ_d = L_d/R_d', fmt(d.taud * 1e3, 1) + ' ms'], ['τ_m = R_d J_c/ξ²', fmt(d.taum * 1e3, 1) + ' ms'], ['τ_f = L_f/R_f', fmt(d.tauf, 2) + ' s'], ['T_N = J_c Ω_N/M_N', fmt(d.TN, 2) + ' s'], ['I_zab = U_N/R_d', fmt(d.Izab, 0) + ' A']];
  },
  tiles(st, R) {
    const d = R.d, ip = amax(R.iq), reg = st.mode === 'casc', ne = lastOf(R.n), te = lastOf(R.t);
    return [['Největší proud kotvy', fmt(ip, 0) + ' A', fmt(ip / st.IN, 1) + ' × I_N'], ['Největší moment', fmt(amax(R.M), 0) + ' N·m', fmt(amax(R.M) / d.MN, 1) + ' × M_N']]
      .concat(speedTiles(st, R, reg, st.mode === 'open' ? [st.tp] : []), [['Rychlost na konci', fmt(ne, 0) + ' ot/min', reg ? 'odchylka ' + fmt(ne - (te >= st.t2 ? st.n2 : st.n1), 1) + ' ot/min' : '']]);
  },
  theory(st) {
    const d = dcDerived(st), tu = dcTune(st), tmu = st.tmu, ts = tu.ts * 1e3, acc = (d.xiN * st.Imax - (st.load === 'pot' || st.load === 'react' ? st.Mz : 0)) / st.J;
    return `<h2>Co simulace počítá</h2><div class="cols">
<div><p>Kotva, buzení a pohybová rovnice z kap. 7; Runge–Kutta 4. řádu s krokem 20 µs. Lineární magnetický obvod (ξ = ξ<sub>N</sub>i<sub>f</sub>/i<sub>fN</sub>), měnič jako střední hodnota se zpožděním 1/(1 + sτ<sub>U</sub>); nereverzační měnič a pulzní měnič S₁ nedovolí záporný proud.</p>
<p>Zadaný motor: ξ<sub>N</sub> = ${V(d.xiN, 3, 'V·s')}, M<sub>N</sub> = ${V(d.MN, 0, 'N·m')}, τ<sub>d</sub> = ${V(d.taud * 1e3, 1, 'ms')}, τ<sub>m</sub> = ${V(d.taum * 1e3, 1, 'ms')}${d.taum < 4 * d.taud ? ' (τ<sub>m</sub> &lt; 4τ<sub>d</sub>: odezva na napětí mírně kmitá)' : ''}. Přímým připojením U<sub>N</sub>/R<sub>d</sub> = ${V(d.Izab, 0, 'A')} = ${fmt(d.Izab / st.IN, 0)} I<sub>N</sub>; indukčnost kotvy špičku v simulaci sníží.</p>
<h3>Nastavení pro zadaný motor</h3>
<p>OM: T<sub>I</sub> = τ<sub>d</sub> = ${V(tu.Tii, 1, 'ms')}, K<sub>P</sub> = L<sub>d</sub>/(2τ<sub>U</sub>) = ${V(tu.Kpi, 3, 'V/A')}; první dosažení 4,7τ<sub>U</sub> = ${V(4.7 * tmu, 1, 'ms')}.<br>SO: τ<sub>σ</sub> = 2τ<sub>U</sub> + T<sub>fω</sub> = ${V(ts, 2, 'ms')}, T<sub>I</sub> = ${V(tu.Tiw, 1, 'ms')}, K<sub>P</sub> = J<sub>c</sub>/(2ξ<sub>N</sub>τ<sub>σ</sub>) = ${V(tu.Kpw, 2, 'A·s/rad')}; první dosažení 3,1τ<sub>σ</sub> = ${V(3.1 * ts, 1, 'ms')}.<br>Na omezení proudu: zrychlení (ξI<sub>max</sub> − M<sub>z</sub>)/J<sub>c</sub> ≈ ${V(acc, 0, 'rad/s²')}.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">
${expI('dc:dol', 'Přímé připojení: odečtěte špičku proudu a porovnejte s U<sub>N</sub>/R<sub>d</sub>. Proč se DC motor tímto způsobem nerozbíhá?')}
${expI('dc:rp', 'Předřadný odpor 2 Ω drží proud kolem 2 I<sub>N</sub>. Vyřaďte ho dřív (t = 0,3 s) a sledujte proudový ráz.')}
${expI('dc:u220', 'Řešený příklad: U<sub>q</sub> = 220 V a M<sub>N</sub> → 74,8 rad/s = 714 ot/min. Ověřte v dlaždici.')}
${expI('dc:phi', 'Poloviční tok (U<sub>f</sub> = 110 V): 314 rad/s = 3000 ot/min při polovičním momentu, stejný výkon.')}
${expI('dc:casc', 'Nastavte n<sub>1</sub> = 20 ot/min (bez omezení) a odečtěte překmit ≈ 43 %; pak zapněte filtr žádané. Zvětšete τ<sub>U</sub> na 5 ms bez přeladění, nakonec obě tlačítka „Nastavit“.')}</ol></div>
<div><ol class="exp" start="6">
${expI('dc:casc', 'Ziegler–Nichols: n<sub>1</sub> = 20 ot/min, T<sub>I</sub> rychlosti = 0, zvyšujte K<sub>P</sub> až k netlumeným kmitům. Pak K<sub>P</sub> = 0,45K<sub>kr</sub>, T<sub>I</sub> = 0,85T<sub>kr</sub>.')}
${expI('dc:nerev', 'Nereverzační usměrňovač s aktivní zátěží: zdvih v I. a spouštění ve IV. kvadrantu (u<sub>q</sub> &lt; 0, proud kladný).')}
${expI('dc:pm1', 'Pulzní měnič jen se spínačem S₁ neumí záporný proud: motor jen dobíhá zátěží. Přepněte na S₁ + S₂.')}
${expI('dc:fw', 'Odbuzování: nad n<sub>N</sub> klesá i<sub>f</sub>, u<sub>q</sub> zůstává u maxima, stejný moment potřebuje větší proud.')}</ol></div></div>`;
  }
};

/* ======================= Kap. 8: sériový DC ======================= */
MODS.ser = {
  label: 'Sériový DC', chap: '8', ch: [8], tpl: 'tpl-ser',
  def: { mode: 'open', U: 600, R: 0.5, L: 15, C: 0.02, Is: 300, ir: 5, J: 8, B: 0, U1: 600, U2: 600, Tr: 0, t1: 0.02, t2: 99, Rp: 1, tp: 1, tEnd: 8, tz1: 0, tz2: 99, Mz: 200, load: 'react', nb: 2000, tb: 99, Rbr: 2, Imax: 400, tmu: 0.1, Kpw: 20, Tiw: 300, I1: 300, I2: 0, n1: 2000, n2: 2000, ramp: 0 },
  autotune: st => serTune(st),
  fields: [
    { g: 'Způsob řízení', rows: [{ id: 'mode', type: 'sel', opts: [['open', 'Ovládání napětím, rozběh s odporem'], ['ireg', 'Regulace proudu (vozidlo MHD, pedál = proud)'], ['wreg', 'Regulace rychlosti (lokomotiva)'], ['brake', 'Rozběh a odporové brzdění']] }] },
    { g: 'Scénář', rows: [{ id: 'tEnd', l: 'Doba simulace', u: 's', h: 'nejvýš 20 s' }, { id: 't1', l: 'Čas t_1', u: 's' },
      { id: 'U1', l: 'Napětí od t_1', u: 'V', m: 'open brake' }, { id: 'I1', l: 'Žádaný proud (pedál) od t_1', u: 'A', m: 'ireg' }, { id: 'n1', l: 'Žádaná rychlost od t_1', u: 'ot/min', m: 'wreg' },
      { id: 't2', l: 'Čas t_2', u: 's', m: 'open ireg wreg' }, { id: 'U2', l: 'Napětí od t_2', u: 'V', m: 'open' }, { id: 'I2', l: 'Žádaný proud od t_2', u: 'A', m: 'ireg' }, { id: 'n2', l: 'Žádaná rychlost od t_2', u: 'ot/min', m: 'wreg' },
      { id: 'Tr', l: 'Rampa napětí: doba 0 → U', u: 's', m: 'open brake' }, { id: 'ramp', l: 'Rampa žádané rychlosti', u: 'ot/min/s', m: 'wreg' },
      { id: 'tb', l: 'Přepnutí na odporové brzdění v', u: 's', m: 'brake' }, { id: 'tz1', l: 'Zátěž zapnout v čase', u: 's' }, { id: 'tz2', l: 'Zátěž vypnout v čase', u: 's' }] },
    { g: 'Zátěž', rows: [{ id: 'load', type: 'sel', opts: LOADS }, { id: 'Mz', l: 'Zátěžný moment M_z', u: 'N·m' }, { id: 'nb', l: 'Vztažné otáčky (ventilátor, kalandr)', u: 'ot/min' }, { id: 'B', l: 'Viskózní tření B', u: 'N·m·s/rad' }] },
    { g: 'Spouštěcí a brzdný odpor', m: 'open brake', rows: [{ id: 'Rp', l: 'Předřadný odpor R_p', u: 'Ω' }, { id: 'tp', l: 'Vyřazení R_p v čase', u: 's' }, { id: 'Rbr', l: 'Brzdný odpor R_br', u: 'Ω', m: 'brake' }, { id: 'ir', l: 'Remanence (ekvivalentní proud)', u: 'A', m: 'brake' }] },
    { g: 'Pulzní měnič a regulátory', m: 'ireg wreg', tunes: [['OM', 'Proud podle OM']], rows: [{ id: 'tmu', l: 'Zpoždění měniče τ_PM', u: 'ms' }, { id: 'Kpi', l: 'R_i: zesílení K_P', u: 'V/A' }, { id: 'Tii', l: 'R_i: T_I', u: 'ms' },
      { id: 'Imax', l: 'Omezení proudu', u: 'A', m: 'wreg' }, { id: 'Kpw', l: 'R_Ω: zesílení K_P', u: 'A·s/rad', m: 'wreg' }, { id: 'Tiw', l: 'R_Ω: T_I', u: 'ms', m: 'wreg' }] },
    { g: 'Motor', rows: [{ id: 'U', l: 'Napětí zdroje (troleje) U', u: 'V' }, { id: 'R', l: 'Odpor obvodu R_dc', u: 'Ω' }, { id: 'L', l: 'Indukčnost obvodu L_dc', u: 'mH' },
      { id: 'C', l: 'Konstanta C_U = C_M', u: 'V·s/A' }, { id: 'Is', l: 'Proud sycení I_s', u: 'A', h: '0 = lineární magnetický obvod' }, { id: 'J', l: 'Moment setrvačnosti J_c', u: 'kg·m²' }] }
  ],
  presets: [
    { id: 'open', n: 'Rozběh s odporem', s: {} },
    { id: 'run', n: 'Odlehčení: motor „utíká“', s: { Mz: 200, tz2: 4, tEnd: 10 } },
    { id: 'mhd', n: 'MHD: pedál = proud', s: { mode: 'ireg', I1: 300, t2: 3, I2: 0, tEnd: 6 } },
    { id: 'loko', n: 'Lokomotiva: regulace rychlosti', s: { mode: 'wreg', n1: 2000, tEnd: 5 } },
    { id: 'brake', n: 'Odporové brzdění', s: { mode: 'brake', tb: 4, Mz: 50, tEnd: 10 } },
    { id: 'lin', n: 'Lineární obvod: příklad ze skript', s: { Is: 0, Rp: 1, tEnd: 12 } }
  ],
  tune(kind, st) { Object.assign(st, serTune(st)); return ''; },
  valid: st => ['U', 'R', 'L', 'C', 'J', 'tEnd'].filter(k => !(st[k] > 0)).length ? 'U, R, L, C, J a doba musí být kladné.' : st.tEnd > 20 ? 'Doba simulace nejvýš 20 s.' : '',
  sim: st => simSer(st), step: '20 µs',
  plots(st) {
    return [
      { id: 'n', t: 'Rychlost', u: 'ot/min', d: 0, s: [{ k: 'n', l: 'n', c: 'k' }].concat(st.mode === 'wreg' ? [{ k: 'nref', l: 'n*', c: 'r', dash: 1 }] : []) },
      { id: 'i', t: 'Proud (kotva = buzení)', u: 'A', d: 0, s: [{ k: 'i', l: 'i', c: 'k' }].concat(st.mode === 'ireg' || st.mode === 'wreg' ? [{ k: 'iref', l: 'i*', c: 'r', dash: 1 }] : []) },
      { id: 'M', t: 'Moment', u: 'N·m', d: 0, s: [{ k: 'M', l: 'M = C_M i² (lin.)', c: 'k' }, { k: 'Mz', l: 'M_z', c: 'b' }] },
      { id: 'u', t: 'Napětí', u: 'V', d: 0, s: [{ k: 'u', l: st.mode === 'brake' ? 'u (na odporech)' : 'u', c: 'k' }, { k: 'ui', l: 'u_i = C_U i Ω', c: 'b' }] },
      { id: 'xi', t: 'Tok ξ(i) = C_U Φ', u: 'V·s', d: 3, s: [{ k: 'xi', l: 'ξ', c: 'k' }] }
    ];
  },
  xyTitle: 'Rovina Ω–M', xyNote: 'Červeně ustálená (polytropní) charakteristika pro okamžité napětí a odpor; při brzdění brzdná charakteristika dynama.',
  xy(st, R, idx) {
    const [nl, nh] = rngOf([R.n], 0.1, [0]), [Ml, Mh] = rngOf([R.M], 0.08, [0, st.Mz]);
    const sc = [], br = R.br[idx], u = R.u[idx], Rt = R.R[idx];
    for (let k = 1; k <= 300; k++) {
      const i = k * 4 * Math.max(st.Imax, amax(R.i)) / 300;
      if (br) { const xb = st.C * st.Is * Math.tanh((i + st.ir) / st.Is); sc.push([-xb * i, toRpm(Rt * i / xb)]); }
      else { const xi = serXi(st, i), n = toRpm((u - Rt * i) / xi); sc.push([xi * i, n]); }
    }
    return { xl: 'M [N·m]', yl: 'n [ot/min]', xr: [Ml, Mh], yr: [nl, nh], quad: 1,
      series: [{ pts: st.Mz ? loadCurve(st, st.Mz, nl, nh, toRad(st.nb)) : [], c: 'b', dash: 1, w: 2 }, { pts: sc, c: 'r', w: 2 }, { pts: trajMN(R), c: 'k', w: 1.3 }],
      dots: [{ x: R.M[idx], y: R.n[idx], c: 'r', r: 6 }], leg: [['k', 'trajektorie'], ['r', 'ustálená charakteristika'], ['b', 'zátěž', 1]] };
  },
  tiles(st, R) {
    const I0 = st.U / (st.R + st.Rp), Mz0 = serXi(st, I0) * I0;
    return [['Největší proud', fmt(amax(R.i), 0) + ' A', ''], ['Největší moment', fmt(amaxS(R.M), 0) + ' N·m', 'záběr ' + fmt(Mz0, 0) + ' N·m při ' + fmt(I0, 0) + ' A'],
      ['Rychlost na konci', fmt(lastOf(R.n), 0) + ' ot/min', ''], ['Proud na konci', fmt(lastOf(R.i), 1) + ' A', 'lineárně Ω = U/(C_U I) − R/C_U'],
      ['Mez samobuzení', st.mode === 'brake' ? fmt(toRpm((st.R + st.Rbr) / st.C), 0) + ' ot/min' : '–', 'Ω > (R + R_br)/C_U']];
  },
  theory(st) {
    return `<h2>Co simulace počítá</h2><div class="cols"><div><p>Jediný obvod (kotva + buzení v sérii): L<sub>dc</sub> di/dt = u − R i − ξ(i)Ω, M = ξ(i)·i, kde ξ(i) = C<sub>U</sub>Φ(i). V lineární oblasti ξ = C<sub>U</sub>i a M = C<sub>M</sub>i²; sycení modeluje ξ = C<sub>U</sub>I<sub>s</sub>·tanh(i/I<sub>s</sub>). Proud nemění smysl (diody, pulzní měnič v I. kvadrantu).</p>
<p>Při odporovém brzdění je kotva na odporu R<sub>br</sub> a buzení přepólované: proud se nabudí z remanence, jen když C<sub>U</sub>Ω > R + R<sub>br</sub>, tedy nad ${V(toRpm((st.R + st.Rbr) / st.C), 0, 'ot/min')}.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">${expI('ser:lin', 'Lineární obvod a příklad ze skript: při 100 A je Ω = 275 rad/s a M = 200 N·m. Ověřte konec simulace.')}
${expI('ser:run', 'Odlehčení: po vypnutí zátěže rychlost roste nade všechny meze (omezí ji jen tření). Proto sériový motor nesmí běžet naprázdno.')}</ol></div>
<div><ol class="exp" start="3">${expI('ser:mhd', 'MHD: řidič zadává proud, tedy tah. Rychlost vyplyne ze zátěže; po uvolnění pedálu vozidlo dojíždí.')}
${expI('ser:brake', 'Odporové brzdění: po přepnutí se dynamo nabudí, brzdí a pod mezí samobuzení brzdný moment zmizí. Zmenšete R<sub>br</sub> na 1 Ω.')}</ol></div></div>`;
  }
};

/* ======================= Kap. 9: asynchronní ======================= */
MODS.am = {
  label: 'Asynchronní', chap: '9', ch: [9], tpl: 'tpl-am', after: root => initTr(root),
  def: { mode: 'foc', UN: 400, fN: 50, pp: 2, R1: 0.6, R2: 0.5, L1s: 4, L2s: 4, Lh: 120, J: 0.2, B: 0, MN: 61,
    tEnd: 1.8, t1: 0.15, t2: 0.9, f1: 50, f2: 50, n1: 1500, n2: -1500, rampF: 50, ramp: 0, tz1: 0.6, tz2: 99, Mz: 61, load: 'react',
    yd: 0, tp: 0.8, Udc: 600, tmu: 0.1, U0: 8, f2max: 5, Kps: 0.3, Tis: 100, Imax: 50, Mlim: 122, fw: 0, nb: 1500, kR2: 1, encErr: 0, psiN: 0.9, Tfw: 2,
    brk: 'none', tb: 0.8, Udcb: 40, Rp2: 0, tR: 0.6 },
  autotune: st => { const t = imTune(st); return { Kpc: r3(t.Kpc), Tic: r3(t.Tic), Kpf: r3(t.Kpf), Tif: r3(t.Tif), Kpw: r3(t.Kpw), Tiw: r3(t.Tiw) }; },
  fields: [
    { g: 'Způsob řízení', rows: [{ id: 'mode', type: 'sel', opts: [['dol', 'Přímé připojení na síť'], ['uf', 'Skalární U/f bez zpětné vazby'], ['ufw', 'Skalární s čidlem rychlosti (f₁ = f + f₂)'], ['foc', 'Vektorové řízení s čidlem rychlosti (nepřímé)']] }] },
    { g: 'Scénář', rows: [
      { id: 'tEnd', l: 'Doba simulace', u: 's', h: 'nejvýš 5 s' }, { id: 't1', l: 'Čas t_1 – připojení / první povel', u: 's' },
      { id: 'yd', type: 'chk', l: 'Rozběh hvězda–trojúhelník', m: 'dol' }, { id: 'tp', l: 'Přepnutí Y → D v čase', u: 's', m: 'dol' },
      { id: 'Rp2', l: 'Odpor v rotoru R_p (kroužkový motor)', u: 'Ω', m: 'dol' }, { id: 'tR', l: 'Vyřazení R_p v čase', u: 's', m: 'dol' },
      { id: 'brk', type: 'sel', l: 'Brzdění', m: 'dol', opts: [['none', 'bez brzdění'], ['plug', 'protiproudem (přehození dvou fází)'], ['dcb', 'stejnosměrným proudem']] },
      { id: 'tb', l: 'Začátek brzdění', u: 's', m: 'dol' }, { id: 'Udcb', l: 'Stejnosměrné napětí pro brzdění', u: 'V', m: 'dol' },
      { id: 'f1', l: 'Frekvence od t_1', u: 'Hz', m: 'uf' }, { id: 'n1', l: 'Žádaná rychlost od t_1', u: 'ot/min', m: 'ufw foc' },
      { id: 't2', l: 'Čas t_2 – druhý povel', u: 's', m: 'uf ufw foc', h: 'čas za koncem simulace = nenastane' },
      { id: 'f2', l: 'Frekvence od t_2', u: 'Hz', m: 'uf' }, { id: 'n2', l: 'Žádaná rychlost od t_2', u: 'ot/min', m: 'ufw foc' },
      { id: 'rampF', l: 'Rampa frekvence', u: 'Hz/s', m: 'uf', h: '0 = skok' }, { id: 'ramp', l: 'Rampa žádané rychlosti', u: 'ot/min/s', m: 'ufw foc', h: '0 = skok' },
      { id: 'tz1', l: 'Zátěž zapnout v čase', u: 's' }, { id: 'tz2', l: 'Zátěž vypnout v čase', u: 's' }] },
    { g: 'Zátěž', rows: [{ id: 'load', type: 'sel', opts: LOADS }, { id: 'Mz', l: 'Zátěžný moment M_z', u: 'N·m', h: 'u ventilátorové a kalandrové hodnota při synchronních otáčkách' }, { id: 'B', l: 'Viskózní tření B', u: 'N·m·s/rad' }] },
    { g: 'Měnič frekvence', m: 'uf ufw foc', rows: [{ id: 'Udc', l: 'Napětí meziobvodu U_d', u: 'V', h: 'největší amplituda fázového napětí U_d/√3 (SVM)' }, { id: 'tmu', l: 'Náhradní zpoždění střídače τ_μ', u: 'ms' },
      { id: 'U0', l: 'Kompenzace R_1 (boost) U_0', u: 'V', m: 'uf ufw', h: 'amplituda fázového napětí při f → 0' },
      { id: 'f2max', l: 'Omezení rotorové frekvence f_2max', u: 'Hz', m: 'ufw' },
      { id: 'Imax', l: 'Omezení proudu |i_1|max (amplituda)', u: 'A', m: 'foc' }, { id: 'Mlim', l: 'Omezení momentu', u: 'N·m', m: 'foc' },
      { id: 'psiN', l: 'Žádaný rotorový tok ψ_2*', u: 'Wb', m: 'foc' },
      { id: 'fw', type: 'chk', l: 'Odbuzování nad n_b (ψ_2* ~ 1/n)', m: 'foc' }, { id: 'nb', l: 'Začátek odbuzování n_b', u: 'ot/min', m: 'foc' },
      { id: 'kR2', l: 'R_2 v modelu regulátoru / skutečný R_2', u: '–', m: 'foc', h: 'oteplení rotoru mění R_2 až o desítky %' },
      { id: 'encErr', l: 'Chyba čidla rychlosti', u: '%', m: 'foc' }] },
    { g: 'Regulátor rychlosti R_Ω', m: 'ufw', rows: [{ id: 'Kps', l: 'Zesílení K_P', u: 'Hz·s/rad' }, { id: 'Tis', l: 'Integrační konstanta T_I', u: 'ms' }, { id: 'Tfw', l: 'Filtr měření rychlosti T_fω', u: 'ms' }] },
    { g: 'Regulátory proudu R_i1d, R_i1q', m: 'foc', tunes: [['OMi', 'Nastavit podle OM']], rows: [{ id: 'Kpc', l: 'Zesílení K_P', u: 'V/A' }, { id: 'Tic', l: 'Integrační konstanta T_I', u: 'ms' }] },
    { g: 'Regulátor toku R_Ψ', m: 'foc', tunes: [['OMf', 'Nastavit podle OM']], rows: [{ id: 'Kpf', l: 'Zesílení K_P', u: 'A/Wb' }, { id: 'Tif', l: 'Integrační konstanta T_I', u: 'ms' }] },
    { g: 'Regulátor rychlosti R_Ω', m: 'foc', tunes: [['SOa', 'Nastavit podle SO']], rows: [{ id: 'Kpw', l: 'Zesílení K_P', u: 'N·m·s/rad' }, { id: 'Tiw', l: 'Integrační konstanta T_I', u: 'ms', h: '0 = jen P' }, { id: 'Tfw', l: 'Filtr měření rychlosti T_fω', u: 'ms' }] },
    { g: 'Motor', der: 1, rows: [{ id: 'UN', l: 'Jmenovité sdružené napětí U_N', u: 'V' }, { id: 'fN', l: 'Jmenovitá frekvence f_N', u: 'Hz' }, { id: 'pp', l: 'Počet pólových dvojic p_p', u: '–' },
      { id: 'R1', l: 'Odpor statoru R_1', u: 'Ω' }, { id: 'R2', l: 'Odpor rotoru R_2 (přepočtený)', u: 'Ω' }, { id: 'L1s', l: 'Rozptylová indukčnost L_1σ', u: 'mH' },
      { id: 'L2s', l: 'Rozptylová indukčnost L_2σ', u: 'mH' }, { id: 'Lh', l: 'Magnetizační indukčnost L_h', u: 'mH' }, { id: 'J', l: 'Moment setrvačnosti J', u: 'kg·m²' },
      { id: 'MN', l: 'Jmenovitý moment M_N', u: 'N·m', h: 'jen pro vztažné hodnoty (n_N, I_N, T_N)' }] }
  ],
  presets: [
    { id: 'foc', n: 'Vektorové: rozběh, zátěž, reverzace', s: { mode: 'foc' } },
    { id: 'dol', n: 'Přímé připojení na síť', s: { mode: 'dol', t1: 0.02, tz1: 0.6, tEnd: 1 } },
    { id: 'yd', n: 'Rozběh hvězda–trojúhelník', s: { mode: 'dol', yd: 1, tp: 0.9, t1: 0.02, Mz: 20, tz1: 0, tEnd: 1.4 } },
    { id: 'rp2', n: 'Kroužkový motor: M_zab = M_max', s: { mode: 'dol', t1: 0.02, Rp2: 2.01, tR: 0.6, tz1: 0, Mz: 61, tEnd: 1.2 } },
    { id: 'plug', n: 'Brzdění protiproudem', s: { mode: 'dol', t1: 0.02, brk: 'plug', tb: 0.7, tz1: 99, tEnd: 1.6 } },
    { id: 'dcb', n: 'Brzdění stejnosměrným proudem', s: { mode: 'dol', t1: 0.02, brk: 'dcb', tb: 0.7, tz1: 99, tEnd: 2 } },
    { id: 'uf', n: 'U/f s rampou 50 Hz/s', s: { mode: 'uf', t1: 0.02, t2: 99, tz1: 1.4, tEnd: 1.8 } },
    { id: 'uffast', n: 'U/f: příliš strmá rampa', s: { mode: 'uf', t1: 0.02, t2: 99, rampF: 1000, Mz: 30, tz1: 0, tEnd: 1 } },
    { id: 'uf5', n: 'U/f: 5 Hz bez kompenzace R₁', s: { mode: 'uf', t1: 0.02, t2: 99, f1: 5, rampF: 10, U0: 0, Mz: 40, tz1: 0, tEnd: 1.5 } },
    { id: 'ufw', n: 'Skalární s čidlem rychlosti', s: { mode: 'ufw', t1: 0.02, n1: 1000, tz1: 1, t2: 1.5, n2: -1000, tEnd: 3 } },
    { id: 'r2', n: 'Vektorové: R₂ v regulátoru +50 %', s: { mode: 'foc', n1: 1000, t2: 99, tEnd: 1.2, kR2: 1.5 } },
    { id: 'enc', n: 'Vektorové: chyba čidla 1 %', s: { mode: 'foc', n1: 1000, t2: 99, tEnd: 1.2, encErr: 1 } },
    { id: 'fw', n: 'Vektorové: odbuzování na 2500 ot/min', s: { mode: 'foc', n1: 2500, ramp: 3000, fw: 1, Mz: 30, tz1: 0, t2: 99, tEnd: 2 } }
  ],
  tune(kind, st) { const t = imTune(st); if (kind === 'OMi') { st.Kpc = r3(t.Kpc); st.Tic = r3(t.Tic); } if (kind === 'OMf') { st.Kpf = r3(t.Kpf); st.Tif = r3(t.Tif); } if (kind === 'SOa') { st.Kpw = r3(t.Kpw); st.Tiw = r3(t.Tiw); } return ''; },
  valid(st) {
    const bad = ['UN', 'fN', 'pp', 'R1', 'R2', 'L1s', 'L2s', 'Lh', 'J', 'tEnd', 'Udc', 'Imax', 'psiN', 'kR2', 'MN'].filter(k => !(st[k] > 0));
    if (bad.length) return 'Tyto hodnoty musí být kladné: ' + bad.join(', ') + '.';
    return st.tEnd > 5 ? 'Doba simulace je omezená na 5 s.' : '';
  },
  sim: st => simIM(st), step: '10 µs',
  plots(st, R) {
    const m = st.mode, reg = m === 'ufw' || m === 'foc', foc = m === 'foc';
    return [
      { id: 'n', t: 'Rychlost', u: 'ot/min', d: 0, s: [{ k: 'n', l: 'n', c: 'k' }, { k: 'nsync', l: 'n_s = 60f_1/p_p', c: 'b', dash: 1 }].concat(reg ? [{ k: 'nref', l: 'n*', c: 'r', dash: 1 }] : []) },
      { id: 'M', t: 'Moment', u: 'N·m', d: 0, s: [{ k: 'M', l: 'M', c: 'k' }, { k: 'Mz', l: 'M_z', c: 'b' }].concat(foc ? [{ k: 'Mref', l: 'M*', c: 'r', dash: 1 }] : []) },
      { id: 'i', t: (m === 'dol' && st.yd) ? 'Proud ze sítě' : 'Proud statoru', u: 'A', d: 1, s: [{ k: 'ia', l: 'i_a', c: 'o' }, { k: 'imag', l: '|i_1| (amplituda)', c: 'k' }], hl: foc ? [st.Imax] : [], hlL: foc ? '|i_1|max' : '' },
      { id: 'dq', t: 'Složky proudu v ose toku ψ_2', u: 'A', d: 1, s: [{ k: 'id', l: 'i_1d', c: 'k' }, { k: 'iq', l: 'i_1q', c: 'r' }].concat(foc ? [{ k: 'idRef', l: 'i_1d*', c: 'k', dash: 1 }, { k: 'iqRef', l: 'i_1q*', c: 'r', dash: 1 }] : []) },
      { id: 'psi', t: 'Toky', u: 'Wb', d: 3, s: [{ k: 'psi2', l: '|ψ_2|', c: 'k' }, { k: 'psi1', l: '|ψ_1|', c: 'b' }].concat(foc ? [{ k: 'psiRef', l: 'ψ_2*', c: 'r', dash: 1 }, { k: 'psim', l: 'ψ_2 v modelu regulátoru', c: 'o', dash: 1 }] : []) },
      { id: 'u', t: 'Napětí statoru', u: 'V', d: 0, s: [{ k: 'umag', l: '|u_1| (amplituda fáze)', c: 'k' }], hl: m === 'dol' ? [] : [R ? R.uMax : 0], hlL: m === 'dol' ? '' : 'U_d/√3' }
    ];
  },
  xyTitle: 'Rovina Ω–M', xyNote: 'Červeně ustálená charakteristika z T-schématu pro okamžité |u₁| a f₁ (při vektorovém řízení jen orientačně).',
  xy(st, R, idx) {
    let [nl, nh] = rngOf([R.n], 0.1, [0]); if (st.mode === 'dol') nh = Math.max(nh, R.d.nS * 1.06);
    const [Ml, Mh] = rngOf([R.M], 0.08, [0, st.Mz]);
    const sc = imCurve({ ...st, R2: R.R2[idx] }, R.d, R.umag[idx], R.f1[idx], nl, nh);
    return { xl: 'M [N·m]', yl: 'n [ot/min]', xr: [Ml, Mh], yr: [nl, nh], quad: 1,
      series: [{ pts: st.Mz ? loadCurve(st, st.Mz, nl, nh, R.d.Ws) : [], c: 'b', dash: 1, w: 2 }, { pts: sc, c: 'r', w: 2 }, { pts: trajMN(R), c: 'k', w: 1.3 }],
      dots: [{ x: R.M[idx], y: R.n[idx], c: 'r', r: 6 }], leg: [['k', 'trajektorie'], ['r', 'ustálená charakteristika (T-schéma)'], ['b', 'zátěž M_z(n)', 1]] };
  },
  derived(st) {
    const d = imDerived(st);
    return [['n_s', fmt(d.nS, 0) + ' ot/min'], ['M_max (T-schéma)', fmt(d.Mmax, 1) + ' N·m'], ['s_zv', fmt(d.szv, 3)], ['M_max/M_N', fmt(d.Mmax / st.MN, 2)],
      ['M_zab', fmt(d.Mzab, 1) + ' N·m'], ['I_zab (ef.)', fmt(d.Izab, 1) + ' A'], ['I_0 (ef.)', fmt(d.I0, 1) + ' A'], ['n_N při M_N', fmt(d.nN, 0) + ' ot/min'],
      ['I_N (ef.)', fmt(d.IN, 1) + ' A'], ['cos φ_N', fmt(d.cosN, 2)], ['P_N', fmt(d.PN / 1000, 1) + ' kW'], ['τ_2 = L_2/R_2', fmt(d.tau2 * 1e3, 0) + ' ms'],
      ['σ', fmt(d.sigma, 3)], ['T_N', fmt(d.TN, 2) + ' s'], ['R_p pro s_zv = 1', fmt(TAU * st.fN * (st.L1s + st.L2s) / 1e3 - st.R2, 2) + ' Ω']];
  },
  tiles(st, R) {
    const d = R.d, ip = amax(R.ia), Mx = amaxS(R.M), Mn = aminS(R.M), reg = st.mode === 'ufw' || st.mode === 'foc', ne = lastOf(R.n), te = lastOf(R.t);
    const out = [['Největší proud (amplituda)', fmt(ip, 0) + ' A', fmt(ip / (d.IN * Math.SQRT2), 1) + ' × √2·I_N'], ['Moment max / min', fmt(Mx, 0) + ' / ' + fmt(Mn, 0), 'N·m, ' + fmt(Mx / st.MN, 1) + ' × M_N']].concat(speedTiles(st, R, reg, st.mode === 'dol' ? [st.yd ? st.tp : null, st.brk !== 'none' ? st.tb : null, st.Rp2 > 0 ? st.tR : null] : []));
    if (st.mode === 'dol' || st.mode === 'uf') { const ns = lastOf(R.nsync); out.push(['Rychlost a skluz na konci', fmt(ne, 0) + ' ot/min', 's = ' + (Math.abs(ns) > 1 ? fmt((ns - ne) / ns, 3) : '–')]); }
    else out.push(['Rychlost na konci', fmt(ne, 0) + ' ot/min', 'odchylka ' + fmt(ne - (te >= st.t2 ? st.n2 : st.n1), 1) + ' ot/min']);
    return out;
  },
  theory(st) {
    const d = imDerived(st), tu = imTune(st), K = 1.5 * st.pp * d.Lh * d.Lh / d.L2;
    return `<h2>Co simulace počítá</h2><div class="cols"><div><p>Prostorové vektory v osách (α, β), K = 2/3, stavy ψ<sub>1</sub>, ψ<sub>2</sub>, Ω; Runge–Kutta 4. řádu s krokem 10 µs. Lineární magnetický obvod, bez ztrát v železe a vytlačování proudu; střídač jako střední hodnota se zpožděním τ<sub>μ</sub>. Amplituda fázového napětí sítě U<sub>N</sub>√2/√3 = ${V(d.Um, 1, 'V')}.</p>
<p>T-schéma: M<sub>max</sub> = ${V(d.Mmax, 1, 'N·m')} při s<sub>zv</sub> = ${V(d.szv, 3)} (zjednodušeně bez R<sub>1</sub>: ${V(d.MmaxSimple, 1, 'N·m')} a ${V(d.szvSimple, 3)}); záběrný proud ${V(d.Izab, 1, 'A')} = ${fmt(d.Izab / d.IN, 1)} I<sub>N</sub>, záběrný moment ${V(d.Mzab, 1, 'N·m')}.</p>
<p>Vektorové řízení: K = 3/2 p<sub>p</sub>L<sub>h</sub>²/L<sub>2</sub> = ${V(K, 3)}, R<sub>σ</sub> = ${V(d.Rsig, 3, 'Ω')}, σL<sub>1</sub> = ${V(d.sigL1 * 1e3, 2, 'mH')}; proud OM: T<sub>I</sub> = ${V(tu.Tic, 2, 'ms')}, K<sub>P</sub> = ${V(tu.Kpc, 1, 'V/A')}; rychlost SO: τ<sub>σ</sub> = ${V(tu.ts * 1e3, 2, 'ms')}, K<sub>P</sub> = ${V(tu.Kpw, 1)}, T<sub>I</sub> = ${V(tu.Tiw, 1, 'ms')}. Omezení |u<sub>1</sub>| ≤ U<sub>d</sub>/√3 = ${V(st.Udc / SQ3, 0, 'V')}.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">
${expI('am:dol', 'Přímé připojení: špička proudu, kmity momentu i záporný moment v první periodě; trajektorie krouží kolem ustálené charakteristiky.')}
${expI('am:yd', 'Hvězda–trojúhelník: proud i moment na třetinu, při přepnutí ráz. Zkuste přepnout dřív (0,3 s).')}
${expI('am:rp2', 'Kroužkový motor s R<sub>p</sub> = X<sub>1σ</sub> + X<sub>2σ</sub> − R<sub>2</sub>: záběrný moment rovný momentu zvratu a menší proud.')}
${expI('am:plug', 'Protiproud: proud větší než záběrný; bez odpojení v nule se motor roztočí opačně.')}
${expI('am:dcb', 'Stejnosměrné brzdění: pole stojí, charakteristika prochází počátkem. Zvyšte napětí na 60 V.')}
${expI('am:uffast', 'Strmá rampa U/f: proudy jako při přímém připojení. Snižujte rampu.')}</ol></div>
<div><ol class="exp" start="7">
${expI('am:uf5', 'Při 5 Hz bez kompenzace R<sub>1</sub> tok klesne na polovinu a motor zátěž neutáhne. Zvyšte U<sub>0</sub> na 8 V a 15 V.')}
${expI('am:ufw', 'Skalární s čidlem: zvyšte f<sub>2max</sub> nad frekvenci zvratu (≈ ' + fmt(d.szv * st.fN, 1) + ' Hz) a sledujte proud.')}
${expI('am:foc', 'Vektorové řízení: tok stálý, moment sleduje M* téměř okamžitě, jako kaskáda DC motoru.')}
${expI('am:r2', 'R<sub>2</sub> v regulátoru +50 %: model počítá špatný skluz, skutečný tok klesne a pro stejný moment teče větší proud.')}
${expI('am:enc', 'Chyba čidla 1 %: f a f<sub>2</sub> se liší až o dva řády, malá chyba rychlosti pootočí osu d.')}
${expI('am:fw', 'Odbuzování: nad n<sub>b</sub> klesá ψ<sub>2</sub>*, napětí u U<sub>d</sub>/√3. Se zátěží 61 N·m už 2500 ot/min neudrží.')}</ol></div></div>`;
  }
};

/* ======================= Kap. 10: synchronní ======================= */
MODS.sm = {
  label: 'Synchronní', chap: '10', ch: [10], tpl: 'tpl-sm', after: root => drawVcurves(root),
  def: { mode: 'step', U: 1, Ui: 1.1, Xd: 0.2, Xq: 2, TN: 2, f: 50, MD: 0, sD: 0.1, Mz0: 0, Mz1: 1, tz: 0.05, tf: 2.5, nu0: 0, tEnd: 1.5 },
  fields: [
    { g: 'Děj', rows: [{ id: 'mode', type: 'sel', opts: [['step', 'Skok zátěže při synchronním chodu'], ['start', 'Asynchronní rozběh a synchronizace']] }] },
    { g: 'Stroj (poměrné jednotky)', rows: [{ id: 'U', l: 'Napětí sítě U', u: 'p.j.' }, { id: 'Ui', l: 'Vnitřní napětí U_i (buzení)', u: 'p.j.' }, { id: 'Xd', l: 'Reaktance v podélné ose X_d', u: 'p.j.', h: 'pro rychlé děje přechodná X′_d' },
      { id: 'Xq', l: 'Reaktance v příčné ose X_q', u: 'p.j.' }, { id: 'TN', l: 'Normální doba rozběhu T_N', u: 's' }, { id: 'f', l: 'Frekvence sítě', u: 'Hz' }] },
    { g: 'Tlumič / rozběhová klec', rows: [{ id: 'MD', l: 'Největší asynchronní moment M_Dmax', u: 'p.j.', h: '0 = bez tlumiče' }, { id: 'sD', l: 'Skluz maxima s_D', u: '–' }] },
    { g: 'Scénář', rows: [{ id: 'Mz0', l: 'Zátěž před skokem', u: 'p.j.' }, { id: 'Mz1', l: 'Zátěž po skoku', u: 'p.j.' }, { id: 'tz', l: 'Skok v čase', u: 's' },
      { id: 'tf', l: 'Nabuzení v čase', u: 's', m: 'start' }, { id: 'nu0', l: 'Počáteční rychlost', u: 'p.j.', m: 'start' }, { id: 'tEnd', l: 'Doba simulace', u: 's' }] }
  ],
  presets: [
    { id: 'eq', n: 'Rovnost ploch: skok 0 → M_N', s: {} },
    { id: 'st', n: 'Skok 0 → 3,6 M_N: ještě stabilní', s: { Mz1: 3.6 } },
    { id: 'un', n: 'Skok 0 → 3,8 M_N: vypadne', s: { Mz1: 3.8 } },
    { id: 'damp', n: 'S tlumičem: kmity se utlumí', s: { MD: 0.5, sD: 0.2, tEnd: 3 } },
    { id: 'start', n: 'Asynchronní rozběh a nabuzení', s: { mode: 'start', Xd: 1, Xq: 0.7, Ui: 1.5, MD: 1.5, sD: 0.3, Mz0: 0.3, Mz1: 0.3, tz: 0, tf: 2.5, tEnd: 5 } },
    { id: 'rel', n: 'Bez buzení: vtáhne reluktanční moment', s: { mode: 'start', Xd: 1, Xq: 0.7, Ui: 0, MD: 1.5, sD: 0.3, Mz0: 0.1, Mz1: 0.1, tz: 0, tf: 99, tEnd: 4 } },
    { id: 'rel2', n: 'Bez buzení, větší zátěž: zůstane asynchronní', s: { mode: 'start', Xd: 1, Xq: 0.7, Ui: 0, MD: 1.5, sD: 0.3, Mz0: 0.3, Mz1: 0.3, tz: 0, tf: 99, tEnd: 4 } }
  ],
  valid: st => ['U', 'Xd', 'Xq', 'TN', 'f', 'tEnd', 'sD'].filter(k => !(st[k] > 0)).length ? 'U, X_d, X_q, T_N, f, s_D a doba musí být kladné.' : st.tEnd > 20 ? 'Doba simulace nejvýš 20 s.' : '',
  sim: st => { const R = simSM(st); R.bw = R.b.map(b => ((b + 180) % 360 + 360) % 360 - 180); return R; }, step: '50 µs',
  plots: () => [
    { id: 'b', t: 'Zátěžný úhel β', u: '°', d: 1, s: [{ k: 'bw', l: 'β (zalomený do ±180°)', c: 'k' }] },
    { id: 'n', t: 'Rychlost', u: 'p.j.', d: 4, s: [{ k: 'n', l: 'Ω/Ω_1', c: 'k' }] },
    { id: 'M', t: 'Momenty', u: 'p.j.', d: 2, s: [{ k: 'Me', l: 'synchronní + reluktanční', c: 'k' }, { k: 'MD', l: 'asynchronní (klec)', c: 'o' }, { k: 'Mz', l: 'M_z', c: 'b' }] }
  ],
  xyTitle: 'Moment v závislosti na zátěžném úhlu', xyNote: 'Červeně M(β) = UU_i/X_d·sin β + U²/2·(1/X_q − 1/X_d)·sin 2β pro okamžité buzení; modře zátěž. Rovnost ploch: plocha nad a pod přímkou zátěže se vyrovná v bodě největšího výkyvu.',
  xy(st, R, idx) {
    const Ui = R.Ui[idx], c = [];
    for (let i = 0; i <= 360; i++) { const b = -180 + i; c.push([b, smTorque(st, b * Math.PI / 180, Ui)]); }
    const Mz = R.Mz[idx], tr = R.t.map((_, i) => [R.bw[i], R.Me[i]]);
    for (let i = 1; i < tr.length; i++) if (Math.abs(tr[i][0] - tr[i - 1][0]) > 180) tr[i - 1] = [NaN, NaN];
    const [yl, yh] = rngOf([c.map(p => p[1]), [Mz]], 0.1);
    return { xl: 'β [°]', yl: 'M [p.j.]', xr: [-180, 180], yr: [yl, yh], series: [{ pts: c, c: 'r', w: 2 }, { pts: [[-180, Mz], [180, Mz]], c: 'b', dash: 1, w: 2 }, { pts: tr, c: 'k', w: 1.2 }],
      dots: [{ x: R.bw[idx], y: R.Me[idx], c: 'r', r: 6 }], leg: [['r', 'M(β)'], ['b', 'zátěž'], ['k', 'trajektorie']] };
  },
  tiles(st, R) {
    const e0 = smEquil(st, st.Ui, st.Mz0), e1 = smEquil(st, st.Ui, st.Mz1), slip = amax(R.b) > 200, ne = lastOf(R.n);
    const out = [['Moment zvratu (statický)', fmt(e1.mmax, 2) + ' p.j.', 'při β = ' + fmt(e1.bmax * 180 / Math.PI, 1) + '°']];
    if (st.mode === 'step') out.push(['Úhel před / po skoku', fmt(e0.b * 180 / Math.PI, 1) + '° / ' + (isFinite(e1.b) ? fmt(e1.b * 180 / Math.PI, 1) + '°' : '–'), 'ustálené body'], ['Největší výkyv', slip ? 'proklouzl' : fmt(amaxS(R.b), 1) + '°', slip ? 'ztráta synchronizmu' : 'stabilní']);
    else out.push(['Rychlost na konci', fmt(ne, 4) + ' p.j.', Math.abs(1 - ne) < 1e-3 ? 'synchronní chod' : 'asynchronní chod, s = ' + fmt(1 - ne, 3)]);
    out.push(['Reluktanční moment', fmt(st.U * st.U / 2 * (1 / st.Xq - 1 / st.Xd), 2) + ' p.j.', 'amplituda členu sin 2β']);
    return out;
  },
  theory(st) {
    return `<h2>Co simulace počítá</h2><div class="cols"><div><p>Elektromechanický model v poměrných jednotkách (R<sub>s</sub> = 0, elektrické přechodné děje zanedbány): T<sub>N</sub> dν/dt = M(β) + M<sub>D</sub>(s) − M<sub>z</sub>, dβ/dt = ω<sub>1</sub>(1 − ν), s = 1 − ν. M(β) je vztah ze skript, asynchronní moment klece M<sub>D</sub> má tvar Klossova vztahu. Výchozí hodnoty jsou příklad dynamické stability ze skript (U = 1, U<sub>v</sub> = 1,1, X′<sub>d</sub> = 0,2, X<sub>q</sub> = 2).</p>
<p class="warn">Rozpor se skripty: pro tyto hodnoty a skok 0 → M<sub>N</sub> uvádějí skripta největší výkyv 55,3°. Přímý výpočet rovnosti ploch ∫<sub>0</sub><sup>β<sub>m</sub></sup>(M(β) − 1)dβ = 0 i simulace dávají 59,5°; nový ustálený úhel 34,2° a mez asi 3,7 M<sub>N</sub> souhlasí.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">${expI('sm:eq', 'Skok zátěže 0 → M<sub>N</sub>: β kmitá kolem 34,2° mezi 0° a největším výkyvem. V rovině M–β uvidíte, kde se plochy vyrovnají.')}
${expI('sm:un', 'Skok na 3,8 M<sub>N</sub>: β přeběhne za bod, kde M(β) klesne pod zátěž, a stroj proklouzne o pól.')}
${expI('sm:damp', 'Tlumič přidá asynchronní moment úměrný skluzu: kmity se utlumí.')}</ol></div>
<div><ol class="exp" start="4">${expI('sm:start', 'Asynchronní rozběh: klec rozběhne stroj téměř na synchronní rychlost, moment pulzuje skluzovou frekvencí; po nabuzení se vtáhne do synchronizmu.')}
${expI('sm:rel', 'Bez buzení a s malou zátěží (M<sub>z</sub> &lt; M<sub>rel</sub>) vtáhne stroj do synchronizmu sám reluktanční moment.')}
${expI('sm:rel2', 'Se zátěží větší než reluktanční moment zůstane stroj bez buzení v asynchronním chodu.')}</ol></div></div>`;
  }
};

/* ======================= Kap. 11: speciální ======================= */
const SPEC_PM = { pm_R: 0.5, pm_L: 5, pm_psim: 0.2, pm_pp: 4, pm_J: 0.002, pm_B: 0, pm_Udc: 300, pm_tmu: 0.05, pm_Imax: 20, pm_fw: 0, pm_Kpu: 0.05, pm_Tiu: 2, pm_Tfw: 1, pm_t1: 0.01, pm_t2: 0.2, pm_n1: 2000, pm_n2: -2000, pm_ramp: 0, pm_tz1: 0.1, pm_tz2: 99, pm_Mz: 3, pm_load: 'react', pm_tEnd: 0.35 };
MODS.spec = {
  label: 'Speciální motory', chap: '11', ch: [11], tpl: 'tpl-spec',
  def: Object.assign({ mode: 'pm' }, SPEC_PM,
    { st_U: 24, st_Rw: 2, st_L: 5, st_Km: 0.3, st_I: 1.5, st_Nr: 50, st_J: 50, st_Bv: 200, st_Mt: 0.05, st_seq: 'full', st_f0: 100, st_f1: 100, st_tr: 0, st_t1: 0.005, st_tstop: 0, st_tEnd: 0.3 },
    { sr_U: 300, sr_Rs: 0.5, sr_Lmin: 8, sr_Lmax: 60, sr_n: 1000, sr_ctl: 'volt', sr_aon: 0, sr_aoff: 30, sr_Iref: 40, sr_h: 1 }),
  autotune: st => { const t = pmTune(pick(st, 'pm_')); return { pm_Kpc: t.Kpc, pm_Tic: t.Tic, pm_Kpw: t.Kpw, pm_Tiw: t.Tiw }; },
  fields: [
    { g: 'Motor', rows: [{ id: 'mode', type: 'sel', opts: [['pm', 'Servomotor s permanentními magnety (sinusový PMSM)'], ['step', 'Krokový motor (dvoufázový, aktivní rotor)'], ['srm', 'Spínaný reluktanční motor 6/4']] }] },
    { g: 'Scénář', m: 'pm', rows: [{ id: 'pm_tEnd', l: 'Doba simulace', u: 's' }, { id: 'pm_t1', l: 'Čas t_1', u: 's' }, { id: 'pm_n1', l: 'Žádaná rychlost od t_1', u: 'ot/min' }, { id: 'pm_t2', l: 'Čas t_2', u: 's' }, { id: 'pm_n2', l: 'Žádaná rychlost od t_2', u: 'ot/min' },
      { id: 'pm_ramp', l: 'Rampa', u: 'ot/min/s' }, { id: 'pm_load', type: 'sel', opts: LOADS }, { id: 'pm_Mz', l: 'Zátěžný moment', u: 'N·m' }, { id: 'pm_tz1', l: 'Zátěž zapnout', u: 's' }, { id: 'pm_tz2', l: 'Zátěž vypnout', u: 's' }] },
    { g: 'Měnič a odbuzování', m: 'pm', rows: [{ id: 'pm_Udc', l: 'Napětí meziobvodu U_d', u: 'V' }, { id: 'pm_tmu', l: 'Zpoždění střídače τ_μ', u: 'ms' }, { id: 'pm_Imax', l: 'Omezení |i_s|', u: 'A' },
      { id: 'pm_fw', type: 'chk', l: 'Nepřímé odbuzování (regulátor napětí → i_d* < 0)' }, { id: 'pm_Kpu', l: 'Regulátor napětí K_P', u: 'A/V' }, { id: 'pm_Tiu', l: 'Regulátor napětí T_I', u: 'ms' }] },
    { g: 'Regulátory proudu a rychlosti', m: 'pm', tunes: [['PM', 'OM + SO']], rows: [{ id: 'pm_Kpc', l: 'Proud: K_P', u: 'V/A' }, { id: 'pm_Tic', l: 'Proud: T_I', u: 'ms' }, { id: 'pm_Kpw', l: 'Rychlost: K_P', u: 'A·s/rad' }, { id: 'pm_Tiw', l: 'Rychlost: T_I', u: 'ms' }, { id: 'pm_Tfw', l: 'Filtr měření rychlosti', u: 'ms' }] },
    { g: 'Parametry PMSM', m: 'pm', rows: [{ id: 'pm_R', l: 'Odpor fáze R_s', u: 'Ω' }, { id: 'pm_L', l: 'Indukčnost L_s = L_d = L_q', u: 'mH' }, { id: 'pm_psim', l: 'Tok magnetů ψ_m', u: 'Wb' }, { id: 'pm_pp', l: 'Pólové dvojice p_p', u: '–' }, { id: 'pm_J', l: 'Moment setrvačnosti J', u: 'kg·m²' }, { id: 'pm_B', l: 'Viskózní tření', u: 'N·m·s/rad' }] },
    { g: 'Krokování', m: 'step', rows: [{ id: 'st_seq', type: 'sel', opts: [['full', 'čtyřtaktní (plný krok, vždy jedna fáze)'], ['half', 'osmitaktní (polokrok, jedna a obě fáze)']] },
      { id: 'st_f0', l: 'Počáteční frekvence kroků', u: 'kroků/s' }, { id: 'st_f1', l: 'Koncová frekvence kroků', u: 'kroků/s' }, { id: 'st_tr', l: 'Doba rampy', u: 's', h: '0 = hned koncová' },
      { id: 'st_t1', l: 'Začátek krokování', u: 's' }, { id: 'st_tstop', l: 'Zastavit krokování v', u: 's', h: '0 = nezastavovat' }, { id: 'st_tEnd', l: 'Doba simulace', u: 's', h: 'nejvýš 1 s' }] },
    { g: 'Parametry krokového motoru', m: 'step', rows: [{ id: 'st_U', l: 'Napětí H-můstku', u: 'V' }, { id: 'st_I', l: 'Proud fáze (hysterezní regulace)', u: 'A' }, { id: 'st_Rw', l: 'Odpor fáze', u: 'Ω' }, { id: 'st_L', l: 'Indukčnost fáze', u: 'mH' },
      { id: 'st_Km', l: 'Momentová konstanta K_m', u: 'N·m/A' }, { id: 'st_Nr', l: 'Počet zubů rotoru N_r', u: '–', h: '50 → krok 1,8°' }, { id: 'st_J', l: 'Moment setrvačnosti', u: '×10⁻⁶ kg·m²' }, { id: 'st_Bv', l: 'Tlumení', u: '×10⁻⁶ N·m·s/rad' }, { id: 'st_Mt', l: 'Třecí zátěž', u: 'N·m' }] },
    { g: 'Řízení SRM', m: 'srm', rows: [{ id: 'sr_ctl', type: 'sel', opts: [['volt', 'napěťové (+U v úhlu zapnutí až vypnutí)'], ['cur', 'proudové (hysterezně I* do 45°)']] }, { id: 'sr_n', l: 'Otáčky (konstantní)', u: 'ot/min' },
      { id: 'sr_aon', l: 'Úhel zapnutí', u: '°' }, { id: 'sr_aoff', l: 'Úhel vypnutí', u: '°', w: 'sr_ctl:volt' }, { id: 'sr_Iref', l: 'Žádaný proud I*', u: 'A', w: 'sr_ctl:cur' }, { id: 'sr_h', l: 'Hystereze', u: 'A', w: 'sr_ctl:cur' }] },
    { g: 'Parametry SRM', m: 'srm', rows: [{ id: 'sr_U', l: 'Napětí zdroje', u: 'V' }, { id: 'sr_Rs', l: 'Odpor fáze', u: 'Ω' }, { id: 'sr_Lmin', l: 'L_min (póly mimo sebe)', u: 'mH' }, { id: 'sr_Lmax', l: 'L_max (póly proti sobě)', u: 'mH' }] }
  ],
  presets: [
    { id: 'pm', n: 'PMSM: rozběh, zátěž, reverzace', s: {} },
    { id: 'pmfw', n: 'PMSM: odbuzování na 3500 ot/min', s: { pm_fw: 1, pm_n1: 3500, pm_ramp: 30000, pm_t2: 99, pm_Mz: 1, pm_tEnd: 0.4 } },
    { id: 'pmnofw', n: 'PMSM bez odbuzování: napětí nestačí', s: { pm_fw: 0, pm_n1: 3500, pm_ramp: 30000, pm_t2: 99, pm_Mz: 1, pm_tEnd: 0.4 } },
    { id: 'st', n: 'Krokový: 100 kroků/s', s: { mode: 'step' } },
    { id: 'sthalf', n: 'Krokový: polokrok', s: { mode: 'step', st_seq: 'half' } },
    { id: 'stfast', n: 'Krokový: start na 1000 kroků/s', s: { mode: 'step', st_f0: 1000, st_f1: 1000 } },
    { id: 'stramp', n: 'Krokový: rampa do 3000 kroků/s', s: { mode: 'step', st_f0: 100, st_f1: 3000, st_tr: 0.3, st_tEnd: 0.45 } },
    { id: 'srv', n: 'SRM: napěťové řízení', s: { mode: 'srm' } },
    { id: 'src', n: 'SRM: proudové řízení', s: { mode: 'srm', sr_ctl: 'cur' } }
  ],
  tune(kind, st) { Object.assign(st, MODS.spec.autotune(st)); return ''; },
  valid(st) {
    if (st.mode === 'pm') { const p = pick(st, 'pm_'); return ['R', 'L', 'psim', 'pp', 'J', 'Udc', 'Imax', 'tEnd'].filter(k => !(p[k] > 0)).length ? 'Parametry PMSM musí být kladné.' : p.tEnd > 2 ? 'Doba simulace nejvýš 2 s.' : ''; }
    if (st.mode === 'step') { const p = pick(st, 'st_'); return ['U', 'Rw', 'L', 'Km', 'I', 'Nr', 'J', 'tEnd'].filter(k => !(p[k] > 0)).length ? 'Parametry krokového motoru musí být kladné.' : p.tEnd > 1 ? 'Doba simulace nejvýš 1 s.' : ''; }
    const p = pick(st, 'sr_'); return ['U', 'Rs', 'Lmin', 'Lmax', 'n'].filter(k => !(p[k] > 0)).length ? 'Parametry SRM musí být kladné.' : p.Lmax <= p.Lmin ? 'L_max musí být větší než L_min.' : '';
  },
  sim(st) {
    if (st.mode === 'pm') return simPM(pick(st, 'pm_'));
    if (st.mode === 'step') return simStep(pick(st, 'st_'));
    return simSRM(pick(st, 'sr_'));
  },
  step: '10 µs (PMSM), 4 µs (krokový)', xuOf: st => st.mode === 'srm' ? '°' : 's',
  plots(st) {
    if (st.mode === 'pm') return [
      { id: 'n', t: 'Rychlost', u: 'ot/min', d: 0, s: [{ k: 'n', l: 'n', c: 'k' }, { k: 'nref', l: 'n*', c: 'r', dash: 1 }] },
      { id: 'M', t: 'Moment', u: 'N·m', d: 2, s: [{ k: 'M', l: 'M = 3/2 p_p ψ_m i_q', c: 'k' }, { k: 'Mz', l: 'M_z', c: 'b' }] },
      { id: 'i', t: 'Proudy v osách rotoru', u: 'A', d: 2, s: [{ k: 'iq', l: 'i_q', c: 'r' }, { k: 'iqr', l: 'i_q*', c: 'r', dash: 1 }, { k: 'id', l: 'i_d', c: 'k' }, { k: 'idr', l: 'i_d*', c: 'k', dash: 1 }] },
      { id: 'u', t: 'Napětí', u: 'V', d: 0, s: [{ k: 'u', l: '|u_s|', c: 'k' }, { k: 'umax', l: 'U_d/√3', c: 'r', dash: 1 }] }];
    if (st.mode === 'step') return [
      { id: 'p', t: 'Poloha', u: '°', d: 1, s: [{ k: 'pos', l: 'skutečná', c: 'k' }, { k: 'cmd', l: 'zadaná (počet kroků)', c: 'r', dash: 1 }] },
      { id: 'i', t: 'Proudy fází', u: 'A', d: 2, s: [{ k: 'iA', l: 'i_A', c: 'k' }, { k: 'iB', l: 'i_B', c: 'r' }] },
      { id: 'M', t: 'Moment', u: 'N·m', d: 3, s: [{ k: 'M', l: 'M', c: 'k' }] },
      { id: 'n', t: 'Rychlost a frekvence kroků', u: 'ot/min', d: 0, s: [{ k: 'n', l: 'n', c: 'k' }] }];
    return [
      { id: 'i', t: 'Proudy fází', u: 'A', d: 1, s: [{ k: 'iA', l: 'i_A', c: 'k' }, { k: 'iB', l: 'i_B', c: 'r' }, { k: 'iC', l: 'i_C', c: 'b' }] },
      { id: 'L', t: 'Indukčnost fáze A', u: 'mH', d: 1, s: [{ k: 'LA', l: 'L_A(φ)', c: 'k' }] },
      { id: 'u', t: 'Napětí fáze A', u: 'V', d: 0, s: [{ k: 'uA', l: 'u_A', c: 'k' }] },
      { id: 'M', t: 'Moment', u: 'N·m', d: 1, s: [{ k: 'M', l: 'celkový', c: 'k' }, { k: 'MA', l: 'fáze A', c: 'o' }] }];
  },
  xyTitle: 'Pomocná rovina', xyNote: '',
  xy(st, R, idx) {
    if (st.mode === 'pm') {
      const p = pick(st, 'pm_'), L = p.L / 1e3, w = Math.max(p.pp * toRad(Math.abs(R.n[idx])), 1), r = R.Umax / (w * L), cx = -p.psim / L;
      const circ = (x0, y0, rr) => { const a = []; for (let i = 0; i <= 180; i++) { const t = i / 180 * TAU; a.push([x0 + rr * Math.cos(t), y0 + rr * Math.sin(t)]); } return a; };
      const lim = p.Imax * 1.3;
      return { xl: 'i_d [A]', yl: 'i_q [A]', xr: [-lim, lim * 0.6], yr: [-lim, lim], series: [{ pts: circ(0, 0, p.Imax), c: 'b', w: 2 }, { pts: circ(cx, 0, r), c: 'r', w: 2 }, { pts: R.t.map((_, i) => [R.id[i], R.iq[i]]), c: 'k', w: 1.2 }],
        dots: [{ x: R.id[idx], y: R.iq[idx], c: 'r', r: 6 }], leg: [['b', 'proudová mez |i_s| ≤ I_max'], ['r', 'napěťová mez pro okamžitou rychlost (střed −ψ_m/L_s)'], ['k', 'trajektorie i_s']], title: 'Rovina proudu (i_d, i_q)', note: 'Pracovní bod musí ležet uvnitř obou kružnic. S rychlostí se napěťová kružnice zmenšuje; odbuzování posune proud do záporné i_d.' };
    }
    if (st.mode === 'step') {
      const p = pick(st, 'st_'), c = [], d = (R.pos[idx] - R.cmd[idx]) * Math.PI / 180;
      for (let i = 0; i <= 200; i++) { const x = -180 + 360 * i / 200; c.push([x, -p.Km * p.I * Math.sin(x * Math.PI / 180)]); }
      const de = ((p.Nr * d * 180 / Math.PI + 180) % 360 + 360) % 360 - 180;
      return { xl: 'elektrický úhel N_r·Δθ [°]', yl: 'M [N·m]', xr: [-180, 180], series: [{ pts: c, c: 'r', w: 2 }, { pts: [[-180, p.Mt], [180, p.Mt]], c: 'b', dash: 1, w: 1.5 }, { pts: [[-180, -p.Mt], [180, -p.Mt]], c: 'b', dash: 1, w: 1.5 }],
        dots: [{ x: de, y: -p.Km * p.I * Math.sin(de * Math.PI / 180), c: 'r', r: 6 }], leg: [['r', 'statický moment −K_m I sin(N_r Δθ)'], ['b', '± tření', 1]], title: 'Statická momentová charakteristika', note: 'Stabilní poloha je v 0°, největší moment při ±90° el. (u plného kroku právě jeden krok). Když zpoždění rotoru překročí 180° el., moment převrátí smysl a rotor přeskočí do jiné polohy: ztratí kroky.' };
    }
    const p = pick(st, 'sr_'), loop = R.t.map((_, i) => [R.iA[i], R.iA[i] * R.LA[i] / 1e3]);
    return { xl: 'i_A [A]', yl: 'ψ_A [Wb]', series: [{ pts: loop, c: 'k', w: 1.6 }], dots: [{ x: R.iA[idx], y: R.iA[idx] * R.LA[idx] / 1e3, c: 'r', r: 6 }], leg: [['k', 'trajektorie ψ(i) za jeden zdvih']], title: 'Energetická smyčka ψ–i', note: 'Plocha smyčky je mechanická práce jednoho zdvihu fáze: W = ∮ i dψ.' };
  },
  tiles(st, R) {
    if (st.mode === 'pm') { const p = pick(st, 'pm_'), wb = R.Umax / (p.pp * p.psim); return [['Největší |i_q|', fmt(amax(R.iq), 1) + ' A', ''], ['Nejzápornější i_d', fmt(aminS(R.id), 1) + ' A', p.fw ? 'odbuzování' : 'i_d = 0'], ['Rychlost na konci', fmt(lastOf(R.n), 0) + ' ot/min', ''], ['Základní rychlost (naprázdno)', fmt(toRpm(wb), 0) + ' ot/min', 'U_d/(√3 p_p ψ_m)'], ['Max. moment', fmt(1.5 * p.pp * p.psim * p.Imax, 2) + ' N·m', '3/2 p_p ψ_m I_max']]; }
    if (st.mode === 'step') { const p = pick(st, 'st_'), per = 360 / p.Nr, diff = lastOf(R.cmd) - lastOf(R.pos), slips = Math.round(diff / per), lost = slips * Math.round(per / R.stepDeg), wn = Math.sqrt(p.Km * p.I * p.Nr / (p.J * 1e-6));
      return [['Úhel kroku', fmt(R.stepDeg, 2) + '°', p.seq === 'half' ? 'polokrok' : 'plný krok'], ['Ztracené kroky', fmt(Math.abs(lost), 0), lost ? 'rotor proklouzl o ' + fmt(Math.abs(slips), 0) + ' el. period' : 'zpoždění ' + fmt(diff, 2) + '°'], ['Přídržný moment', fmt(p.Km * p.I, 3) + ' N·m', 'K_m·I'], ['Vlastní frekvence', fmt(wn / TAU, 0) + ' Hz', '√(K_m I N_r/J)/(2π)'], ['τ = L/R', fmt(p.L / p.Rw, 2) + ' ms', 'náběh proudu']]; }
    return [['Střední moment', fmt(R.Mavg, 2) + ' N·m', ''], ['Zvlnění momentu', fmt(R.Mmin, 1) + ' až ' + fmt(R.Mmax, 1) + ' N·m', 'max/střední = ' + fmt(R.Mmax / R.Mavg, 1)], ['Energy Ratio', fmt(R.ER, 2), 'skripta: napěťové ≈ 0,9, proudové ≈ 0,2'], ['Největší proud', fmt(amax(R.iA), 1) + ' A', '']];
  },
  theory(st) {
    return `<h2>Co simulace počítá</h2><div class="cols"><div><p><b>PMSM</b> v osách rotoru (L<sub>d</sub> = L<sub>q</sub>), proudové PI s odvazbením, rychlost podle SO, omezení napětí U<sub>d</sub>/√3 a proudu; při odbuzování regulátor napětí zadává záporné i<sub>d</sub>*. <b>Krokový motor</b>: dvě fáze s H-můstky a hysterezní regulací proudu, moment M = K<sub>m</sub>(−i<sub>A</sub> sin N<sub>r</sub>θ + i<sub>B</sub> cos N<sub>r</sub>θ). <b>SRM 6/4</b> při konstantních otáčkách s idealizovaným průběhem L(φ) ze skript; vodorovná osa je úhel natočení rotoru.</p></div>
<div><h3>Co vyzkoušet</h3><ol class="exp">${expI('spec:pmfw', 'PMSM s odbuzováním: nad základní rychlostí se proud přesune do záporné i<sub>d</sub>, napětí zůstane na mezi.')}
${expI('spec:pmnofw', 'Bez odbuzování: indukované napětí dosáhne meze a rychlost se zastaví kolem 2000 ot/min.')}
${expI('spec:st', 'Krokový motor 100 kroků/s: rotor po každém kroku tlumeně dokmitá.')}</ol></div>
<div><ol class="exp" start="4">${expI('spec:stfast', 'Start rovnou na 1000 kroků/s: rotor nestačí a stojí (ztráta kroků). Rampa to vyřeší.')}
${expI('spec:stramp', 'Rampa do 3000 kroků/s: proud při vysoké frekvenci nestačí narůst, moment klesá. Zvyšte třecí zátěž.')}
${expI('spec:srv', 'SRM napěťově: velké špičky momentu jen v 15–45°, ER vysoký. Pak proudové řízení: moment téměř konstantní.')}</ol></div></div>`;
  }
};

/* ======================= Opakování ======================= */
MODS.opak = { label: 'Opakování ZPO', chap: 'kartičky ze skript', ch: [] };
MODS.stroje = { label: 'Elektrické stroje', chap: 'Voženílek: opakování', ch: [] };
MODS.vzt = { label: 'Důležité vztahy', chap: 'přehled vzorců', tpl: 'tpl-vzt', ch: [] };
MODS.lab = { label: 'Laboratoř', chap: 'rozběh motoru', ch: [] };
MODS.faz = { label: 'Fázorové diagramy', chap: 'interaktivně', ch: [] };
MODS.pole = { label: 'Točivé pole', chap: 'interaktivně', ch: [] };
MODS.zk = { label: 'Zkoušení', chap: 'všetečné otázky', ch: [] };
const TAB_ORDER = ['uvod', 'vzt', 'mech', 'tep', 'reg', 'dc', 'ser', 'am', 'sm', 'spec', 'lab', 'pole', 'faz', 'opak', 'zk', 'stroje'];
