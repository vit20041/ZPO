/* ===== Záložka Transformace a řízení: Laplace, analogové a diskrétní řízení, (dq v trf.js) ===== */
let TRV = 'lap';
/* ---------- polynomy (koeficienty vzestupně) a komplexní kořeny ---------- */
const pTrim = p => { const q = p.slice(); while (q.length > 1 && Math.abs(q[q.length - 1]) < 1e-14) q.pop(); return q; };
const pAdd = (a, b) => pTrim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (b[i] || 0)));
const pMul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return pTrim(r); };
const pScale = (a, k) => a.map(x => x * k);
const pPow = (a, n) => { let r = [1]; for (let i = 0; i < n; i++) r = pMul(r, a); return r; };
const pEvalC = (p, z) => { let r = Cx(0, 0); for (let i = p.length - 1; i >= 0; i--) r = cadd(cmul(r, z), Cx(p[i], 0)); return r; };
function pRoots(p) {
  p = pTrim(p); const n = p.length - 1; if (n < 1) return [];
  const a = p.map(x => x / p[n]); let z = Array.from({ length: n }, (_, k) => cpol(0.4 + 0.9 * Math.max(1, Math.abs(a[0]) ** (1 / n)), 2 * Math.PI * k / n + 0.4));
  for (let it = 0; it < 500; it++) {
    let mx = 0;
    z = z.map((zi, i) => { let den = Cx(1, 0); z.forEach((zj, j) => { if (i !== j) den = cmul(den, csub(zi, zj)); }); const d = cdiv(pEvalC(a, zi), cabs(den) < 1e-300 ? Cx(1e-12, 0) : den); mx = Math.max(mx, cabs(d)); return csub(zi, d); });
    if (mx < 1e-13) break;
  }
  return z.map(r => Cx(r.re, Math.abs(r.im) < 1e-7 * Math.max(1, cabs(r)) ? 0 : r.im)).sort((x, y) => y.re - x.re || y.im - x.im);
}
/* ---------- jednoduchý parser výrazů v s ---------- */
function parseS(str) {
  const src = str.replace(/\s+/g, '').replace(/,/g, '.').replace(/·|×/g, '*'); let i = 0;
  const peek = () => src[i], err = m => { throw new Error(m); };
  const num = () => { const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(src.slice(i)); if (!m) err('čekám číslo'); i += m[0].length; return +m[0]; };
  const prim = () => { const c = peek(); if (c === '(') { i++; const v = expr(); if (peek() !== ')') err('chybí )'); i++; return v; } if (c === 's') { i++; return [0, 1]; } if (/[\d.]/.test(c || '')) return [num()]; err('neočekávaný znak „' + (c || 'konec') + '“'); };
  const pw = () => { let b = prim(); if (peek() === '^') { i++; const e = num(); if (e !== Math.round(e) || e < 0 || e > 12) err('mocnina musí být celé číslo 0–12'); b = pPow(b, e); } return b; };
  const un = () => { if (peek() === '-') { i++; return pScale(un(), -1); } if (peek() === '+') { i++; return un(); } return pw(); };
  const term = () => { let v = un(); for (;;) { const c = peek(); if (c === '*') { i++; v = pMul(v, un()); } else if (c === '/') { i++; const d = un(); if (d.length !== 1) err('dělit lze jen číslem'); v = pScale(v, 1 / d[0]); } else if (c === '(' || c === 's' || /[\d.]/.test(c || '')) v = pMul(v, un()); else return v; } };
  const expr = () => { let v = term(); while (peek() === '+' || peek() === '-') { const c = src[i++]; const t = term(); v = pAdd(v, c === '+' ? t : pScale(t, -1)); } return v; };
  if (!src) err('prázdný výraz'); const r = expr(); if (i < src.length) err('nadbytečný znak „' + src[i] + '“'); return pTrim(r);
}
/* ---------- Laplace: rozklad na parciální zlomky ---------- */
function pShiftC(p, z) {   /* Taylorovy koeficienty polynomu kolem z (komplexně) */
  let c = p.map(x => Cx(x, 0)); const out = [];
  for (let k = 0; k < p.length; k++) { let r = Cx(0, 0); const q = new Array(c.length).fill(Cx(0, 0)); for (let i = c.length - 1; i >= 0; i--) { r = cadd(cmul(r, z), c[i]); q[i] = r; } out.push(q[0]); c = q.slice(1); if (!c.length) break; }
  return out;
}
function cpolyMul(a, b) { const r = new Array(a.length + b.length - 1).fill(0).map(() => Cx(0, 0)); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = cadd(r[i + j], cmul(x, y)); })); return r; }
function cpShift(cp, z) { /* Taylor komplexního polynomu */ let c = cp.slice(); const out = []; while (c.length) { let r = Cx(0, 0); const q = []; for (let i = c.length - 1; i >= 0; i--) { r = cadd(cmul(r, z), c[i]); q[i] = r; } out.push(q[0]); c = q.slice(1); } return out; }
function lapDecomp(N, D) {
  N = pTrim(N); D = pTrim(D); if (D.length < 2) throw new Error('jmenovatel musí obsahovat s');
  let K0 = 0;
  if (N.length >= D.length) { if (N.length > D.length) throw new Error('stupeň čitatele je větší než jmenovatele – obraz není ryze lomený (v originále by byly derivace δ)'); K0 = N[N.length - 1] / D[D.length - 1]; N = pTrim(pAdd(N, pScale(D, -K0))); if (N.length >= D.length) N = N.slice(0, D.length - 1); }
  const rs = pRoots(D), lead = D[D.length - 1], tol = 1e-4, grp = [];
  for (const r of rs) { const g = grp.find(g => cabs(csub(g.p, r)) < tol * Math.max(1, cabs(r))); if (g) { g.m++; g.sum = cadd(g.sum, r); } else grp.push({ p: r, m: 1, sum: r }); }
  grp.forEach(g => { g.p = csc(g.sum, 1 / g.m); if (Math.abs(g.p.im) < 1e-7) g.p.im = 0; });
  const terms = [];
  for (const g of grp) {
    let Dr = [Cx(lead, 0)]; for (const h of grp) if (h !== g) for (let k = 0; k < h.m; k++) Dr = cpolyMul(Dr, [csc(h.p, -1), Cx(1, 0)]);
    const nT = pShiftC(N.length ? N : [0], g.p), dT = cpShift(Dr, g.p), c = [];
    for (let j = 0; j < g.m; j++) { let s = nT[j] || Cx(0, 0); for (let k = 1; k <= j; k++) s = csub(s, cmul(dT[k] || Cx(0, 0), c[j - k])); c.push(cdiv(s, dT[0])); }
    for (let j = 0; j < g.m; j++) terms.push({ p: g.p, k: g.m - j, c: c[j] });
  }
  return { K0, terms, grp, rs };
}
function lapTime(dec, t) {
  let v = 0; for (const T of dec.terms) { const f = t ** (T.k - 1) / fact(T.k - 1), e = cmul(T.c, cpol(Math.exp(T.p.re * t), T.p.im * t)); v += f * e.re; } return v;
}
const fact = n => n <= 1 ? 1 : n * fact(n - 1);
const nf = (x, d = 4) => { const v = +x.toPrecision(d); return Math.abs(v) < 1e-10 ? '0' : String(v).replace('.', ','); };
const cTex = z => Math.abs(z.im) < 1e-9 ? nf(z.re) : `(${nf(z.re)} ${z.im < 0 ? '-' : '+'} ${nf(Math.abs(z.im))}j)`;
function lapTex(dec) {
  const parts = [], seen = new Set();
  const tk = k => k === 1 ? '' : k === 2 ? 't\\,' : `\\tfrac{t^{${k - 1}}}{${k - 1}!}\\,`;
  for (const T of dec.terms) {
    const key = nf(T.p.re) + '|' + nf(Math.abs(T.p.im)) + '|' + T.k; if (T.p.im < 0 && seen.has(key)) continue; seen.add(key);
    if (cabs(T.c) < 1e-9) continue;
    if (Math.abs(T.p.im) < 1e-9) { const e = Math.abs(T.p.re) < 1e-12 ? '' : `e^{${nf(T.p.re)}t}`, f = tk(T.k) + e; parts.push(f && Math.abs(Math.abs(T.c.re) - 1) < 1e-9 ? (T.c.re < 0 ? '-' : '') + f : `${nf(T.c.re)}${f ? '\\,' + f : ''}`); }
    else { const s = T.p.re, w = Math.abs(T.p.im), A = 2 * T.c.re, B = -2 * T.c.im * Math.sign(T.p.im); const e = Math.abs(s) < 1e-12 ? '' : `e^{${nf(s)}t}`;
      parts.push(`${tk(T.k)}${e}\\left(${nf(A)}\\cos ${nf(w)}t ${B < 0 ? '-' : '+'} ${nf(Math.abs(B))}\\sin ${nf(w)}t\\right)`); }
  }
  return ((dec.K0 ? nf(dec.K0) + '\\,\\delta(t) + ' : '') + (parts.join(' + ') || '0')).replace(/\+ -/g, '- ').replace(/\{-1t\}/g, '{-t}').replace(/\{1t\}/g, '{t}').replace(/\\,\s*$/, '');
}
function spTex(p, k) {
  const b = Math.abs(p.im) < 1e-9 ? (Math.abs(p.re) < 1e-12 ? 's' : p.re < 0 ? `s + ${nf(-p.re)}` : `s - ${nf(p.re)}`) : `s - ${cTex(p)}`;
  return k > 1 ? (b === 's' ? `s^{${k}}` : `(${b})^{${k}}`) : b;
}
function polyTex(p) {
  const t = []; for (let i = p.length - 1; i >= 0; i--) { const c = p[i]; if (Math.abs(c) < 1e-14) continue; const a = Math.abs(c), cs = (a === 1 && i) ? '' : nf(a); t.push((c < 0 ? '- ' : t.length ? '+ ' : '') + cs + (i ? 's' + (i > 1 ? `^{${i}}` : '') : '')); }
  return t.join(' ') || '0';
}
const LAP = { N: '2s+3', D: 's(s+1)(s+3)', T: 6 };
const LAP_PRE = [['2s+3', 's(s+1)(s+3)', 'reálné jednoduché póly'], ['1', 's(0.5s+1)', 'skok na 1. řád (T = 0,5 s)'], ['4', 's(s^2+2s+4)', 'skok na 2. řád, kmitavý'], ['1', '(s+1)^2', 'dvojnásobný pól'], ['5', 's^2+25', 'netlumené kmity'], ['1', 's^2', 'rampa'], ['s+2', 's+1', 'čitatel stejného stupně (δ)'], ['10', 's(s-1)', 'nestabilní pól (koncová hodnota neplatí)']];
function lapCalcHTML() {
  let dec, N, D, err = '';
  try { N = parseS(LAP.N); D = parseS(LAP.D); dec = lapDecomp(N, D); } catch (e) { err = e.message; }
  if (err) return `<p class="dgn" style="color:var(--red)">Chyba: ${err}</p>`;
  const rows = [];
  rows.push(`<li><b>Zadání.</b> \\( F(s) = \\dfrac{${polyTex(N)}}{${polyTex(D)}} \\)</li>`);
  if (dec.K0) rows.push(`<li><b>Čitatel má stejný stupeň</b>, nejdřív se vydělí: \\( F(s) = ${nf(dec.K0)} + \\dots \\), konstanta dá \\( ${nf(dec.K0)}\\,\\delta(t) \\).</li>`);
  rows.push(`<li><b>Póly</b> (kořeny jmenovatele): ${dec.grp.map(g => `\\( s = ${cTex(g.p)} \\)${g.m > 1 ? ` (násobnost ${g.m})` : ''}`).join(', ')}</li>`);
  rows.push(`<li><b>Rozklad na parciální zlomky:</b> \\( F(s) = ${dec.K0 ? nf(dec.K0) + ' + ' : ''}${dec.terms.map(T => `\\dfrac{${cTex(T.c)}}{${spTex(T.p, T.k)}}`).join(' + ').replace(/\+ -/g, '- ')} \\)<br><span class="note">Koeficient u jednoduchého pólu: \\( c = \\lim_{s\\to p}(s-p)F(s) \\) (zakrývací metoda); u násobného pólu derivace.</span></li>`);
  rows.push(`<li><b>Zpětná transformace člen po členu</b> podle slovníku: \\( \\dfrac{1}{s-p} \\to e^{pt},\\; \\dfrac{1}{(s-p)^k} \\to \\dfrac{t^{k-1}}{(k-1)!}e^{pt} \\); dvojice komplexně sdružených pólů dá tlumený sinus a kosinus.</li>`);
  rows.push(`<li><b>Výsledek:</b> \\( f(t) = ${lapTex(dec)} \\quad (t \\ge 0) \\)</li>`);
  const stab = dec.grp.every(g => g.p.re < -1e-9 || (cabs(g.p) < 1e-9 && g.m === 1)), hasZero = dec.grp.some(g => cabs(g.p) < 1e-9);
  const fin = stab ? (hasZero ? (() => { const g = dec.terms.find(T => cabs(T.p) < 1e-9 && T.k === 1); return g ? g.c.re : 0; })() : 0) : NaN;
  const f0 = N.length === D.length - 1 ? N[N.length - 1] / D[D.length - 1] : (N.length < D.length - 1 ? 0 : NaN);
  rows.push(`<li><b>Kontrola větami o mezních hodnotách:</b> \\( f(0^+) = \\lim_{s\\to\\infty} sF(s) = ${isFinite(f0) ? nf(f0) : '\\infty'} \\); ${stab ? `\\( f(\\infty) = \\lim_{s\\to 0} sF(s) = ${nf(fin)} \\)` : 'koncovou hodnotu <b>nelze</b> větou určit: \\( sF(s) \\) má pól v pravé polorovině nebo na imaginární ose (mimo počátek), \\( f(t) \\) nemá limitu.'}</li>`);
  const tEnd = LAP.T, pts = []; for (let k = 0; k <= 300; k++) { const t = tEnd * k / 300; pts.push([t, lapTime(dec, t)]); }
  const ys = pts.map(p => p[1]).filter(isFinite), lo = Math.min(0, ...ys), hi = Math.max(0.1, ...ys), pad = (hi - lo) * 0.08 || 1;
  const plot = miniPlot({ xr: [0, tEnd], yr: [lo - pad, hi + pad], xl: 't [s]', yl: 'f(t)', curves: [{ pts, c: 'mc1' }], hl: stab && isFinite(fin) ? [{ y: fin, c: 'mdl', t: 'f(∞)' }] : [], al: 'Originál f(t)' });
  return `<ol class="lsteps2">${rows.join('')}</ol><div class="lapplot">${plot}</div>`;
}
const LAP_THEORY = `
<div class="arts"><div class="art"><h4>Definice a k čemu to je</h4>
<p>\\[ F(s) = \\mathcal{L}\\{f(t)\\} = \\int_0^\\infty f(t)\\,e^{-st}\\,dt,\\qquad s = \\sigma + j\\omega \\]</p>
<p>Převede lineární diferenciální rovnici s konstantními koeficienty na <b>algebraickou</b> rovnici v s. Derivace se změní v násobení s, integrál v dělení s. Počáteční podmínky se objeví samy.</p>
<p><b>Přenos</b> \\( G(s) = Y(s)/U(s) \\) při nulových počátečních podmínkách. Kořeny jmenovatele jsou <b>póly</b> (určují tvar a stabilitu odezvy), kořeny čitatele <b>nuly</b>.</p></div>
<div class="art"><h4>Slovník (nejčastější obrazy)</h4><table class="vz"><tbody>
<tr><td>\\( \\delta(t) \\)</td><td>\\( 1 \\)</td></tr><tr><td>\\( \\mathbf{1}(t) \\)</td><td>\\( \\dfrac1s \\)</td></tr><tr><td>\\( t \\)</td><td>\\( \\dfrac1{s^2} \\)</td></tr><tr><td>\\( \\dfrac{t^n}{n!} \\)</td><td>\\( \\dfrac1{s^{n+1}} \\)</td></tr>
<tr><td>\\( e^{-at} \\)</td><td>\\( \\dfrac1{s+a} \\)</td></tr><tr><td>\\( t\\,e^{-at} \\)</td><td>\\( \\dfrac1{(s+a)^2} \\)</td></tr><tr><td>\\( 1-e^{-t/T} \\)</td><td>\\( \\dfrac1{s(Ts+1)} \\)</td></tr>
<tr><td>\\( \\sin\\omega t \\)</td><td>\\( \\dfrac{\\omega}{s^2+\\omega^2} \\)</td></tr><tr><td>\\( \\cos\\omega t \\)</td><td>\\( \\dfrac{s}{s^2+\\omega^2} \\)</td></tr>
<tr><td>\\( e^{-at}\\sin\\omega t \\)</td><td>\\( \\dfrac{\\omega}{(s+a)^2+\\omega^2} \\)</td></tr><tr><td>\\( e^{-at}\\cos\\omega t \\)</td><td>\\( \\dfrac{s+a}{(s+a)^2+\\omega^2} \\)</td></tr></tbody></table></div>
<div class="art"><h4>Věty</h4><table class="vz"><tbody>
<tr><td>linearita</td><td>\\( a f + b g \\to aF + bG \\)</td></tr>
<tr><td>derivace</td><td>\\( f' \\to sF(s) - f(0^+) \\)</td></tr><tr><td>2. derivace</td><td>\\( f'' \\to s^2F - s f(0) - f'(0) \\)</td></tr>
<tr><td>integrál</td><td>\\( \\int_0^t f\\,d\\tau \\to \\dfrac{F(s)}{s} \\)</td></tr>
<tr><td>posun v čase (dopravní zpoždění)</td><td>\\( f(t-\\tau)\\mathbf{1}(t-\\tau) \\to e^{-s\\tau}F(s) \\)</td></tr>
<tr><td>posun v obrazu (útlum)</td><td>\\( e^{-at}f(t) \\to F(s+a) \\)</td></tr>
<tr><td>konvoluce</td><td>\\( (f*g)(t) \\to F(s)\\,G(s) \\)</td></tr>
<tr><td>počáteční hodnota</td><td>\\( f(0^+) = \\lim_{s\\to\\infty} sF(s) \\)</td></tr>
<tr><td>koncová hodnota</td><td>\\( f(\\infty) = \\lim_{s\\to 0} sF(s) \\) jen když póly \\( sF(s) \\) leží v levé polorovině</td></tr></tbody></table></div>
<div class="art"><h4>Postup řešení rovnice (příklad: DC motor naprázdno)</h4>
<p>\\( J\\dot\\Omega = c\\Phi\\,i,\\; U = R i + c\\Phi\\,\\Omega \\Rightarrow T_m\\dot\\Omega + \\Omega = U/c\\Phi \\), kde \\( T_m = JR/(c\\Phi)^2 \\).</p>
<p>1) Transformace se skokem U: \\( T_m(s\\Omega - \\Omega_0) + \\Omega = \\dfrac{U}{c\\Phi\\,s} \\).<br>2) Vyjádření: \\( \\Omega(s) = \\dfrac{U/c\\Phi}{s(T_m s+1)} + \\dfrac{T_m\\Omega_0}{T_m s+1} \\).<br>3) Slovník: \\( \\Omega(t) = \\dfrac{U}{c\\Phi}(1-e^{-t/T_m}) + \\Omega_0 e^{-t/T_m} \\).</p></div>
<div class="art"><h4>Póly a odezva</h4><ul class="lt"><li>Reálný záporný pól \\( -a \\): exponenciála s časovou konstantou \\( 1/a \\).</li><li>Komplexní dvojice \\( -\\sigma \\pm j\\omega \\): tlumené kmity, \\( \\omega \\) = kmitočet, \\( \\sigma \\) = rychlost útlumu, poměrné tlumení \\( \\xi = \\sigma/\\sqrt{\\sigma^2+\\omega^2} \\).</li><li>Pól v nule: integrátor (rampa na skok). Pól v pravé polorovině: nestabilita.</li><li>Dominantní jsou póly nejblíž imaginární ose – doznívají nejpomaleji.</li><li>Statické zesílení \\( K = G(0) \\); ustálená odchylka na skok v uzavřené smyčce \\( e_\\infty = 1/(1+K_0) \\), s integrátorem v otevřené smyčce nulová (astatismus).</li></ul></div></div>`;

