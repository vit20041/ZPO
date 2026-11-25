/* ===== Hodinový úhel trojfázového transformátoru ===== */
const HOD_PRE = [['x', 'vlastní zapojení'], ['Yy0', 'Yy0'], ['Yy6', 'Yy6'], ['Yd1', 'Yd1'], ['Yd5', 'Yd5'], ['Yd11', 'Yd11'], ['Dy1', 'Dy1'], ['Dy5', 'Dy5'], ['Dy11', 'Dy11'], ['Dd0', 'Dd0'], ['Dd6', 'Dd6'], ['Yz1', 'Yz1'], ['Yz5', 'Yz5'], ['Yz11', 'Yz11'], ['Dz0', 'Dz0']];
function hodCalc(v) {
  const ph = k => ((k % 3) + 3) % 3, U = [0, 1, 2].map(k => cpol(1, -k * 120 * DEG));       /* svorky A, B, C (sousledně) */
  const V = [0, 1, 2].map(k => v.pr === 'Y' ? U[k] : v.pr === 'D1' ? csub(U[k], U[ph(k + 1)]) : csub(U[k], U[ph(k - 1)]));
  const sg = v.pol === '-' ? -1 : 1, W = V.map(x => csc(x, sg * (v.pr === 'Y' ? 1 : 1 / SQ3)));   /* napětí cívek sekundáru (stejný sloupek) */
  const w = k => W[ph(k)];
  let u, coils;   /* coils: [od, do, sloupek] pro kreslení */
  const O = Cx(0, 0);
  if (v.se === 'y') { u = [0, 1, 2].map(k => w(k)); coils = [0, 1, 2].map(k => [O, u[k], k]); }
  else if (v.se === 'd1') { u = [0, 1, 2].map(k => csc(csub(w(k), w(k - 1)), 1 / 3)); coils = [0, 1, 2].map(k => [u[ph(k + 1)], u[k], k]); }
  else if (v.se === 'd2') { u = [0, 1, 2].map(k => csc(csub(w(k), w(k + 1)), 1 / 3)); coils = [0, 1, 2].map(k => [u[ph(k - 1)], u[k], k]); }
  else { const o = v.se === 'z1' ? 1 : -1; u = [0, 1, 2].map(k => csc(csub(w(k), w(k + o)), 0.5)); coils = []; for (let k = 0; k < 3; k++) { const m = csc(w(k), 0.5); coils.push([O, m, k], [m, u[k], ph(k + o)]); } }
  /* přeznačení svorek sekundáru a→b→c */
  const sh = +v.sh; if (sh) { const u2 = [0, 1, 2].map(k => u[ph(k + sh)]); u = u2; }
  let h = Math.round(((carg(U[0]) - carg(u[0])) / DEG) / 30); h = ((h % 12) + 12) % 12;
  const pc = v.pr === 'Y' ? [0, 1, 2].map(k => [O, U[k], k]) : [0, 1, 2].map(k => [v.pr === 'D1' ? U[ph(k + 1)] : U[ph(k - 1)], U[k], k]);
  return { u, U, h, pc, coils, sh };
}
function hodSVG(r, v) {
  const col = ['var(--red)', 'var(--och)', 'var(--blu)'], f = x => x.toFixed(1);
  const draw = (cx, cy, R, coils, T, names, lab) => {
    let g = `<text x="${cx}" y="${cy - R - 28}" text-anchor="middle" class="b">${lab}</text>`;
    for (const [a, b, k] of coils) g += `<line x1="${f(cx + R * a.re)}" y1="${f(cy - R * a.im)}" x2="${f(cx + R * b.re)}" y2="${f(cy - R * b.im)}" style="stroke:${col[k]};stroke-width:5;stroke-linecap:round"/>`;
    T.forEach((p, k) => { g += `<circle cx="${f(cx + R * p.re)}" cy="${f(cy - R * p.im)}" r="5" class="dot"/><text x="${f(cx + (R + 18) * p.re / Math.max(cabs(p), 1e-6) * Math.max(cabs(p), 0.4))}" y="${f(cy - (R + 18) * p.im / Math.max(cabs(p), 1e-6) * Math.max(cabs(p), 0.4) + 5)}" text-anchor="middle" class="b">${names[k]}</text>`; });
    return g;
  };
  /* natočení: fázor A svisle nahoru (12 h) */
  const rot = x => cmul(x, cpol(1, 90 * DEG)), U = r.U.map(rot), u = r.u.map(rot), rc = c => c.map(([a, b, k]) => [rot(a), rot(b), k]);
  const sU = 1 / Math.max(...U.map(cabs)), su = 1 / Math.max(...u.map(cabs)), sc = (c, s) => c.map(([a, b, k]) => [csc(a, s), csc(b, s), k]);
  let g = draw(130, 200, 95, sc(rc(r.pc), sU), U.map(x => csc(x, sU)), ['A', 'B', 'C'], 'vstup (VN): ' + (v.pr === 'Y' ? 'Y' : 'D'));
  g += draw(380, 200, 95, sc(rc(r.coils), su), u.map(x => csc(x, su)), ['a', 'b', 'c'], 'výstup (NN): ' + v.se[0]);
  /* ciferník */
  const cx = 590, cy = 200, R = 80; g += `<circle cx="${cx}" cy="${cy}" r="${R}" style="fill:var(--panel);stroke:var(--ink);stroke-width:2"/><text x="${cx}" y="${cy - R - 28}" text-anchor="middle" class="b">hodinový úhel</text>`;
  for (let k = 0; k < 12; k++) { const a = k * 30 * DEG; g += `<text x="${f(cx + (R - 14) * Math.sin(a))}" y="${f(cy - (R - 14) * Math.cos(a) + 5)}" text-anchor="middle" class="sm">${k || 12}</text>`; }
  const ah = r.h * 30 * DEG;
  g += `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R + 4}" style="stroke:var(--ink);stroke-width:5"/><line x1="${cx}" y1="${cy}" x2="${f(cx + (R - 30) * Math.sin(ah))}" y2="${f(cy - (R - 30) * Math.cos(ah))}" style="stroke:var(--red);stroke-width:7;stroke-linecap:round"/><circle cx="${cx}" cy="${cy}" r="6" class="dot"/>`;
  g += `<text x="${cx}" y="${cy + R + 26}" text-anchor="middle" class="b">U_A (dlouhá) · U_a (krátká)</text>`;
  return `<svg viewBox="0 0 700 340" role="img" aria-label="Hodinový úhel transformátoru">${g}</svg>`;
}
FAZ.hod = {
  n: 'Hodinový úhel',
  p: [['pre', 'Předvolba', 'sel', HOD_PRE, 0, 'Yd1', ''], ['pr', 'Vinutí VN', 'sel', [['Y', 'hvězda Y'], ['D1', 'trojúhelník D (cívka A mezi A–B)'], ['D2', 'trojúhelník D (cívka A mezi A–C)']], 0, 'Y', ''],
    ['se', 'Vinutí NN', 'sel', [['y', 'hvězda y'], ['d1', 'trojúhelník d (cívka a mezi a–b)'], ['d2', 'trojúhelník d (cívka a mezi a–c)'], ['z1', 'lomená hvězda z (a + −b)'], ['z2', 'lomená hvězda z (a + −c)']], 0, 'd1', ''],
    ['pol', 'Smysl vinutí NN', 'sel', [['+', 'souhlasný'], ['-', 'opačný (začátek ↔ konec)']], 0, '+', ''], ['sh', 'Označení svorek NN', 'sel', [['0', 'a, b, c na sloupcích 1, 2, 3'], ['1', 'posunuto o jeden sloupek'], ['2', 'posunuto o dva sloupky']], 0, '0', '']],
  calc(v) {
    const r = hodCalc(v), name = (v.pr === 'Y' ? 'Y' : 'D') + v.se[0] + r.h;
    return {
      svg: hodSVG(r, v),
      out: [['Skupina spojení', name], ['Hodinový úhel', r.h + ' h = ' + r.h * 30 + '° (NN se zpožďuje)'], ['Převod sdružených napětí', 'U_ab/U_AB ∝ ' + fmt(cabs(csub(r.u[0], r.u[1])) / cabs(csub(r.U[0], r.U[1])), 3) + ' (při stejném počtu závitů cívek)']],
      note: 'Barva = sloupek jádra: cívky na stejném sloupku mají napětí ve fázi (nebo v protifázi při opačném smyslu vinutí). ' + (r.h % 2 ? 'Liché číslo: jedno vinutí je ve hvězdě a druhé v trojúhelníku (nebo z), posun o 30° nelze dosáhnout jen přeznačením svorek.' : 'Sudé číslo: obě vinutí stejného typu, nebo kombinace s lomenou hvězdou.') + ' Přeznačení svorek mění úhel o 4 h, opačný smysl vinutí o 6 h.'
    };
  },
  txt: 'Hodinový úhel říká, o kolik násobků 30° se fázor napětí strany NN (svorka a) zpožďuje za fázorem napětí strany VN (svorka A). Dlouhá ručka (VN) ukazuje na 12, krátká (NN) na číslo skupiny. Postup: nakreslete fázory napětí cívek VN podle zapojení, cívky na stejném sloupku jádra mají na NN straně napětí stejného směru, pak je pospojujte podle zapojení NN a odečtěte úhel mezi fázorem A (od středu) a a (od středu). Paralelně lze spojit jen transformátory se stejným hodinovým úhlem.'
};
fazV.hod = {}; for (const p of FAZ.hod.p) fazV.hod[p[0]] = p[5];
function hodPreset(name) {
  if (name === 'x') return;
  const P = name[0] === 'Y' ? ['Y'] : ['D1', 'D2'], S = name[1] === 'y' ? ['y'] : name[1] === 'd' ? ['d1', 'd2'] : ['z1', 'z2'], h = +name.slice(2);
  for (const sh of ['0', '1', '2']) for (const pol of ['+', '-']) for (const pr of P) for (const se of S) { const v = { pr, se, pol, sh }; if (hodCalc(v).h === h) { Object.assign(fazV.hod, v); return; } }
}
hodPreset('Yd1');
document.addEventListener('change', e => {
  const id = e.target.dataset && e.target.dataset.fz; if (fazK !== 'hod' || !id) return;
  if (id === 'pre') { hodPreset(e.target.value); renderFaz($('#cards')); }
  else { fazV.hod.pre = 'x'; const s = document.querySelector('[data-fz="pre"]'); if (s) s.value = 'x'; }
});
