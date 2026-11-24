/* ===== Záložka Točivé pole ===== */
const PO = { wt: 0, play: true, spd: 90, I: [1, 1, 1], ph: [0, -120, 120], geo: '3f', vec: true, seq: true, trail: true, pre: 'sym' };
const PO_PRE = {
  sym: { n: 'Souměrné 3f', I: [1, 1, 1], ph: [0, -120, 120], geo: '3f', t: 'Souměrné trojfázové proudy ve vinutí posunutém o 120°: výsledné pole má stálou velikost 3/2 amplitudy jedné fáze a otáčí se rovnoměrně (kruhové pole). Zpětná složka je nulová.' },
  rev: { n: 'Opačný sled', I: [1, 1, 1], ph: [0, 120, -120], geo: '3f', t: 'Přehozením dvou fází se obrátí sled proudů a pole se točí opačně: na tom je založena reverzace asynchronního motoru a brzdění protiproudem.' },
  unb: { n: 'Nesouměrné', I: [1, 0.5, 1], ph: [0, -120, 120], geo: '3f', t: 'Nesouměrné proudy: kromě sousledné složky vznikne i zpětná, která se točí opačně. Jejich součet opisuje elipsu (eliptické pole). Zpětné pole v motoru brzdí a zvyšuje ztráty.' },
  one: { n: 'Jedna fáze', I: [1, 0, 0], ph: [0, -120, 120], geo: '3f', t: 'Jen jedna cívka: pole pulzuje na místě (mění velikost i smysl, ale neotáčí se). Podle Leblancova teorému je to součet dvou stejně velkých protiběžných točivých polí poloviční amplitudy – proto jednofázový motor nemá záběrný moment.' },
  loss: { n: 'Výpadek fáze', I: [1, 1, 0], ph: [0, 180, 0], geo: '3f', t: 'Přerušená fáze L3 u motoru do hvězdy: zbylé dvě fáze jsou v sérii a teče jimi týž proud opačného smyslu (i_b = −i_a). Pole pulzuje v ose mezi cívkami a a b, motor se z klidu nerozběhne a běžící motor se přetěžuje.' },
  two: { n: 'Dvoufázové 90°', I: [1, 1, 0], ph: [0, -90, 0], geo: '2f', t: 'Dvě cívky posunuté o 90° napájené proudy posunutými o 90°: opět kruhové točivé pole, tentokrát s amplitudou jedné fáze. Tak pracuje jednofázový motor s pomocnou fází a kondenzátorem.' },
  twou: { n: 'Dvoufázové nesouměrné', I: [1, 0.73, 0], ph: [0, -90, 0], geo: '2f', t: 'Příklad z knihy: fáze se 110 a 80 závity posunuté o 90°. Amplitudy mmn jsou různé, pole je točivé eliptické.' }
};
const PCOL = ['var(--red)', 'var(--och)', 'var(--blu)'];
let poRaf = 0, poLast = 0;
const poAx = () => PO.geo === '2f' ? [0, 90] : [0, 120, 240];
function poState(wtDeg) {
  const ax = poAx(), r = Math.PI / 180, wt = wtDeg * r; let Fx = 0, Fy = 0; const ph = [];
  ax.forEach((a, k) => { const i = PO.I[k] * Math.cos(wt + PO.ph[k] * r); ph.push(i); Fx += i * Math.cos(a * r); Fy += i * Math.sin(a * r); });
  /* rozklad: F = F₊ e^{jωt} + F₋ e^{−jωt} */
  let pr = 0, pi_ = 0, nr = 0, ni = 0;
  ax.forEach((a, k) => { const I2 = PO.I[k] / 2; pr += I2 * Math.cos((PO.ph[k] + a) * r); pi_ += I2 * Math.sin((PO.ph[k] + a) * r); nr += I2 * Math.cos((a - PO.ph[k]) * r); ni += I2 * Math.sin((a - PO.ph[k]) * r); });
  const Fp = [pr * Math.cos(wt) - pi_ * Math.sin(wt), pr * Math.sin(wt) + pi_ * Math.cos(wt)], Fn = [nr * Math.cos(-wt) - ni * Math.sin(-wt), nr * Math.sin(-wt) + ni * Math.cos(-wt)];
  return { ax, ph, F: [Fx, Fy], Fp, Fn, ap: Math.hypot(pr, pi_), an: Math.hypot(nr, ni) };
}
function poField() {
  const S = poState(PO.wt), W = 460, cx = 230, cy = 230, R = 200, rb = 140, sc = 82, r = Math.PI / 180;
  const P = (x, y) => [cx + x * sc, cy - y * sc];
  let g = `<defs>${['k', 'r', 'o', 'b', 'g'].map((k, i) => `<marker id="pm${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:${['var(--ink)', 'var(--red)', 'var(--och)', 'var(--blu)', 'var(--mut)'][i]}"/></marker>`).join('')}</defs>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${R}" class="pfe"/><circle cx="${cx}" cy="${cy}" r="${rb + 18}" class="pgap"/>`;
  S.ax.forEach((a, k) => {
    const i = S.ph[k], amp = Math.max(1e-6, Math.max(...PO.I));
    for (const sd of [1, -1]) {                                            /* strany cívky: ⊙ na a+90°, ⊗ na a−90° */
      const t = (a + sd * 90) * r, x = cx + (rb + 30) * Math.cos(t), y = cy - (rb + 30) * Math.sin(t), v = sd * i / amp, al = Math.min(1, Math.abs(v));
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" style="fill:${v >= 0 ? 'var(--red)' : 'var(--blu)'};fill-opacity:${(0.1 + 0.9 * al).toFixed(2)};stroke:${PCOL[k]};stroke-width:3"/>`;
      if (v > 0.06) g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="pkf"/>`; else if (v < -0.06) g += `<path d="M${(x - 6).toFixed(1)} ${(y - 6).toFixed(1)}l12 12M${(x + 6).toFixed(1)} ${(y - 6).toFixed(1)}l-12 12" class="pkx"/>`;
      const lx = cx + (R + 14) * Math.cos(t), ly = cy - (R + 14) * Math.sin(t);
      g += `<text x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="middle" class="plb" style="fill:${PCOL[k]}">${sd > 0 ? '' : '−'}${'abc'[k]}</text>`;
    }
    const [ex, ey] = P(1.65 * Math.cos(a * r), 1.65 * Math.sin(a * r)); g += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="pax" style="stroke:${PCOL[k]}"/><text x="${ex.toFixed(1)}" y="${(ey - 4).toFixed(1)}" class="psm" style="fill:${PCOL[k]}">osa ${'abc'[k]}</text>`;
  });
  if (PO.trail) { let d = ''; for (let k = 0; k <= 120; k++) { const s = poState(k * 3), [x, y] = P(s.F[0], s.F[1]); d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); } g += `<path d="${d}" class="ptr"/>`; }
  if (PO.vec) {                                                            /* příspěvky fází řetězeně */
    let x0 = 0, y0 = 0;
    S.ax.forEach((a, k) => { const x1 = x0 + S.ph[k] * Math.cos(a * r), y1 = y0 + S.ph[k] * Math.sin(a * r), [sx, sy] = P(x0, y0), [tx, ty] = P(x1, y1); if (Math.hypot(tx - sx, ty - sy) > 2) g += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${tx.toFixed(1)}" y2="${ty.toFixed(1)}" class="pvec" style="stroke:${PCOL[k]}" marker-end="url(#pm${'rob'[k]})"/>`; x0 = x1; y0 = y1; });
  }
  if (PO.seq) for (const [v, cl, nm] of [[S.Fp, 'pfp', 'F₊'], [S.Fn, 'pfn', 'F₋']]) { const [x, y] = P(v[0], v[1]); if (Math.hypot(v[0], v[1]) > 0.02) g += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="${cl}" marker-end="url(#pmg)"/><text x="${(x + 6).toFixed(1)}" y="${(y - 6).toFixed(1)}" class="psm">${nm}</text>`; }
  const [fx, fy] = P(S.F[0], S.F[1]);
  if (Math.hypot(S.F[0], S.F[1]) > 0.02) g += `<line x1="${cx}" y1="${cy}" x2="${fx.toFixed(1)}" y2="${fy.toFixed(1)}" class="pres" marker-end="url(#pmk)"/><text x="${(fx + 8).toFixed(1)}" y="${(fy + 16).toFixed(1)}" class="plb">F</text>`;
  g += `<circle cx="${cx}" cy="${cy}" r="4" class="pkf"/>`;
  return [`<svg viewBox="-10 -10 ${W + 20} ${W + 20}" class="pfield" role="img" aria-label="Točivé magnetické pole">${g}</svg>`, S];
}
function poWave(S) {
  const W = 520, H = 230, X = a => 40 + (W - 50) * a / 360, A = Math.max(1, ...PO.I), Y = v => H / 2 - v / A * (H / 2 - 22), r = Math.PI / 180;
  let g = `<line x1="40" x2="${W - 10}" y1="${Y(0)}" y2="${Y(0)}" class="pgr"/>`;
  for (const a of [0, 90, 180, 270, 360]) g += `<text x="${X(a)}" y="${H - 4}" text-anchor="middle" class="psm">${a}°</text><line x1="${X(a)}" x2="${X(a)}" y1="14" y2="${H - 20}" class="pgr2"/>`;
  S.ax.forEach((_, k) => { if (!PO.I[k]) return; let d = ''; for (let a = 0; a <= 360; a += 4) d += (a ? 'L' : 'M') + X(a).toFixed(1) + ' ' + Y(PO.I[k] * Math.cos((a + PO.ph[k]) * r)).toFixed(1); g += `<path d="${d}" class="pwv" style="stroke:${PCOL[k]}"/><circle cx="${X(PO.wt % 360).toFixed(1)}" cy="${Y(S.ph[k]).toFixed(1)}" r="5" style="fill:${PCOL[k]}"/><text x="${(X(PO.wt % 360) + 8).toFixed(1)}" y="${(Y(S.ph[k]) + 4).toFixed(1)}" class="plb" style="fill:${PCOL[k]}">i${'abc'[k]}</text>`; });
  g += `<line x1="${X(PO.wt % 360)}" x2="${X(PO.wt % 360)}" y1="10" y2="${H - 20}" class="pcur"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="pwave" role="img" aria-label="Průběhy fázových proudů">${g}</svg>`;
}
function poInfo(S) {
  const ap = S.ap, an = S.an, typ = an < 0.02 * Math.max(ap, 1e-9) ? 'kruhové točivé' : Math.abs(ap - an) < 0.02 * Math.max(ap, an, 1e-9) ? 'pulzující (neotáčí se)' : 'eliptické točivé';
  const dir = ap > an + 1e-6 ? 'proti směru hodinových ručiček (a → b → c)' : an > ap + 1e-6 ? 'po směru hodinových ručiček (opačný sled)' : '–';
  return `<table class="fzout"><tbody><tr><td>Druh pole</td><td>${typ}</td></tr><tr><td>Smysl otáčení</td><td>${dir}</td></tr><tr><td>|F| v tomto okamžiku</td><td>${fmt(Math.hypot(...S.F), 2)}</td></tr><tr><td>Sousledná složka |F₊|</td><td>${fmt(ap, 3)}</td></tr><tr><td>Zpětná složka |F₋|</td><td>${fmt(an, 3)}</td></tr><tr><td>Poloosy elipsy |F₊| ± |F₋|</td><td>${fmt(ap + an, 2)} / ${fmt(Math.abs(ap - an), 2)}</td></tr></tbody></table>`;
}
const poSl = (id, l, min, max, st, v, u) => `<label class="fr"><span><span>${l}</span> <b id="pov-${id}">${fmt(v, st < 1 ? 2 : 0)} ${u}</b></span><input type="range" data-po="${id}" min="${min}" max="${max}" step="${st}" value="${v}"></label>`;
function renderPole(el) {
  const pre = PO_PRE[PO.pre];
  el.innerHTML = `<div class="wrap"><h2>Točivé magnetické pole</h2><p class="lead">Tři cívky posunuté o 120° (nebo dvě o 90°) a jejich proudy. Barevné šipky jsou příspěvky jednotlivých fází, černá šipka výsledné magnetomotorické napětí F, šedá čára jeho dráha za periodu. Čárkovaně rozklad na sousledné a zpětné točivé pole.</p>
<div class="cbar"><span class="seg pseg">${Object.entries(PO_PRE).map(([k, p]) => `<button type="button" data-pop="${k}" aria-pressed="${PO.pre === k}">${p.n}</button>`).join('')}</span></div>
<div class="pgrid"><figure class="sch pfig" id="po-f"></figure><div class="pside"><div class="fzctl"><div class="lrow"><button type="button" class="btn big" id="po-go">${PO.play ? '❚❚ Zastavit' : '▶ Spustit'}</button><label class="chk"><input type="checkbox" data-poc="vec"${PO.vec ? ' checked' : ''}><span>příspěvky fází</span></label><label class="chk"><input type="checkbox" data-poc="seq"${PO.seq ? ' checked' : ''}><span>F₊ a F₋</span></label><label class="chk"><input type="checkbox" data-poc="trail"${PO.trail ? ' checked' : ''}><span>dráha</span></label></div>
<div class="fzrows">${poSl('wt', 'ωt', 0, 360, 1, Math.round(PO.wt % 360), '°')}${poSl('spd', 'Rychlost animace', 10, 360, 10, PO.spd, '°/s')}
${[0, 1, 2].filter(k => PO.geo === '3f' || k < 2).map(k => poSl('I' + k, `Amplituda i<sub>${'abc'[k]}</sub>`, 0, 1.5, 0.05, PO.I[k], '')).join('')}
${[1, 2].filter(k => PO.geo === '3f' || k < 2).map(k => poSl('p' + k, `Fáze i<sub>${'abc'[k]}</sub> vůči i<sub>a</sub>`, -180, 180, 5, PO.ph[k], '°')).join('')}</div>
<div id="po-info"></div></div></div></div>
<div class="pgrid2"><figure class="sch" id="po-w"></figure><div><h3>Co ukázka ukazuje</h3><p id="po-txt">${sub(pre ? pre.t : 'Vlastní nastavení.')}</p></div></div>
<div class="arts one"><article><h3>Jak pole vzniká</h3>
<p>Cívka fáze k s osou natočenou o úhel α<sub>k</sub> vytváří pulzující magnetomotorické napětí ve směru své osy: F<sub>k</sub> = N i<sub>k</sub>(t) e<sup>jα<sub>k</sub></sup>. Výsledné pole je jejich vektorový součet. Pro proudy i<sub>k</sub> = I<sub>k</sub> cos(ωt + φ<sub>k</sub>) platí</p>
<p class="peq">F(t) = F₊ e<sup>jωt</sup> + F₋ e<sup>−jωt</sup>, &nbsp; F₊ = ½ Σ I<sub>k</sub> e<sup>j(α<sub>k</sub> + φ<sub>k</sub>)</sup>, &nbsp; F₋ = ½ Σ I<sub>k</sub> e<sup>j(α<sub>k</sub> − φ<sub>k</sub>)</sup>.</p>
<p>Sousledná složka F₊ se točí ve smyslu sledu fází, zpětná F₋ opačně. U souměrného trojfázového vinutí (α = 0°, 120°, 240°) se souměrnými proudy (φ = 0°, −120°, +120°) je F₋ = 0 a |F₊| = 3/2 I: pole je kruhové a točí se synchronní rychlostí n<sub>s</sub> = 60 f/p. Pro p pólových dvojic se pole za jednu periodu otočí jen o 1/p otáčky.</p>
<p>Jakákoli nesouměrnost dá nenulovou F₋ a pole je eliptické; když |F₊| = |F₋|, pole jen pulzuje (jednofázové vinutí, výpadek fáze). V laboratoři totéž uvidíte uvnitř asynchronního motoru: drážky statoru obarvené podle proudu a pole ve vzduchové mezeře.</p></article></div></div>`;
  poDraw(); poStart();
}
function poDraw() {
  const f = $('#po-f'); if (!f) return;
  const [svg, S] = poField(); f.innerHTML = svg; $('#po-w').innerHTML = poWave(S); $('#po-info').innerHTML = poInfo(S);
  const w = document.querySelector('[data-po="wt"]'); if (w && document.activeElement !== w) { w.value = Math.round(PO.wt % 360); $('#pov-wt').textContent = Math.round(PO.wt % 360) + ' °'; }
}
function poLoop(ts) {
  poRaf = 0; if (tab !== 'pole' || !$('#po-f')) { poLast = 0; return; }
  const dt = poLast ? Math.min(0.05, (ts - poLast) / 1000) : 0; poLast = ts;
  if (PO.play) { PO.wt = (PO.wt + PO.spd * dt) % 360; poDraw(); }
  poRaf = requestAnimationFrame(poLoop);
}
function poStart() { if (!poRaf) { poLast = 0; poRaf = requestAnimationFrame(poLoop); } }
document.addEventListener('click', e => {
  if (tab !== 'pole') return;
  const b = e.target.closest('[data-pop]');
  if (b) { const p = PO_PRE[b.dataset.pop]; Object.assign(PO, { I: [...p.I], ph: [...p.ph], geo: p.geo, pre: b.dataset.pop }); renderPole($('#cards')); return; }
  if (e.target.id === 'po-go') { PO.play = !PO.play; e.target.textContent = PO.play ? '❚❚ Zastavit' : '▶ Spustit'; }
});
document.addEventListener('input', e => {
  if (tab !== 'pole') return;
  const k = e.target.dataset && e.target.dataset.po; if (!k) return;
  const v = +e.target.value;
  if (k === 'wt') { PO.wt = v; PO.play = false; const g = $('#po-go'); if (g) g.textContent = '▶ Spustit'; }
  else if (k === 'spd') PO.spd = v;
  else if (k[0] === 'I') { PO.I[+k[1]] = v; PO.pre = null; }
  else if (k[0] === 'p') { PO.ph[+k[1]] = v; PO.pre = null; }
  const o = document.getElementById('pov-' + k); if (o) o.textContent = fmt(v, +e.target.step < 1 ? 2 : 0) + (k === 'wt' || k[0] === 'p' ? ' °' : k === 'spd' ? ' °/s' : '');
  if (!PO.pre) { document.querySelectorAll('[data-pop]').forEach(x => x.setAttribute('aria-pressed', 'false')); const t = $('#po-txt'); if (t) t.textContent = 'Vlastní nastavení: sledujte, jak se mění velikost zpětné složky F₋ a tvar dráhy.'; }
  poDraw();
});
document.addEventListener('change', e => { if (tab !== 'pole') return; const k = e.target.dataset && e.target.dataset.poc; if (k) { PO[k] = e.target.checked; poDraw(); } });
