/* ===== Interaktivní fázorové diagramy ===== */
const Cx = (re, im = 0) => ({ re, im });
const cadd = (a, b) => Cx(a.re + b.re, a.im + b.im), csub = (a, b) => Cx(a.re - b.re, a.im - b.im);
const cmul = (a, b) => Cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return Cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const cabs = a => Math.hypot(a.re, a.im), carg = a => Math.atan2(a.im, a.re), csc = (a, k) => Cx(a.re * k, a.im * k);
const cpol = (r, ph) => Cx(r * Math.cos(ph), r * Math.sin(ph)), cconj = a => Cx(a.re, -a.im);
const DEG = Math.PI / 180;

/* kreslení: vektory {a, b, c(lass), t(ext)}, osy {a, b, t}, oblouky {r, a0, a1, t} */
function phasorSVG(V, axes, arcs, label) {
  const pts = [Cx(0, 0)]; V.forEach(v => { pts.push(v.a, v.b); });
  let x0 = Math.min(...pts.map(p => p.re)), x1 = Math.max(...pts.map(p => p.re)), y0 = Math.min(...pts.map(p => p.im)), y1 = Math.max(...pts.map(p => p.im));
  const W = 640, H = 440, pad = 56, s = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-6), (H - 2 * pad) / Math.max(y1 - y0, 1e-6));
  const ox = pad + ((W - 2 * pad) - (x1 - x0) * s) / 2 - x0 * s, oy = H - pad - ((H - 2 * pad) - (y1 - y0) * s) / 2 + y0 * s;
  const X = p => [ox + p.re * s, oy - p.im * s], f = v => v.toFixed(1);
  let g = `<defs>${[['k', 'var(--ink)'], ['r', 'var(--red)'], ['b', 'var(--blu)'], ['o', 'var(--och)']].map(([k, c]) => `<marker id="fz${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:${c}"/></marker>`).join('')}</defs>`;
  for (const ax of axes) { const [a, b] = [X(ax.a), X(ax.b)]; g += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" class="kd"/>`; if (ax.t) g += `<text x="${f(b[0] + 4)}" y="${f(b[1] - 4)}" class="sm">${ax.t}</text>`; }
  for (const ar of arcs) {
    const [cx, cy] = X(Cx(0, 0)), r = ar.r, p0 = [cx + r * Math.cos(ar.a0), cy - r * Math.sin(ar.a0)], p1 = [cx + r * Math.cos(ar.a1), cy - r * Math.sin(ar.a1)], sw = ar.a1 > ar.a0 ? 0 : 1, am = (ar.a0 + ar.a1) / 2;
    if (Math.abs(ar.a1 - ar.a0) > 0.02) g += `<path d="M${f(p0[0])} ${f(p0[1])}A${r} ${r} 0 0 ${sw} ${f(p1[0])} ${f(p1[1])}" class="ld"/><text x="${f(cx + (r + 14) * Math.cos(am))}" y="${f(cy - (r + 14) * Math.sin(am) + 5)}" text-anchor="middle" class="${ar.c || 'b'}">${ar.t}</text>`;
  }
  const mk = { k: 'k', kr: 'r', kbl: 'b', kor: 'o', kd: 'k' };
  for (const v of V) {
    const [a, b] = [X(v.a), X(v.b)], len = Math.hypot(b[0] - a[0], b[1] - a[1]); if (len < 1.5) continue;
    g += `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" class="${v.c || 'k'}${v.w ? ' fzw' : ''}" marker-end="url(#fz${mk[v.c || 'k']})"/>`;
    if (v.t) {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), nx = -Math.sin(ang), ny = Math.cos(ang), side = v.side || 1, at = v.at == null ? 1 : v.at;
      const px = a[0] + (b[0] - a[0]) * at + (at === 1 ? 10 * Math.cos(ang) : 0) + nx * 14 * side, py = a[1] + (b[1] - a[1]) * at + (at === 1 ? 10 * Math.sin(ang) : 0) + ny * 14 * side + 5;
      g += `<text x="${f(px)}" y="${f(py)}" text-anchor="middle" class="${v.tc || 'b'}">${v.t}</text>`;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${g}</svg>`;
}

const FAZ = {
  tr: {
    n: 'Transformátor',
    p: [['I', 'Zatížení I/I_N', 0, 1.5, 0.05, 1, ''], ['cf', 'Účiník zátěže cos φ₂', 0, 1, 0.01, 0.8, ''], ['ch', 'Charakter zátěže', 'sel', [['1', 'induktivní'], ['-1', 'kapacitní']], 0, '1', ''],
      ['uk', 'Napětí nakrátko u_k', 2, 20, 0.5, 6, '%'], ['ck', 'cos φ_k', 0.05, 0.95, 0.05, 0.3, ''], ['i0', 'Proud naprázdno i_0', 0, 10, 0.5, 0, '%'], ['zm', 'Zvětšení úbytků v obrázku', 1, 10, 1, 5, '×']],
    calc(v) {
      const phi = Math.acos(v.cf) * (+v.ch), U2 = Cx(1, 0), I2 = cpol(v.I, -phi), pk = Math.acos(v.ck), uk = v.uk / 100;
      const Rk = uk * v.ck, Xk = uk * Math.sin(pk), RI = csc(I2, Rk), XI = cmul(Cx(0, Xk), I2), U1 = cadd(cadd(U2, RI), XI);
      const I0 = cpol(v.i0 / 100 * cabs(U1), carg(U1) - 80 * DEG), I1 = cadd(I2, I0);
      const z = v.zm, RIz = csc(RI, z), XIz = csc(XI, z), A = cadd(U2, RIz), U1z = cadd(A, XIz);
      const du = (cabs(U1) - 1) / cabs(U1) * 100, duA = v.I * (Rk * Math.cos(phi) + Xk * Math.sin(phi)) * 100;
      const V = [{ a: Cx(0, 0), b: U2, t: 'U₂′', side: -1 }, { a: U2, b: A, c: 'kbl', t: 'R_k I', tc: 'sm', side: -1, at: 0.5 }, { a: A, b: U1z, c: 'kbl', t: 'jX_k I', tc: 'sm', at: 0.5 }, { a: Cx(0, 0), b: U1z, t: 'U₁' },
        { a: Cx(0, 0), b: csc(I2, 0.6), c: 'kr', t: 'I₂′' }];
      if (v.i0 > 0) V.push({ a: Cx(0, 0), b: csc(I0, 0.6 * 4), c: 'kor', t: 'I₀ (4×)', tc: 'sm' }, { a: Cx(0, 0), b: csc(I1, 0.6), c: 'kr', w: 1, t: 'I₁', side: -1 });
      const arcs = [{ r: 60, a0: 0, a1: -phi, t: 'φ₂' }];
      return {
        svg: phasorSVG(V, [], arcs, 'Fázorový diagram transformátoru'),
        out: [['Úbytek napětí Δu (přesně)', fmt(du, 2) + ' %'], ['Δu ≈ I(u_R cos φ₂ + u_X sin φ₂)', fmt(duA, 2) + ' %'], ['u_R, u_X', fmt(Rk * 100, 2) + ' %, ' + fmt(Xk * 100, 2) + ' %'], ['Činný / jalový výkon zátěže', fmt(v.I * v.cf, 2) + ' / ' + fmt(v.I * Math.sin(phi), 2) + ' p.j.']],
        note: du < -0.05 ? 'Při kapacitní zátěži napětí na sekundáru stoupne (Δu < 0): kapacitní proud na rozptylové reaktanci zvětšuje napětí.' : Math.abs(phi - pk) < 0.06 && v.ch === '1' ? 'Teď je φ₂ ≈ φ_k: úbytek je největší a rovná se u_k (při I = I_N).' : 'Napětí U₁ je dané sítí; o úbytek na impedanci nakrátko je výstupní napětí menší. Zkuste cos φ₂ = cos φ_k nebo kapacitní zátěž.'
      };
    },
    txt: 'Diagram vychází ze zjednodušeného náhradního schématu: příčná větev je posunutá na svorky, podélné prvky tvoří impedanci nakrátko Z_k = R_k + jX_k. Vztažným fázorem je přepočtené sekundární napětí U₂′ = 1 p.j. Úbytky na R_k a X_k jsou ve skutečnosti malé (u_k = 4 až 12 %), proto je můžete v obrázku zvětšit; výpočty používají skutečné hodnoty. Trojúhelník R_k I, jX_k I je Kappův trojúhelník.'
  },
  am: {
    n: 'Asynchronní motor',
    p: [['s', 'Skluz s', -0.3, 1.2, 0.005, 0.04, ''], ['U', 'Napětí U₁ (fázové)', 50, 260, 1, 231, 'V'], ['R2', 'Odpor rotoru R₂′', 0.1, 5, 0.05, 0.5, 'Ω'], ['Lh', 'Magnetizační indukčnost L_h', 30, 300, 5, 120, 'mH']],
    calc(v) {
      const P = MODS.am.def, w1 = TAU * P.fN, Ws = w1 / P.pp;
      const s = Math.abs(v.s) < 1e-4 ? 1e-4 : v.s, Z1 = Cx(P.R1, w1 * P.L1s / 1e3), Zm = Cx(0, w1 * v.Lh / 1e3), Z2 = Cx(v.R2 / s, w1 * P.L2s / 1e3);
      const Zp = cdiv(cmul(Zm, Z2), cadd(Zm, Z2)), U1 = Cx(v.U, 0), I1 = cdiv(U1, cadd(Z1, Zp)), Ui = csub(U1, cmul(Z1, I1)), I2 = cdiv(Ui, Z2), Im = cdiv(Ui, Zm);
      const M = 3 * cabs(I2) ** 2 * v.R2 / s / Ws, cosf = Math.cos(carg(U1) - carg(I1)), P1 = 3 * v.U * cabs(I1) * cosf, Pm = M * Ws * (1 - v.s);
      const kI = cabs(U1) * 0.75 / Math.max(cabs(I1), cabs(I2), 1e-6);
      const R1I = csc(I1, P.R1), X1I = cmul(Cx(0, w1 * P.L1s / 1e3), I1), A = cadd(Ui, R1I);
      const V = [{ a: Cx(0, 0), b: U1, t: 'U₁', side: -1 }, { a: Cx(0, 0), b: Ui, t: 'U_i', side: 1, at: 0.6 }, { a: Ui, b: A, c: 'kbl', t: 'R₁I₁', tc: 'sm', at: 0.5 }, { a: A, b: U1, c: 'kbl', t: 'jX₁σI₁', tc: 'sm', at: 0.5, side: -1 },
        { a: Cx(0, 0), b: csc(I1, kI), c: 'kr', t: 'I₁' }, { a: Cx(0, 0), b: csc(Im, kI), c: 'kor', t: 'I_μ', tc: 'sm' }, { a: Cx(0, 0), b: csc(I2, kI), c: 'kr', w: 1, t: 'I₂′', side: 1 }];
      const reg = v.s < 0 ? 'generátor (nad synchronní rychlostí): činný výkon teče do sítě, proud je posunutý o víc než 90°' : v.s > 1 ? 'brzda (rotor se točí proti poli)' : v.s > 0.25 ? 'oblast velkých skluzů: velký proud, malý účiník, moment za zvratem' : 'motor v pracovní oblasti';
      return {
        svg: phasorSVG(V, [], [{ r: 70, a0: 0, a1: carg(I1), t: 'φ₁' }], 'Fázorový diagram asynchronního motoru'),
        out: [['Režim', reg.split(' (')[0].split(':')[0]], ['Otáčky n', fmt(60 * P.fN / P.pp * (1 - v.s), 0) + ' ot/min'], ['Proud I₁, I₂′, I_μ', fmt(cabs(I1), 1) + ' / ' + fmt(cabs(I2), 1) + ' / ' + fmt(cabs(Im), 1) + ' A'], ['Účiník cos φ₁', fmt(cosf, 3)], ['Moment M', fmt(M, 1) + ' N·m'], ['Příkon P₁, mech. výkon', fmt(P1 / 1e3, 2) + ' / ' + fmt(Pm / 1e3, 2) + ' kW'], ['Účinnost (bez ztrát v železe a mech.)', v.s > 0 && v.s < 1 ? fmt(Pm / P1 * 100, 1) + ' %' : '–']],
        note: 'Režim: ' + reg + '. Proudy jsou v obrázku ve vlastním měřítku (I₁ = I_μ + I₂′, rotorový proud orientovaný jako u zátěže, stejně jako ve skriptech ZPO).'
      };
    },
    txt: 'Fázor napětí U₁ je vztažný. Proud statoru se dělí na magnetizační I_μ (zpožděný téměř o 90° za U_i) a rotorový I₂′, který teče přes R₂′/s a X₂σ′. Při malém skluzu je R₂′/s velký a rotorový proud je skoro ve fázi s U_i; se skluzem roste proud i jeho jalová složka. Parametry motoru odpovídají záložce Asynchronní (400 V, 4 póly).'
  },
  sm: {
    n: 'Synchronní stroj',
    p: [['E', 'Napětí od buzení U_i (~ I_f)', 0, 2.5, 0.02, 1.4, 'p.j.'], ['d', 'Zátěžný úhel β', -90, 90, 1, 25, '°'], ['Xd', 'Synchronní reaktance X_d', 0.4, 2.5, 0.05, 1.2, 'p.j.'], ['Xq', 'Příčná reaktance X_q', 0.3, 2.5, 0.05, 1.2, 'p.j.']],
    calc(v) {
      const d = v.d * DEG, Xq = Math.min(v.Xq, v.Xd), q = cpol(1, d), dd = cpol(1, d - Math.PI / 2), U = Cx(1, 0);
      const Iq = Math.sin(d) / Xq, Id = (v.E - Math.cos(d)) / v.Xd, I = cadd(csc(dd, Id), csc(q, Iq)), E = csc(q, v.E);
      const S = cmul(U, cconj(I)), Pp = S.re, Q = S.im, round = Math.abs(v.Xd - Xq) < 1e-6;
      const A = cadd(U, csc(q, -Xq * Iq + 0)), jXqIq = csc(cmul(Cx(0, Xq), csc(q, Iq)), 1), jXdId = cmul(Cx(0, v.Xd), csc(dd, Id));
      const kI = 0.7 / Math.max(cabs(I), 0.3);
      const V = [{ a: Cx(0, 0), b: U, t: 'U', side: -1 }, { a: Cx(0, 0), b: E, c: 'k', t: 'U_i', side: 1 }, { a: Cx(0, 0), b: csc(I, kI), c: 'kr', t: 'I' }];
      if (round) V.push({ a: U, b: E, c: 'kbl', t: 'jX_d I', tc: 'sm', at: 0.5 });
      else V.push({ a: U, b: cadd(U, jXqIq), c: 'kbl', t: 'jX_q I_q', tc: 'sm', at: 0.5 }, { a: cadd(U, jXqIq), b: E, c: 'kbl', t: 'jX_d I_d', tc: 'sm', at: 0.5, side: -1 });
      const L = 1.15 * Math.max(v.E, 1.2);
      const axes = [{ a: Cx(0, 0), b: csc(q, L), t: 'q' }, { a: Cx(0, 0), b: csc(dd, 0.6 * L), t: 'd' }];
      const Pmax = (() => { let m = 0; for (let b = 0; b <= 180; b += 0.5) { const x = b * DEG, p = v.E * Math.sin(x) / v.Xd + 0.5 * (1 / Xq - 1 / v.Xd) * Math.sin(2 * x); if (p > m) m = p; } return m; })();
      const mode = Pp > 0.005 ? 'generátor (dodává činný výkon)' : Pp < -0.005 ? 'motor (odebírá činný výkon)' : 'naprázdno (kompenzátor)';
      const ex = Q > 0.005 ? 'přebuzený: dodává jalový výkon (chová se jako kondenzátor)' : Q < -0.005 ? 'podbuzený: odebírá jalový výkon (chová se jako tlumivka)' : 'buzení právě na cos φ = 1';
      return {
        svg: phasorSVG(V, axes, [{ r: 64, a0: 0, a1: d, t: 'β' }, { r: 44, a0: 0, a1: carg(I), t: 'φ', c: 'sm' }], 'Fázorový diagram synchronního stroje'),
        out: [['Režim', mode], ['Buzení', ex.split(':')[0]], ['P = U U_i sin β / X_d' + (round ? '' : ' + reluktanční'), fmt(Pp, 3) + ' p.j.'], ['Jalový výkon Q', fmt(Q, 3) + ' p.j.'], ['Proud |I|, cos φ', fmt(cabs(I), 3) + ' p.j., ' + fmt(Math.abs(Math.cos(carg(I))), 3)], ['Největší výkon (statická mez)', fmt(Pmax, 2) + ' p.j.'], ['I_d, I_q', fmt(Id, 3) + ', ' + fmt(Iq, 3) + ' p.j.']],
        note: (Math.abs(v.d) > 85 ? 'Blízko 90° je stroj na mezi statické stability. ' : '') + 'Stroj je ' + ex + '. Generátorová konvence: U_i = U + jX_d I (u vyniklých pólů rozklad na osy d a q); záporný úhel β znamená motor.'
      };
    },
    txt: 'Vztažným fázorem je napětí tvrdé sítě U = 1 p.j. Napětí od buzení U_i leží v ose q a je úměrné budicímu proudu, úhel mezi U a U_i je zátěžný úhel β. Činný výkon určuje β (moment turbíny nebo zátěže), jalový výkon buzení. Hladký rotor: nastavte X_q = X_d. Vyniklé póly: X_q < X_d a proud se rozkládá na I_d a I_q; vzniká reluktanční výkon ~ sin 2β.'
  }
};
let fazK = 'tr'; const fazV = {};
for (const k in FAZ) { fazV[k] = {}; for (const p of FAZ[k].p) fazV[k][p[0]] = p[2] === 'sel' ? p[5] : p[5]; }
function fazRow(p, v) {
  const [id, l, a, b, st, , u] = p;
  if (a === 'sel') return `<label class="fr"><span><span>${sub(l)}</span></span><select data-fz="${id}">${b.map(([x, t]) => `<option value="${x}"${String(v[id]) === x ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
  return `<label class="fr"><span><span>${sub(l)}</span> <b id="fzv-${id}">${fmt(v[id], st < 0.01 ? 3 : st < 0.1 ? 2 : st < 1 ? 1 : 0)} ${u}</b></span><input type="range" data-fz="${id}" min="${a}" max="${b}" step="${st}" value="${v[id]}"></label>`;
}
function renderFaz(el) {
  const F = FAZ[fazK], v = fazV[fazK];
  el.innerHTML = `<div class="wrap"><h2>Fázorové diagramy</h2><p class="lead">Posuvníky mění proměnné a diagram se hned překreslí. Černě napětí, červeně proudy, modře úbytky napětí.</p>
<div class="cbar"><span class="seg" role="group" aria-label="Stroj">${Object.entries(FAZ).map(([k, f]) => `<button type="button" data-fzk="${k}" aria-pressed="${k === fazK}">${f.n}</button>`).join('')}</span></div>
<div class="fzgrid"><figure class="sch fz" id="fz-svg"></figure><div class="fzctl"><div class="fzrows">${F.p.map(p => fazRow(p, v)).join('')}</div><table class="fzout" id="fz-out"></table><p class="note" id="fz-note"></p></div></div>
<h3>Jak diagram číst</h3><p>${sub(F.txt)}</p></div>`;
  fazDraw();
}
function fazDraw() {
  const F = FAZ[fazK], v = {}; for (const p of F.p) v[p[0]] = p[2] === 'sel' ? fazV[fazK][p[0]] : +fazV[fazK][p[0]];
  const r = F.calc(v);
  $('#fz-svg').innerHTML = figSub(r.svg);
  $('#fz-out').innerHTML = r.out.map(([a, b]) => `<tr><td>${sub(a)}</td><td>${b}</td></tr>`).join('');
  $('#fz-note').innerHTML = sub(r.note);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-fzk]'); if (b) { fazK = b.dataset.fzk; renderFaz($('#cards')); } });
document.addEventListener('input', e => {
  const id = e.target.dataset && e.target.dataset.fz; if (!id || tab !== 'faz') return;
  const p = FAZ[fazK].p.find(x => x[0] === id); fazV[fazK][id] = p[2] === 'sel' ? e.target.value : +e.target.value;
  const o = document.getElementById('fzv-' + id); if (o) o.textContent = fmt(+e.target.value, p[4] < 0.01 ? 3 : p[4] < 0.1 ? 2 : p[4] < 1 ? 1 : 0) + ' ' + p[6];
  fazDraw();
});
document.addEventListener('change', e => { const id = e.target.dataset && e.target.dataset.fz; if (id && e.target.tagName === 'SELECT') { fazV[fazK][id] = e.target.value; fazDraw(); } });