/* ---------- soustavy a regulátory ---------- */
const CS = { pl: 'o2', K: 2, T1: 1, T2: 0.2, tau: 0.1, reg: 'PI', Kp: 1, Ti: 1, Td: 0.1, N: 10, umax: 0, dist: 0.5, Ts: 0.05, meth: 'tustin', cdel: false };
const PLANTS = {
  o1: { n: '1. řád  K/(T₁s+1)', p: ['K', 'T1'], G: P => [[P.K], [1, P.T1]], tau: 0, info: P => ({ K: P.K, T1: P.T1, Ts: 0, I: false }) },
  o2: { n: '2. řád  K/((T₁s+1)(T₂s+1))', p: ['K', 'T1', 'T2'], G: P => [[P.K], pMul([1, P.T1], [1, P.T2])], tau: 0, info: P => ({ K: P.K, T1: Math.max(P.T1, P.T2), Ts: Math.min(P.T1, P.T2), I: false }) },
  it: { n: 'integrátor  K/(s(T₂s+1))', p: ['K', 'T2'], G: P => [[P.K], [0, 1, P.T2]], tau: 0, info: P => ({ K: P.K, T1: 0, Ts: P.T2, I: true }) },
  dl: { n: '1. řád + zpoždění  K·e^{−τs}/(T₁s+1)', p: ['K', 'T1', 'tau'], G: P => [[P.K], [1, P.T1]], tau: 1, info: P => ({ K: P.K, T1: P.T1, Ts: P.tau, I: false }) },
  dci: { n: 'DC motor: proud kotvy (měnič T_μ = 1,7 ms, R_a = 0,4 Ω, T_a = 25 ms)', p: [], G: () => [[2.5], pMul([1, 0.025], [1, 0.0017])], tau: 0, info: () => ({ K: 2.5, T1: 0.025, Ts: 0.0017, I: false }) },
  dcw: { n: 'DC motor: otáčky (uzavřená proudová smyčka 1/(2T_μs+1), cΦ/J = 4)', p: [], G: () => [[4], [0, 1, 0.0034]], tau: 0, info: () => ({ K: 4, T1: 0, Ts: 0.0034, I: true }) },
};
const PNAME = { K: ['K', 0.2, 10, 0.1, ''], T1: ['T₁', 0.05, 5, 0.05, 's'], T2: ['T₂', 0.01, 2, 0.01, 's'], tau: ['τ', 0, 1, 0.01, 's'] };
function ctlTune(kind) {
  const P = PLANTS[CS.pl], I = P.info(CS);
  if (kind === 'om') { if (I.I) return 'Optimum modulu je pro soustavy bez integrátoru; pro integrační soustavu použijte symetrické optimum.'; CS.reg = 'PI'; CS.Ti = I.T1; CS.Kp = I.T1 / (2 * I.K * I.Ts); return `Optimum modulu: T_i = T₁ = ${nf(CS.Ti)} s (kompenzuje velkou časovou konstantu), K_p = T₁/(2K·T_σ) = ${nf(CS.Kp)}. Očekávaný překmit asi 4 %.`; }
  if (kind === 'so') { if (!I.I) return 'Symetrické optimum je pro soustavy s integrátorem (otáčková smyčka).'; CS.reg = 'PI'; CS.Ti = 4 * I.Ts; CS.Kp = 1 / (2 * I.K * I.Ts); return `Symetrické optimum: T_i = 4T_σ = ${nf(CS.Ti)} s, K_p = 1/(2K·T_σ) = ${nf(CS.Kp)}. Překmit na skok žádané hodnoty asi 43 %, porucha se ale vyreguluje rychle.`; }
}
/* stavový popis soustavy (řídicí kanonický tvar) */
function ssOf(num, den) {
  const n = den.length - 1, a = den.map(x => x / den[n]), b = num.map(x => x / den[n]);
  return { n, f: (x, u) => { const dx = new Array(n); for (let i = 0; i < n - 1; i++) dx[i] = x[i + 1]; let s = u; for (let i = 0; i < n; i++) s -= a[i] * x[i]; dx[n - 1] = s; return dx; }, y: x => { let s = 0; for (let i = 0; i < n; i++) s += (b[i] || 0) * x[i]; return s; } };
}
function ctlSetup() {
  const P = PLANTS[CS.pl], [num, den] = P.G(CS), tau = P.tau ? CS.tau : 0, I = P.info(CS);
  const Tsum = (I.T1 || 0) + I.Ts + tau, tEnd = I.I ? Math.max(30 * I.Ts, 8 * CS.Ti) : Math.max(8 * Tsum, 3 * CS.Ti);
  return { num, den, tau, tEnd, ss: ssOf(num, den), I };
}
/* spojitá simulace: skok w = 1 v t = 0, porucha na vstupu soustavy v polovině */
function ctlSim(S, disc) {
  const ss = S.ss, n = ss.n, tEnd = S.tEnd, dt = Math.min(tEnd / 6000, (disc ? CS.Ts : tEnd) / 20), Tf = CS.Td / CS.N, reg = CS.reg;
  let x = new Array(n).fill(0), I = 0, Dx = 0, t = 0, u = 0, eP = 0, Dk = 0, Ik = 0, uHold = 0, nextS = 0, uNext = 0;
  const buf = [], nb = Math.max(1, Math.round(S.tau / dt)), out = [], dist = () => t >= tEnd * CS.dist ? 0.5 : 0, sat = v => CS.umax > 0 ? clamp(v, -CS.umax, CS.umax) : v;
  const hasI = reg.includes('I'), hasD = reg.includes('D'), every = Math.max(1, Math.floor(tEnd / dt / 600));
  let step = 0;
  while (t <= tEnd) {
    const y = ss.y(x), e = 1 - y;
    if (!disc) {
      const dterm = hasD ? CS.Kp * CS.Td / Tf * (e - Dx) : 0;   /* D = K_p T_d s/(T_f s+1) na e: stav Dx sleduje e */
      const uu = CS.Kp * e + (hasI ? I : 0) + dterm; u = sat(uu);
      if (hasI && (CS.umax <= 0 || u === uu || Math.sign(e) !== Math.sign(uu))) I += dt * CS.Kp / CS.Ti * e;
      if (hasD) Dx += dt * (e - Dx) / Tf;
    } else if (t >= nextS - 1e-12) {
      nextS += CS.Ts;
      /* PSD */
      const T = CS.Ts; let Ii = Ik;
      if (hasI) Ii = CS.meth === 'fe' ? Ik + CS.Kp * T / CS.Ti * eP : CS.meth === 'be' ? Ik + CS.Kp * T / CS.Ti * e : Ik + CS.Kp * T / (2 * CS.Ti) * (e + eP);
      if (hasD) Dk = CS.meth === 'tustin' ? ((2 * Tf - T) * Dk + 2 * CS.Kp * CS.Td * (e - eP)) / (2 * Tf + T) : (Tf * Dk + CS.Kp * CS.Td * (e - eP)) / (Tf + T);
      const uu = CS.Kp * e + (hasI ? Ii : 0) + (hasD ? Dk : 0), us = sat(uu);
      if (!(CS.umax > 0 && us !== uu && Math.sign(e) === Math.sign(uu))) Ik = Ii;
      eP = e; if (CS.cdel) { uHold = uNext; uNext = us; } else uHold = us;
      u = uHold;
    }
    buf.push(u); const ud = buf.length > nb && S.tau > 0 ? buf.shift() : (S.tau > 0 ? 0 : u);
    const uin = (S.tau > 0 ? ud : u) + dist();
    if (step % every === 0) out.push([t, y, u]);
    /* RK4 soustavy */
    const k1 = ss.f(x, uin), k2 = ss.f(x.map((v, i) => v + dt / 2 * k1[i]), uin), k3 = ss.f(x.map((v, i) => v + dt / 2 * k2[i]), uin), k4 = ss.f(x.map((v, i) => v + dt * k3[i]), uin);
    x = x.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    t += dt; step++;
    if (!isFinite(y) || Math.abs(y) > 1e6) break;
  }
  return out;
}
function ctlMetrics(out, tEnd) {
  const half = out.filter(p => p[0] < tEnd * CS.dist), ymax = Math.max(...half.map(p => p[1])), yend = half.length ? half[half.length - 1][1] : NaN;
  let ts = NaN; for (let i = half.length - 1; i >= 0; i--) if (Math.abs(half[i][1] - 1) > 0.02) { ts = half[i][0]; break; }
  return { os: Math.max(0, (ymax - 1) * 100), ts, ess: 1 - yend };
}
/* otevřená smyčka L(jω) a regulátor jako přenos */
function regTF() {
  const Kp = CS.Kp, Ti = CS.Ti, Td = CS.Td, Tf = Td / CS.N, r = CS.reg;
  if (r === 'P') return [[Kp], [1]];
  if (r === 'PI') return [[Kp, Kp * Ti], [0, Ti]];
  if (r === 'PD') return [pScale(pAdd([1, Tf], [0, Td]), Kp), [1, Tf]];
  return [pScale(pAdd(pAdd(pMul([0, Ti], [1, Tf]), [1, Tf]), [0, 0, Ti * Td]), Kp), pMul([0, Ti], [1, Tf])];
}
function ctlBode(S) {
  const [nr, dr] = regTF(), N = pMul(nr, S.num), D = pMul(dr, S.den), pts = [], ph = [];
  const T = [S.I.T1, S.I.Ts, S.tau, CS.Ti].filter(x => x > 0), lo = Math.floor(Math.log10(0.05 / Math.max(...T))), hi = Math.ceil(Math.log10(20 / Math.min(...T)));
  let prev = null, off = 0, wc = NaN, pm = NaN, w180 = NaN, gm = NaN, lastM = null;
  for (let k = 0; k <= 400; k++) {
    const lw = lo + (hi - lo) * k / 400, w = 10 ** lw, L = cdiv(pEvalC(N, Cx(0, w)), pEvalC(D, Cx(0, w))), m = 20 * Math.log10(cabs(L));
    let a = carg(L) / DEG - w * S.tau / DEG; if (prev !== null) { while (a + off - prev > 180) off -= 360; while (a + off - prev < -180) off += 360; } a += off; prev = a;
    pts.push([lw, m]); ph.push([lw, a]);
    if (lastM !== null && lastM.m > 0 && m <= 0 && isNaN(wc)) { wc = w; pm = 180 + a; }
    if (lastM !== null && lastM.a > -180 && a <= -180 && isNaN(w180)) { w180 = w; gm = -m; }
    lastM = { m, a };
  }
  return { pts, ph, lo, hi, wc, pm, w180, gm };
}
/* póly uzavřené smyčky: matice systému sestavená z lineární mapy (zpoždění Padé 1. řádu) */
function charPoly(A) {   /* Faddeev–LeVerrier, vrací koeficienty vzestupně */
  const n = A.length; let M = A.map((r, i) => r.map((_, j) => i === j ? 1 : 0)); const c = new Array(n + 1).fill(0); c[n] = 1;
  let AM = null;
  for (let k = 1; k <= n; k++) { AM = A.map((r, i) => M[0].map((_, j) => r.reduce((s, v, l) => s + v * M[l][j], 0))); const tr = AM.reduce((s, r, i) => s + r[i], 0); c[n - k] = -tr / k; M = AM.map((r, i) => r.map((v, j) => v + (i === j ? c[n - k] : 0))); }
  return c;
}
function eig(A) { return A.length ? pRoots(charPoly(A)) : []; }
function ctlPolesC(S) {
  const ss = S.ss, n = ss.n, hasI = CS.reg.includes('I'), hasD = CS.reg.includes('D'), Tf = CS.Td / CS.N, dl = S.tau > 0;
  const m = n + (hasI ? 1 : 0) + (hasD ? 1 : 0) + (dl ? 1 : 0);
  const F = z => { const x = z.slice(0, n); let j = n; const I = hasI ? z[j++] : 0, Dx = hasD ? z[j++] : 0, pd = dl ? z[j++] : 0; const e = -ss.y(x);
    const u = CS.Kp * e + I + (hasD ? CS.Kp * CS.Td / Tf * (e - Dx) : 0), uin = dl ? pd - u : u, d = ss.f(x, uin);
    if (hasI) d.push(CS.Kp / CS.Ti * e); if (hasD) d.push((e - Dx) / Tf); if (dl) d.push(-(2 / S.tau) * pd + (4 / S.tau) * u); return d; };
  const A = []; for (let i = 0; i < m; i++) { const z = new Array(m).fill(0); z[i] = 1; A.push(F(z)); }
  return eig(A[0] ? A[0].map((_, i) => A.map(c => c[i])) : []);
}
function ctlPolesD(S) {
  const ss = S.ss, n = ss.n, T = CS.Ts, hasI = CS.reg.includes('I'), hasD = CS.reg.includes('D'), Tf = CS.Td / CS.N, nd = Math.min(12, Math.round(S.tau / T)) + (CS.cdel ? 1 : 0);
  /* diskrétní model soustavy s tvarovačem 0. řádu: integrace přes T */
  const integ = (x, u) => { const h = T / 40; for (let k = 0; k < 40; k++) { const k1 = ss.f(x, u), k2 = ss.f(x.map((v, i) => v + h / 2 * k1[i]), u), k3 = ss.f(x.map((v, i) => v + h / 2 * k2[i]), u), k4 = ss.f(x.map((v, i) => v + h * k3[i]), u); x = x.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); } return x; };
  const m = n + 3 + nd;
  const F = z => { const x = z.slice(0, n), Ik = z[n], Dk = z[n + 1], eP = z[n + 2], q = z.slice(n + 3); const e = -ss.y(x);
    let Ii = Ik; if (hasI) Ii = CS.meth === 'fe' ? Ik + CS.Kp * T / CS.Ti * eP : CS.meth === 'be' ? Ik + CS.Kp * T / CS.Ti * e : Ik + CS.Kp * T / (2 * CS.Ti) * (e + eP);
    let D2 = Dk; if (hasD) D2 = CS.meth === 'tustin' ? ((2 * Tf - T) * Dk + 2 * CS.Kp * CS.Td * (e - eP)) / (2 * Tf + T) : (Tf * Dk + CS.Kp * CS.Td * (e - eP)) / (Tf + T);
    const u = CS.Kp * e + (hasI ? Ii : 0) + (hasD ? D2 : 0), seq = [u, ...q], uin = seq[nd], qn = seq.slice(0, nd);
    return [...integ(x, uin), Ii, D2, e, ...qn]; };
  const A = []; for (let i = 0; i < m; i++) { const z = new Array(m).fill(0); z[i] = 1; A.push(F(z)); }
  const M = A[0].map((_, i) => A.map(c => c[i]));
  return eig(M).filter(p => cabs(p) > 1e-9 || true);
}
function planeSVG(P, kind, extra = []) {
  const W = 300, c = 150, f = v => v.toFixed(1);
  let R; if (kind === 'z') R = 1.4; else { const m = Math.max(1, ...P.map(p => Math.max(Math.abs(p.re), Math.abs(p.im)))); R = m * 1.25; }
  const X = x => c + (c - 16) * x / R, Y = y => c - (c - 16) * y / R;
  let g = `<rect x="0" y="0" width="${W}" height="${W}" class="tfbg"/>`;
  if (kind === 's') g += `<rect x="${c}" y="0" width="${c}" height="${W}" class="pl-uns"/><text x="${W - 6}" y="16" text-anchor="end" class="sm">nestabilní</text>`;
  else g += `<rect x="0" y="0" width="${W}" height="${W}" class="pl-uns"/><circle cx="${c}" cy="${c}" r="${f(X(1) - c)}" class="pl-st"/><text x="${W - 6}" y="16" text-anchor="end" class="sm">mimo kruh: nestabilní</text>`;
  g += `<line x1="0" x2="${W}" y1="${c}" y2="${c}" class="max"/><line x1="${c}" x2="${c}" y1="0" y2="${W}" class="max"/>`;
  g += `<text x="${W - 6}" y="${c - 6}" text-anchor="end" class="sm">Re</text><text x="${c + 6}" y="14" class="sm">Im</text><text x="${f(X(R * 0.8))}" y="${c + 16}" text-anchor="middle" class="sm">${nf(R * 0.8, 2)}</text>`;
  for (const p of extra) g += `<circle cx="${f(X(p.re))}" cy="${f(Y(p.im))}" r="6" class="pl-o"/>`;
  for (const p of P) { const x = X(clamp(p.re, -R, R)), y = Y(clamp(p.im, -R, R)); g += `<path d="M${f(x - 6)} ${f(y - 6)}L${f(x + 6)} ${f(y + 6)}M${f(x - 6)} ${f(y + 6)}L${f(x + 6)} ${f(y - 6)}" class="pl-x"/>`; }
  return `<svg viewBox="0 0 ${W} ${W}" class="mini plane" role="img" aria-label="Póly v rovině ${kind}">${g}</svg>`;
}
function ctlCtlHTML(disc) {
  const P = PLANTS[CS.pl], seg = (attr, cur, opts) => `<span class="seg">${opts.map(([k, t]) => `<button type="button" ${attr}="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</span>`;
  const sl = (id, l, a, b, st, v, u = '', log) => `<label class="lsl"><span><span>${sub(l)}</span> <b id="csv-${id}">${nf(v, 3)} ${u}</b></span><input type="range" data-cs="${id}"${log ? ' data-log="1"' : ''} min="${log ? Math.log10(a) : a}" max="${log ? Math.log10(b) : b}" step="${log ? 0.01 : st}" value="${log ? Math.log10(v) : v}"></label>`;
  return `<div class="lgrp"><p class="lgh">Soustava</p><select id="cs-pl">${Object.entries(PLANTS).map(([k, p]) => `<option value="${k}"${k === CS.pl ? ' selected' : ''}>${p.n}</option>`).join('')}</select>
${P.p.map(k => { const [l, a, b, st, u] = PNAME[k]; return sl(k, l, a, b, st, CS[k], u); }).join('')}</div>
<div class="lgrp"><p class="lgh">Regulátor</p><div class="lrow">${seg('data-csr', CS.reg, [['P', 'P'], ['PI', 'PI'], ['PD', 'PD'], ['PID', 'PID']])}</div>
${sl('Kp', 'K_p', 0.01, 1000, 0, CS.Kp, '', true)}${CS.reg.includes('I') ? sl('Ti', 'T_i', 0.0005, 20, 0, CS.Ti, 's', true) : ''}${CS.reg.includes('D') ? sl('Td', 'T_d', 0.0005, 5, 0, CS.Td, 's', true) : ''}
<div class="lrow"><button type="button" class="btn" data-cst="om">Optimum modulu</button><button type="button" class="btn" data-cst="so">Symetrické optimum</button></div>
${sl('umax', 'Omezení akční veličiny (0 = bez)', 0, 50, 0.5, CS.umax)}<p class="note" id="cs-tn">${CS.tn || 'Žádaná hodnota skočí v čase 0 na 1, v polovině času přijde porucha 0,5 na vstup soustavy.'}</p></div>
${disc ? `<div class="lgrp"><p class="lgh">Číslicový regulátor</p>${sl('Ts', 'Perioda vzorkování T', 0.0002, 2, 0, CS.Ts, 's', true)}<div class="lrow"><span>Diskretizace</span>${seg('data-csm', CS.meth, [['fe', 'Euler dopředný'], ['be', 'Euler zpětný'], ['tustin', 'Tustin']])}</div>
<label class="chk"><input type="checkbox" id="cs-cd"${CS.cdel ? ' checked' : ''}> výpočet trvá jednu periodu (akční zásah až v dalším kroku)</label></div>` : ''}`;
}
function ctlDraw(disc) {
  const S = ctlSetup(), o = ctlSim(S, false), mt = ctlMetrics(o, S.tEnd), sh = $('#cs-out'); if (!sh) return;
  let od = null, md = null; if (disc) { od = ctlSim(S, true); md = ctlMetrics(od, S.tEnd); }
  const all = (od || o).concat(o), ymx = Math.max(1.2, ...all.map(p => p[1]).filter(isFinite)), ymn = Math.min(0, ...all.map(p => p[1]).filter(isFinite));
  const yr = [Math.max(ymn, -3), Math.min(ymx * 1.05, 4)];
  const ycur = disc ? [{ pts: o.map(p => [p[0], p[1]]), c: 'mdl' }, { pts: od.map(p => [p[0], p[1]]), c: 'mc1' }] : [{ pts: o.map(p => [p[0], p[1]]), c: 'mc1' }];
  const sampled = disc ? od.filter((p, i, a) => i === 0 || Math.floor(p[0] / CS.Ts) !== Math.floor(a[i - 1][0] / CS.Ts)).slice(0, 400).map(p => ({ x: p[0], y: p[1], r: 2.5, c: 'mpt2' })) : [];
  const plotY = miniPlot({ xr: [0, S.tEnd], yr, xl: 't [s]', yl: 'y (regulovaná)', curves: ycur, hl: [{ y: 1, c: 'mld', t: 'w' }], vl: [{ x: S.tEnd * CS.dist, c: 'mdl', t: 'porucha' }], pts: sampled, al: 'Přechodová charakteristika' });
  const us = (od || o).map(p => p[2]).filter(isFinite), ul = Math.max(1, ...us.map(Math.abs)) * 1.1;
  const plotU = miniPlot({ xr: [0, S.tEnd], yr: [-ul, ul], xl: 't [s]', yl: 'u (akční)', curves: [{ pts: (od || o).map(p => [p[0], p[2]]), c: 'mc2' }], al: 'Akční veličina' });
  const B = ctlBode(S);
  const plotM = miniPlot({ xr: [B.lo, B.hi], xlog: true, yr: [-60, 60], xl: 'ω [rad/s]', yl: '|L| [dB]', curves: [{ pts: B.pts, c: 'mc1' }], vl: isFinite(B.wc) ? [{ x: Math.log10(B.wc), c: 'mdl', t: 'ω_c' }] : [], al: 'Bode – amplituda' });
  const plotP = miniPlot({ xr: [B.lo, B.hi], xlog: true, yr: [-360, 0], xl: 'ω [rad/s]', yl: 'φ [°]', curves: [{ pts: B.ph, c: 'mc3' }], hl: [{ y: -180, c: 'mld', t: '−180°' }], vl: isFinite(B.wc) ? [{ x: Math.log10(B.wc), c: 'mdl' }] : [], al: 'Bode – fáze' });
  const pc = ctlPolesC(S);
  let poles = '';
  if (!disc) poles = `<div class="lgrp ldg"><p class="lgh">Póly uzavřené smyčky (rovina s)</p>${planeSVG(pc, 's')}<p class="note">${pc.length ? pc.map(p => cTex(p)).join(', ').replace(/[()]/g, '') : ''}${S.tau ? ' · zpoždění nahrazeno Padého aproximací 1. řádu' : ''}</p></div>`;
  else { const pd = ctlPolesD(S), map = pc.map(p => cpol(Math.exp(p.re * CS.Ts), p.im * CS.Ts)), mx = Math.max(...pd.map(cabs)), st = mx < 1 + 1e-4; poles = `<div class="lgrp ldg"><p class="lgh">Póly uzavřené smyčky (rovina z)</p>${planeSVG(pd, 'z', map)}<p class="note">× póly číslicové smyčky, ○ póly spojité smyčky přepočtené z = e^{sT}. ${st ? 'Všechny uvnitř jednotkové kružnice: stabilní.' : '<b>Pól mimo jednotkovou kružnici: nestabilní.</b>'} Největší |z| = ${nf(mx, 5)}.</p></div>`; }
  const m = (l, v) => `<tr><td>${sub(l)}</td><td>${v}</td></tr>`;
  sh.innerHTML = `<div class="ldiag"><div class="lgrp ldg"><p class="lgh">Odezva na skok žádané hodnoty a poruchu</p>${plotY}<p class="note">${disc ? 'Čárkovaně spojitý regulátor, plně číslicový; tečky = vzorky.' : ''}</p></div>
<div class="lgrp ldg"><p class="lgh">Akční veličina</p>${plotU}<table class="fzout">${m('Překmit', nf(mt.os, 3) + ' %' + (disc ? ' → ' + nf(md.os, 3) + ' %' : ''))}${m('Doba regulace (±2 %)', (isFinite(mt.ts) ? nf(mt.ts, 3) + ' s' : '–') + (disc ? ' → ' + (isFinite(md.ts) ? nf(md.ts, 3) + ' s' : '–') : ''))}${m('Ustálená odchylka', nf(mt.ess, 3))}</table></div>
<div class="lgrp ldg"><p class="lgh">Bodeho diagram otevřené smyčky</p>${plotM}${plotP}<table class="fzout">${m('Řezný kmitočet ω_c', isFinite(B.wc) ? nf(B.wc, 3) + ' rad/s' : '–')}${m('Fázová bezpečnost', isFinite(B.pm) ? nf(B.pm, 3) + '°' : '–')}${m('Amplitudová bezpečnost', isFinite(B.gm) ? nf(B.gm, 3) + ' dB' : '∞')}${disc ? m('Zpoždění vzorkováním ≈ T/2 (+T výpočet)', nf(CS.Ts / 2 * (CS.cdel ? 3 : 1), 3) + ' s → fáze −' + (isFinite(B.wc) ? nf(B.wc * CS.Ts / 2 * (CS.cdel ? 3 : 1) / DEG, 3) : '?') + '° při ω_c') : ''}</table></div>${poles}</div>`;
}
const AN_THEORY = `
<div class="arts"><div class="art"><h4>Regulátory</h4><table class="vz"><tbody>
<tr><td>P</td><td>\\( K_p \\)</td><td>trvalá odchylka u statické soustavy</td></tr>
<tr><td>PI</td><td>\\( K_p\\left(1+\\dfrac{1}{T_i s}\\right) \\)</td><td>odstraní ustálenou odchylku, přidá fázi −90° na nízkých ω</td></tr>
<tr><td>PD</td><td>\\( K_p\\left(1+\\dfrac{T_d s}{T_f s+1}\\right) \\)</td><td>předbíhá, zrychlí, ale zesiluje šum</td></tr>
<tr><td>PID</td><td>\\( K_p\\left(1+\\dfrac{1}{T_i s}+\\dfrac{T_d s}{T_f s+1}\\right) \\)</td><td>\\( T_f = T_d/N \\), N ≈ 5–20</td></tr></tbody></table></div>
<div class="art"><h4>Uzavřená smyčka</h4><p>\\[ \\frac{Y}{W} = \\frac{C G}{1 + C G},\\qquad \\frac{Y}{D} = \\frac{G}{1+CG},\\qquad L(s) = C(s)G(s) \\]</p><p>Charakteristická rovnice \\( 1 + L(s) = 0 \\) dává póly uzavřené smyčky. Stabilní, když všechny leží v levé polorovině.</p><p><b>Fázová bezpečnost</b> \\( \\varphi_m = 180^\\circ + \\arg L(j\\omega_c) \\), kde \\( |L(j\\omega_c)| = 1 \\). Orientačně 60–70° ≈ malý překmit, 45° ≈ 20 %, 30° ≈ 35–40 %.</p></div>
<div class="art"><h4>Optimum modulu</h4><p>Soustava \\( \\dfrac{K}{(T_1 s+1)(T_\\sigma s+1)} \\), \\( T_1 \\gg T_\\sigma \\). PI regulátor zkrátí velkou časovou konstantu: \\( T_i = T_1 \\), \\( K_p = \\dfrac{T_1}{2KT_\\sigma} \\).</p><p>Uzavřená smyčka \\( \\dfrac{1}{2T_\\sigma^2 s^2 + 2T_\\sigma s + 1} \\approx \\dfrac{1}{2T_\\sigma s+1} \\); překmit 4,3 %, φ_m ≈ 63°. Použití: proudová smyčka.</p></div>
<div class="art"><h4>Symetrické optimum</h4><p>Soustava s integrátorem \\( \\dfrac{K}{s(T_\\sigma s+1)} \\). \\( T_i = 4T_\\sigma \\), \\( K_p = \\dfrac{1}{2KT_\\sigma} \\). Fázová charakteristika je symetrická kolem \\( \\omega_c = 1/(2T_\\sigma) \\), φ_m ≈ 37°.</p><p>Překmit na skok žádané hodnoty asi 43 % (proto filtr žádané hodnoty \\( 1/(4T_\\sigma s+1) \\)), poruchu ale vyreguluje rychle. Použití: otáčková smyčka.</p></div>
<div class="art"><h4>Proč kaskáda</h4><p>Vnitřní (proudová) smyčka je rychlá a z vnější vypadá jako \\( 1/(2T_\\mu s+1) \\). Vnější regulátor pak vidí jednoduchou soustavu a omezení jeho výstupu omezí proud (moment). Vnitřní smyčka musí být aspoň 3–5× rychlejší.</p></div>
<div class="art"><h4>Integrátor a omezení (wind-up)</h4><p>Když je akční veličina v omezení, integrátor by dál integroval odchylku a po návratu by způsobil velký překmit. Řešení: zastavit integraci při omezení (clamping) nebo zpětný výpočet. Vyzkoušejte omezení akční veličiny.</p></div></div>`;
const DIS_THEORY = `
<div class="arts"><div class="art"><h4>Z-transformace</h4><p>\\[ X(z) = \\mathcal{Z}\\{x[k]\\} = \\sum_{k=0}^{\\infty} x[k]\\,z^{-k},\\qquad z = e^{sT} \\]</p><table class="vz"><tbody>
<tr><td>\\( \\delta[k] \\)</td><td>\\( 1 \\)</td></tr><tr><td>\\( \\mathbf{1}[k] \\)</td><td>\\( \\dfrac{z}{z-1} \\)</td></tr><tr><td>\\( kT \\)</td><td>\\( \\dfrac{Tz}{(z-1)^2} \\)</td></tr><tr><td>\\( a^k \\)</td><td>\\( \\dfrac{z}{z-a} \\)</td></tr><tr><td>\\( e^{-akT} \\)</td><td>\\( \\dfrac{z}{z-e^{-aT}} \\)</td></tr>
<tr><td>\\( x[k-1] \\)</td><td>\\( z^{-1}X(z) \\) (zpoždění o krok)</td></tr><tr><td>\\( x[k+1] \\)</td><td>\\( zX(z) - z\\,x[0] \\)</td></tr>
<tr><td>koncová hodnota</td><td>\\( x[\\infty] = \\lim_{z\\to1}(z-1)X(z) \\)</td></tr><tr><td>počáteční hodnota</td><td>\\( x[0] = \\lim_{z\\to\\infty} X(z) \\)</td></tr></tbody></table></div>
<div class="art"><h4>Vzorkování a tvarovač</h4><p>Regulátor čte vzorky každých T sekund a výstup drží do dalšího kroku (tvarovač 0. řádu, ZOH):</p><p>\\[ G(z) = (1-z^{-1})\\,\\mathcal{Z}\\left\\{\\frac{G(s)}{s}\\right\\} \\]</p><p>Tvarovač se chová přibližně jako zpoždění \\( T/2 \\): ubírá fázi \\( \\omega T/2 \\). Další perioda přibude, pokud se výpočet výsledku použije až v dalším kroku.</p></div>
<div class="art"><h4>Přepočet spojitého regulátoru</h4><table class="vz"><tbody>
<tr><td>Euler dopředný</td><td>\\( s \\approx \\dfrac{z-1}{T} \\)</td><td>může zobrazit stabilní pól mimo kruh</td></tr>
<tr><td>Euler zpětný</td><td>\\( s \\approx \\dfrac{z-1}{zT} \\)</td><td>vždy stabilní, ale tlumí</td></tr>
<tr><td>Tustin (bilineární)</td><td>\\( s \\approx \\dfrac{2}{T}\\dfrac{z-1}{z+1} \\)</td><td>levá polorovina → kruh, nejvěrnější</td></tr></tbody></table>
<p>PSD (rychlostní tvar, Tustin): \\( u_k = u_{k-1} + K_p\\left[(e_k - e_{k-1}) + \\dfrac{T}{2T_i}(e_k + e_{k-1})\\right] \\).</p></div>
<div class="art"><h4>Rovina z</h4><ul class="lt"><li>Stabilita: všechny póly uvnitř jednotkové kružnice \\( |z| < 1 \\).</li><li>\\( z = e^{sT} \\): imaginární osa → jednotková kružnice, levá polorovina → vnitřek, počátek s = 0 → z = 1.</li><li>Pól na záporné reálné ose (z < 0): střídání znaménka každý krok – „zvonění“ regulátoru.</li><li>Čím menší T, tím blíž jsou póly bodu 1 a tím víc se číslicová regulace podobá spojité.</li></ul></div>
<div class="art"><h4>Volba periody vzorkování</h4><ul class="lt"><li>Shannonova–Kotelnikovova věta: \\( f_s > 2 f_{max} \\), jinak vzniká aliasing (vyšší kmitočty se „přeloží“ na nižší).</li><li>Prakticky: \\( T \\approx (0{,}1 \\text{ až } 0{,}2)/\\omega_c \\), nebo 10–20 vzorků na dobu náběhu.</li><li>Proudové smyčky měničů: T = perioda PWM (50–200 µs), otáčkové 1–2 ms.</li><li>Před převodníkem antialiasingový filtr.</li></ul></div></div>`;
/* aliasing */
const AL = { f: 9, fs: 10 };
function aliasSVG() {
  const T = 1, fa = Math.abs(AL.f - AL.fs * Math.round(AL.f / AL.fs)), pts = [], al = [], sm = [];
  for (let k = 0; k <= 600; k++) { const t = T * k / 600; pts.push([t, Math.sin(2 * Math.PI * AL.f * t)]); al.push([t, Math.sin(2 * Math.PI * (AL.f - AL.fs * Math.round(AL.f / AL.fs)) * t)]); }
  for (let k = 0; k * (1 / AL.fs) <= T; k++) { const t = k / AL.fs; sm.push({ x: t, y: Math.sin(2 * Math.PI * AL.f * t), r: 4 }); }
  return miniPlot({ xr: [0, T], yr: [-1.3, 1.3], xl: 't [s]', yl: 'signál', curves: [{ pts, c: 'mdl' }, { pts: al, c: 'mc1' }], pts: sm, al: 'Aliasing' }) + `<p class="dgn">Signál ${nf(AL.f)} Hz vzorkovaný ${nf(AL.fs)} Hz: ze vzorků se jeví jako ${nf(fa)} Hz${AL.fs > 2 * AL.f ? ' – bez aliasingu (f_s > 2f).' : ' – <b>aliasing</b> (f_s ≤ 2f).'}</p>`;
}
/* ---------- vykreslení záložky ---------- */
function renderTrf(el) {
  const tabs = [['lap', 'Laplaceova transformace'], ['an', 'Analogové řízení'], ['dis', 'Diskrétní řízení a Z'], ['dq', 'Clarke / Park (dq)']];
  el.innerHTML = `<div class="wrap trfw"><h2>Transformace a řízení</h2><p class="lead">Pomůcka ke Laplaceově a Z-transformaci, spojité a číslicové regulaci a k transformacím souřadnic střídavých strojů.</p>
<div class="cbar"><span class="seg">${tabs.map(([k, t]) => `<button type="button" data-trv="${k}" aria-pressed="${TRV === k}">${t}</button>`).join('')}</span></div><div id="trv-body"></div></div>`;
  const b = $('#trv-body');
  if (TRV === 'dq') { renderDq(b); return; }
  if (TRV === 'lap') {
    b.innerHTML = `<h3>Kalkulačka: zpětná transformace krok za krokem</h3><div class="cols2"><div class="lgrp"><p class="lgh">Obraz F(s) = čitatel / jmenovatel</p>
<label class="tfin1">Čitatel<input id="lap-N" value="${LAP.N}" spellcheck="false" autocomplete="off"></label><label class="tfin1">Jmenovatel<input id="lap-D" value="${LAP.D}" spellcheck="false" autocomplete="off"></label>
<label class="lsl"><span><span>Zobrazený čas</span> <b id="lap-Tv">${LAP.T} s</b></span><input type="range" id="lap-T" min="1" max="30" step="1" value="${LAP.T}"></label>
<p class="note">Zápis: <code>s</code>, čísla, <code>+ − * ^</code>, závorky a násobení bez znaménka, např. <code>s(0.5s+1)^2</code> nebo <code>s^2+2s+5</code>.</p>
<div class="lrow trpre">${LAP_PRE.map((p, i) => `<button type="button" class="btn" data-lapp="${i}" title="${p[2]}">${p[2]}</button>`).join('')}</div></div>
<div class="lgrp" id="lap-out"></div></div><h3>Slovník, věty a postup</h3>${LAP_THEORY}${ctlQ('lap')}`;
    lapRefresh(); typeset(b); return;
  }
  const disc = TRV === 'dis';
  b.innerHTML = `<h3>${disc ? 'Číslicový regulátor naživo' : 'Regulační smyčka naživo'}</h3><div class="ctlg"><div id="cs-ctl">${ctlCtlHTML(disc)}</div><div id="cs-out"></div></div>
${disc ? `<h3>Aliasing</h3><div class="cols2"><div class="lgrp">${[['f', 'Kmitočet signálu f', 0.5, 30, 0.5], ['fs', 'Vzorkovací kmitočet f_s', 1, 60, 0.5]].map(([k, l, a, bb, st]) => `<label class="lsl"><span><span>${sub(l)}</span> <b id="alv-${k}">${AL[k]} Hz</b></span><input type="range" data-al="${k}" min="${a}" max="${bb}" step="${st}" value="${AL[k]}"></label>`).join('')}</div><div class="lgrp" id="al-out">${aliasSVG()}</div></div>` : ''}
<h3>Vzorce a pravidla</h3>${disc ? DIS_THEORY : AN_THEORY}${ctlQ(disc ? 'dis' : 'an')}`;
  ctlDraw(disc); typeset(b);
}
function lapRefresh() { const o = $('#lap-out'); if (!o) return; o.innerHTML = lapCalcHTML(); typeset(o); }
const CTL_Q = {
  lap: [['Proč se v Laplaceově transformaci derivace změní v násobení s?', 'Integrací per partes: ∫f′e^{−st}dt = [f e^{−st}] + s∫f e^{−st}dt = sF(s) − f(0). Diferenciální rovnice se tak stane algebraickou.'],
    ['Kdy nesmím použít větu o koncové hodnotě?', 'Když má sF(s) pól v pravé polorovině nebo na imaginární ose (mimo jednoduchý pól v nule v F). Pak f(t) limitu nemá (roste nebo kmitá) a věta dá nesmyslné číslo – např. 1/(s−1) by „dala“ 0.'],
    ['Co určuje tvar přechodového děje: póly, nebo nuly?', 'Póly určují, jaké exponenciály a kmity v odezvě jsou (a stabilitu). Nuly určují, jak velký podíl má každá z nich (koeficienty rozkladu); nula v pravé polorovině způsobí podkmit (odezva začne opačným směrem).'],
    ['Proč dopravní zpoždění nelze zapsat jako podíl polynomů?', 'Jeho obraz e^{−sτ} je transcendentní funkce, má nekonečně mnoho „pólů“. Pro výpočet pólů se nahrazuje Padého aproximací (1 − sτ/2)/(1 + sτ/2); fázi ubírá ωτ, amplitudu nemění.'],
    ['Jaký je rozdíl mezi přenosem a obrazem odezvy?', 'Přenos G(s) = Y(s)/U(s) je vlastnost systému (při nulových počátečních podmínkách). Obraz odezvy Y(s) = G(s)·U(s) navíc obsahuje vstup, např. pro skok G(s)/s.']],
  an: [['Proč PI regulátor odstraní trvalou odchylku a P ne?', 'V ustáleném stavu musí být vstup integrátoru nulový, jinak by se výstup měnil. Vstupem je odchylka, takže je nulová. P regulátor potřebuje nenulovou odchylku, aby vůbec dal nějaký akční zásah.'],
    ['Proč u otáčkové smyčky nefunguje optimum modulu?', 'Soustava už obsahuje integrátor (J·dΩ/dt). PI regulátor přidá druhý, fáze na nízkých kmitočtech je −180° a bez symetrického rozložení (T_i = 4T_σ) by byla smyčka na mezi stability.'],
    ['Co je fázová bezpečnost a proč nestačí, že je smyčka stabilní?', 'Kolik fáze chybí do −180° na řezném kmitočtu. Malá bezpečnost znamená stabilní, ale silně kmitavou odezvu, a citlivost na změnu parametrů (zpoždění, zesílení).'],
    ['Proč se D složka filtruje?', 'Čistá derivace má zesílení rostoucí s kmitočtem do nekonečna; šum měření by vybudil obrovskou akční veličinu. Filtr T_d/N omezí zesílení na vysokých kmitočtech na K_p(1+N).'],
    ['Co je wind-up a jak se projeví?', 'Při omezené akční veličině integrátor dál roste. Když se odchylka změní znaménko, musí se integrátor nejdřív „vybít“ – výsledkem je velký překmit a pomalé ustálení. Řeší se zastavením integrace v omezení.']],
  dis: [['Proč je číslicový regulátor horší než spojitý se stejnými parametry?', 'Tvarovač drží výstup po celou periodu: přidá zpoždění asi T/2 (a další T, pokud se výsledek použije až v dalším kroku). To ubere fázovou bezpečnost ωT/2 a zvětší překmit.'],
    ['Kde jsou v rovině z stabilní póly a proč?', 'Uvnitř jednotkové kružnice: z = e^{sT} zobrazí levou polorovinu (Re s < 0) na |z| < 1. Odezva obsahuje členy z^k, které zanikají jen pro |z| < 1.'],
    ['Proč Tustinova metoda zachová stabilitu a dopředný Euler ne?', 'Tustin zobrazí celou levou polorovinu přesně do jednotkového kruhu. Dopředný Euler z = 1 + sT posune pól o −1/T doprava, takže při velkém T může stabilní pól vyjít mimo kruh.'],
    ['Co je aliasing a jak se mu brání?', 'Signál s kmitočtem nad f_s/2 dá stejné vzorky jako nižší kmitočet; regulátor pak „vidí“ falešný signál. Brání se analogovým filtrem před převodníkem a dostatečně vysokým f_s.'],
    ['Jak zvolit periodu vzorkování proudové smyčky?', 'Typicky synchronně s PWM (jednou nebo dvakrát za periodu), aby se měřila střední hodnota proudu bez zvlnění. Musí být výrazně kratší než elektrická časová konstanta a T_σ smyčky.']],
};
function ctlQ(k) { return `<h3>Otázky na zkoušku</h3>${CTL_Q[k].map(([q, a]) => `<details class="zq"><summary><span class="zqt">${sub(q)}</span></summary><div class="zqa"><p>${sub(a)}</p></div></details>`).join('')}`; }
let csT = 0;
function ctlRedraw(full) { const disc = TRV === 'dis'; if (full) $('#cs-ctl').innerHTML = ctlCtlHTML(disc); clearTimeout(csT); csT = setTimeout(() => ctlDraw(disc), 30); }
document.addEventListener('click', e => {
  if (tab !== 'trf') return; const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.trv) { TRV = d.trv; renderTrf($('#cards')); }
  else if (d.lapp) { const p = LAP_PRE[+d.lapp]; LAP.N = p[0]; LAP.D = p[1]; $('#lap-N').value = p[0]; $('#lap-D').value = p[1]; lapRefresh(); }
  else if (d.csr) { CS.reg = d.csr; CS.tn = ''; ctlRedraw(true); }
  else if (d.cst) { CS.tn = ctlTune(d.cst); ctlRedraw(true); }
  else if (d.csm) { CS.meth = d.csm; ctlRedraw(true); }
});
let lapT = 0;
document.addEventListener('input', e => {
  if (tab !== 'trf') return; const t = e.target;
  if (t.id === 'lap-N' || t.id === 'lap-D') { LAP[t.id.slice(4)] = t.value; clearTimeout(lapT); lapT = setTimeout(lapRefresh, 300); }
  else if (t.id === 'lap-T') { LAP.T = +t.value; $('#lap-Tv').textContent = t.value + ' s'; clearTimeout(lapT); lapT = setTimeout(lapRefresh, 100); }
  else if (t.dataset.cs) { const k = t.dataset.cs, v = t.dataset.log ? 10 ** +t.value : +t.value; CS[k] = v; const o = $('#csv-' + k); if (o) o.textContent = nf(v, 3) + ' ' + (PNAME[k] ? PNAME[k][4] : ['Ti', 'Td', 'Ts'].includes(k) ? 's' : ''); ctlRedraw(false); }
  else if (t.dataset.al) { AL[t.dataset.al] = +t.value; $('#alv-' + t.dataset.al).textContent = t.value + ' Hz'; $('#al-out').innerHTML = aliasSVG(); }
});
document.addEventListener('change', e => {
  if (tab !== 'trf') return; const t = e.target;
  if (t.id === 'cs-pl') { CS.pl = t.value; const I = PLANTS[CS.pl].info(CS); CS.tn = ''; CS.Ts = Math.max(I.Ts, 0.05 * (I.T1 || 0)) / 4; ctlTune(I.I ? 'so' : 'om'); CS.tn = 'Regulátor nastaven automaticky (' + (I.I ? 'symetrické optimum' : 'optimum modulu') + '). Zkuste ho rozladit.'; ctlRedraw(true); }
  else if (t.id === 'cs-cd') { CS.cdel = t.checked; ctlRedraw(false); }
});
