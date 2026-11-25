/* ===== Transformace souřadnic: abc → αβ0 (Clarke) → dq (Park) ===== */
const TF = { A: [1, 1, 1], dph: [0, 0, 0], h5: 0, off: 0, seq: '+', fr: 'sync', k: 0.5, th0: 0, inv: 'amp', sp: 0.5, run: true, t: 0, show: { parts: true, proj: true, dq: true, trace: true } };
let tfRaf = 0, tfLast = 0, tfHist = [];
const TFW = 2 * Math.PI;  /* úhlový kmitočet vizualizace: 1 perioda = 1 s „modelového“ času */
function tfSig(t) {
  const s = TF.seq === '+' ? 1 : -1;
  return [0, 1, 2].map(k => TF.A[k] * Math.cos(TFW * t - s * k * 2 * Math.PI / 3 + TF.dph[k] * DEG) + TF.h5 * Math.cos(5 * (TFW * t - s * k * 2 * Math.PI / 3)) + TF.off);
}
function tfClarke(i, inv) {
  const K = inv === 'pow' ? Math.sqrt(2 / 3) : 2 / 3, K0 = inv === 'pow' ? 1 / Math.sqrt(3) : 1 / 3;
  return { al: K * (i[0] - 0.5 * i[1] - 0.5 * i[2]), be: K * (SQ3 / 2) * (i[1] - i[2]), z: K0 * (i[0] + i[1] + i[2]) };
}
function tfPark(al, be, th) { return { d: al * Math.cos(th) + be * Math.sin(th), q: -al * Math.sin(th) + be * Math.cos(th) }; }
function tfInvPark(d, q, th) { return { al: d * Math.cos(th) - q * Math.sin(th), be: d * Math.sin(th) + q * Math.cos(th) }; }
function tfInvClarke(al, be, z, inv) {
  const K = inv === 'pow' ? Math.sqrt(2 / 3) : 1, K0 = inv === 'pow' ? 1 / Math.sqrt(3) : 1;
  return [K * al + K0 * z, K * (-0.5 * al + SQ3 / 2 * be) + K0 * z, K * (-0.5 * al - SQ3 / 2 * be) + K0 * z];
}
function tfTheta(t) { return TF.fr === 'sync' ? TFW * t + TF.th0 * DEG : TF.fr === 'slow' ? TF.k * TFW * t + TF.th0 * DEG : TF.th0 * DEG; }
function tfState(t) { const i = tfSig(t), c = tfClarke(i, TF.inv), th = tfTheta(t), p = tfPark(c.al, c.be, th); return { t, i, ...c, th, ...p }; }

function tfPlane(S) {
  const W = 460, cx = 230, cy = 230, R = 140, f = v => v.toFixed(1), amp = TF.inv === 'pow' ? Math.sqrt(1.5) : 1;
  const sc = R / Math.max(1.6 * amp, 0.2), P = (x, y) => [cx + sc * x, cy - sc * y];
  const ln = (a, b, cls, st = '') => { const [x1, y1] = P(...a), [x2, y2] = P(...b); return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="${cls}" ${st}/>`; };
  const ar = (a, b, cls, w) => { const [x1, y1] = P(...a), [x2, y2] = P(...b); return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" class="${cls}" style="stroke-width:${w}" marker-end="url(#tfa-${cls})"/>`; };
  const tx = (p, t, cls = 'b', anc = 'middle') => { const [x, y] = P(...p); return `<text x="${f(x)}" y="${f(y)}" text-anchor="${anc}" class="${cls}">${t}</text>`; };
  const cols = ['tfa', 'tfb', 'tfc'], ang = [0, 120, 240].map(a => a * DEG), Lr = 1.55 * amp;
  let g = `<defs>${['tfa', 'tfb', 'tfc', 'tfv', 'tfd', 'tfq'].map(c => `<marker id="tfa-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="${c}f"/></marker>`).join('')}</defs>`;
  g += `<circle cx="${cx}" cy="${cy}" r="${f(sc * amp)}" class="tfcir"/>`;
  ang.forEach((a, k) => { g += ln([-Lr * Math.cos(a), -Lr * Math.sin(a)], [Lr * Math.cos(a), Lr * Math.sin(a)], 'tfax ' + cols[k]) + tx([1.68 * amp * Math.cos(a), 1.68 * amp * Math.sin(a) - 0.04], 'osa ' + 'abc'[k], 'b ' + cols[k] + 't'); });
  g += tx([1.62 * amp, 0.12], 'α', 'b') + tx([0.1, 1.6 * amp], 'β', 'b');
  if (TF.show.trace && tfHist.length > 1) { g += `<path d="M${tfHist.map(h => P(h.al, h.be).map(f).join(' ')).join('L')}" class="tftr"/>`; }
  /* skládání: příspěvky fází K·i_k ve směru os */
  const K = TF.inv === 'pow' ? Math.sqrt(2 / 3) : 2 / 3;
  if (TF.show.parts) { let p = [0, 0]; S.i.forEach((v, k) => { const q = [p[0] + K * v * Math.cos(ang[k]), p[1] + K * v * Math.sin(ang[k])]; g += ar(p, q, cols[k], 3); p = q; }); }
  /* projekce na osy fází */
  if (TF.show.proj) ang.forEach((a, k) => { const pr = S.al * Math.cos(a) + S.be * Math.sin(a), q = [pr * Math.cos(a), pr * Math.sin(a)]; g += ln([S.al, S.be], q, 'tfpr') + `<circle cx="${f(P(...q)[0])}" cy="${f(P(...q)[1])}" r="4" class="${cols[k]}f"/>`; });
  /* dq */
  if (TF.show.dq) {
    const th = S.th, d = [Math.cos(th), Math.sin(th)], q = [-Math.sin(th), Math.cos(th)], L = 1.45 * amp;
    g += ln([-L * d[0], -L * d[1]], [L * d[0], L * d[1]], 'tfdx') + ln([-L * q[0], -L * q[1]], [L * q[0], L * q[1]], 'tfqx');
    g += tx([1.52 * amp * d[0], 1.52 * amp * d[1]], 'd', 'b tfdt') + tx([1.52 * amp * q[0], 1.52 * amp * q[1]], 'q', 'b tfqt');
    g += ar([0, 0], [S.d * d[0], S.d * d[1]], 'tfd', 5) + ar([S.d * d[0], S.d * d[1]], [S.al, S.be], 'tfq', 5);
  }
  g += ar([0, 0], [S.al, S.be], 'tfv', 4) + `<circle cx="${cx}" cy="${cy}" r="4" class="dot"/>`;
  return `<svg viewBox="0 0 ${W} ${W}" class="sch tfp" role="img" aria-label="Prostorový vektor v rovině αβ">${g}</svg>`;
}
function tfTime(S) {
  const W = 620, H = 340, x0 = 40, x1 = W - 10, Tw = 2, t0 = S.t - Tw, f = v => v.toFixed(1), amp = TF.inv === 'pow' ? Math.sqrt(1.5) : 1;
  const yA = (v, top, h, m) => top + h / 2 - (h / 2 - 6) * v / m, X = t => x0 + (x1 - x0) * (t - t0) / Tw;
  const m1 = Math.max(1.2, Math.max(...TF.A) + Math.abs(TF.h5) + Math.abs(TF.off)), m2 = 1.6 * amp;
  let g = '';
  const panel = (top, h, m, series, lab) => {
    let s = `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${h}" class="tfbg"/><line x1="${x0}" x2="${x1}" y1="${top + h / 2}" y2="${top + h / 2}" class="max"/><text x="${x0 - 6}" y="${top + 14}" text-anchor="end" class="sm">${fmt(m, 1)}</text><text x="${x0 + 6}" y="${top + 14}" class="sm">${lab}</text>`;
    for (const [fn, cls] of series) { let d = ''; for (let k = 0; k <= 240; k++) { const t = t0 + Tw * k / 240, v = fn(t); d += (k ? 'L' : 'M') + f(X(t)) + ' ' + f(yA(v, top, h, m)); } s += `<path d="${d}" class="tfl ${cls}"/>`; }
    return s;
  };
  const st = t => tfState(t);
  g += panel(4, 160, m1, [[t => tfSig(t)[0], 'tfa'], [t => tfSig(t)[1], 'tfb'], [t => tfSig(t)[2], 'tfc']], 'i_a, i_b, i_c');
  g += panel(174, 160, m2, [[t => st(t).al, 'tfal'], [t => st(t).be, 'tfbe'], [t => st(t).d, 'tfd'], [t => st(t).q, 'tfq'], [t => st(t).z, 'tf0']], 'α, β (tenké) · d, q (silné) · 0 (tečkovaně)');
  g += `<line x1="${f(X(S.t))}" x2="${f(X(S.t))}" y1="4" y2="${H - 6}" class="tfcur"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="sch tft" role="img" aria-label="Časové průběhy">${figSub(g)}</svg>`;
}
function tfVals(S) {
  const r = (a, b) => `<tr><td>${sub(a)}</td><td>${b}</td></tr>`, n = v => fmt(v, 3);
  return `<table class="fzout">${r('i_a, i_b, i_c', S.i.map(n).join(' ; '))}${r('i_α, i_β', n(S.al) + ' ; ' + n(S.be))}${r('i_0 (netočivá)', n(S.z))}${r('|i|, úhel vektoru', n(Math.hypot(S.al, S.be)) + ' ; ' + fmt(Math.atan2(S.be, S.al) / DEG, 0) + '°')}${r('θ (natočení osy d)', fmt(((S.th / DEG) % 360 + 360) % 360, 0) + '°')}${r('i_d, i_q', n(S.d) + ' ; ' + n(S.q))}</table>`;
}
function tfCtlHTML() {
  const seg = (attr, cur, opts) => `<span class="seg">${opts.map(([k, t]) => `<button type="button" ${attr}="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</span>`;
  const sl = (id, l, a, b, st, v, u = '') => `<label class="lsl"><span><span>${sub(l)}</span> <b id="tfv-${id}">${fmt(v, st < 1 ? 2 : 0)} ${u}</b></span><input type="range" data-tf="${id}" min="${a}" max="${b}" step="${st}" value="${v}"></label>`;
  return `<div class="lgrp"><p class="lgh">Průběhy fází</p>${sl('A0', 'Amplituda fáze a', 0, 1.5, 0.05, TF.A[0])}${sl('A1', 'Amplituda fáze b', 0, 1.5, 0.05, TF.A[1])}${sl('A2', 'Amplituda fáze c', 0, 1.5, 0.05, TF.A[2])}
${sl('d1', 'Fázová chyba fáze b', -60, 60, 5, TF.dph[1], '°')}${sl('h5', '5. harmonická (amplituda)', 0, 0.4, 0.02, TF.h5)}${sl('off', 'Stejnosměrná složka ve všech fázích', -0.5, 0.5, 0.05, TF.off)}
<div class="lrow"><span>Sled fází</span>${seg('data-tfs', TF.seq, [['+', 'sousledný a–b–c'], ['-', 'zpětný a–c–b']])}</div></div>
<div class="lgrp"><p class="lgh">Soustava dq</p><div class="lrow">${seg('data-tff', TF.fr, [['sync', 'točí se s polem (ω)'], ['slow', 'pomaleji (k·ω)'], ['fix', 'stojí']])}</div>
${TF.fr === 'slow' ? sl('k', 'Rychlost soustavy k', -1, 2, 0.05, TF.k, '× ω') : ''}${sl('th0', 'Počáteční natočení θ₀', -180, 180, 5, TF.th0, '°')}
<div class="lrow"><span>Konstanta</span>${seg('data-tfi', TF.inv, [['amp', '2/3 (amplitudová)'], ['pow', '√(2/3) (výkonová)']])}</div>
<div class="lrow"><label>Rychlost<select id="tf-sp">${[[1, '1 perioda/s'], [0.5, '2 s/perioda'], [0.25, '4 s/perioda'], [0.1, '10 s/perioda']].map(([v, t]) => `<option value="${v}"${v === TF.sp ? ' selected' : ''}>${t}</option>`).join('')}</select></label><button type="button" class="btn" id="tf-go">${TF.run ? '❚❚ Zastavit' : '▶ Spustit'}</button><button type="button" class="btn" id="tf-step">+1/24 periody</button></div>
<div class="lrow osct">${[['parts', 'skládání z fází'], ['proj', 'průměty na osy fází'], ['dq', 'osy d, q'], ['trace', 'stopa vektoru']].map(([k, t]) => `<label class="chk"><input type="checkbox" data-tfsh="${k}"${TF.show[k] ? ' checked' : ''}> ${t}</label>`).join('')}</div></div>
<div class="lgrp"><p class="lgh">Rychlé pokusy</p><div class="lrow trpre">${TF_PRE.map((p, i) => `<button type="button" class="btn" data-tfp="${i}">${p[0]}</button>`).join('')}</div><p class="note" id="tf-pn">${TF.note || 'Zvolte pokus, nebo měňte parametry. Co sledovat: v rovině vektor, vpravo průběhy.'}</p></div>`;
}
const TF_PRE = [
  ['Souměrná soustava', { A: [1, 1, 1], dph: [0, 0, 0], h5: 0, off: 0, seq: '+', fr: 'sync', th0: 0 }, 'Vektor opisuje kružnici o poloměru amplitudy (při konstantě 2/3), v soustavě dq jsou i_d a i_q konstantní. Průmět vektoru na osu každé fáze je přesně okamžitá hodnota proudu této fáze.'],
  ['Soustava dq stojí', { A: [1, 1, 1], dph: [0, 0, 0], h5: 0, off: 0, seq: '+', fr: 'fix', th0: 0 }, 'Stojící soustava dq s θ = 0 je totožná s αβ: i_d = i_α, i_q = i_β kmitají síťovým kmitočtem. Park „zastaví“ vektor jen tehdy, když se točí s ním.'],
  ['Zpětný sled', { A: [1, 1, 1], dph: [0, 0, 0], h5: 0, off: 0, seq: '-', fr: 'sync', th0: 0 }, 'Při prohození fází se vektor točí opačně. V soustavě dq, která se točí dopředu, je vidět jako vektor rotující dvojnásobnou rychlostí: i_d, i_q kmitají kmitočtem 2f.'],
  ['Nesouměrnost', { A: [1, 0.6, 1], dph: [0, 0, 0], h5: 0, off: 0, seq: '+', fr: 'sync', th0: 0 }, 'Stopa je elipsa: sousledná složka (kružnice dopředu) + zpětná (kružnice dozadu). V dq je střední hodnota sousledná složka a kmitání 2f zpětná.'],
  ['Stejnosměrná složka (netočivá)', { A: [1, 1, 1], dph: [0, 0, 0], h5: 0, off: 0.3, seq: '+', fr: 'sync', th0: 0 }, 'Stejná hodnota ve všech fázích se do vektoru vůbec nepromítne (příspěvky tří os se vyruší) a objeví se jen v nulové složce i₀. Proto prostorový vektor nestačí, pokud teče proud nulovým vodičem.'],
  ['5. harmonická', { A: [1, 1, 1], dph: [0, 0, 0], h5: 0.2, off: 0, seq: '+', fr: 'sync', th0: 0 }, '5. harmonická je zpětná: vektor obíhá kružnici s „šesticípou“ deformací. V dq (točící se s 1. harmonickou) se projeví kmitáním 6f – typický průběh u diodových usměrňovačů a měničů.'],
  ['Natočení dq o 90°', { A: [1, 1, 1], dph: [0, 0, 0], h5: 0, off: 0, seq: '+', fr: 'sync', th0: 90 }, 'Volba θ₀ jen přerozdělí vektor mezi d a q, jeho velikost se nemění. Ve vektorovém řízení se θ volí tak, aby osa d ležela ve směru toku: pak i_d tvoří tok a i_q moment.'],
];
function renderDq(el) {
  el.innerHTML = `<div class="trf"><h3 style="margin-top:0">Transformace souřadnic: abc → αβ → dq</h3><p class="lead">Pomůcka k prostorovému vektoru, Clarkeově a Parkově transformaci. Nahoře živá ukázka, pod ní kalkulačka, vzorce a nejčastější chyby.</p>
<nav class="toc scroll" aria-label="Obsah"><a href="#tf-live">Ukázka</a><a href="#tf-calc">Kalkulačka</a><a href="#tf-eq">Vzorce</a><a href="#tf-why">Proč a k čemu</a><a href="#tf-pit">Chyby a pasti</a><a href="#tf-q">Otázky</a></nav>
<h4 id="tf-live">Živá ukázka</h4>
<div class="tfgrid"><div class="lgrp"><div id="tf-pl"></div><div id="tf-val"></div></div><div class="lgrp"><div id="tf-tm"></div></div><div id="tf-ctl">${tfCtlHTML()}</div></div>
<h3 id="tf-calc">Kalkulačka</h3><div class="cols2">
<div class="lgrp"><p class="lgh">abc → αβ0 → dq</p><div class="tfin">${['ia', 'ib', 'ic', 'thc'].map((k, j) => `<label>${sub(['i_a', 'i_b', 'i_c', 'θ [°]'][j])}<input type="number" step="any" id="tfc-${k}" value="${[1, -0.5, -0.5, 0][j]}"></label>`).join('')}</div><div id="tfc-out1"></div></div>
<div class="lgrp"><p class="lgh">dq0 → αβ → abc</p><div class="tfin">${['d', 'q', 'z', 'th2'].map((k, j) => `<label>${sub(['i_d', 'i_q', 'i_0', 'θ [°]'][j])}<input type="number" step="any" id="tfc-${k}" value="${[1, 0, 0, 30][j]}"></label>`).join('')}</div><div id="tfc-out2"></div></div></div>
<p class="note">Obě kalkulačky používají konstantu zvolenou v ukázce (teď ${TF.inv === 'pow' ? 'výkonovou √(2/3)' : 'amplitudovou 2/3'}).</p>
${TF_THEORY}</div>`;
  typeset(el); tfCalc(); tfDraw(); tfStart();
}
function tfCalc() {
  const v = id => +($('#tfc-' + id) || {}).value || 0, n = x => fmt(x, 4), r = (a, b) => `<tr><td>${sub(a)}</td><td>${b}</td></tr>`;
  const i = [v('ia'), v('ib'), v('ic')], c = tfClarke(i, TF.inv), p = tfPark(c.al, c.be, v('thc') * DEG);
  const o1 = $('#tfc-out1'); if (o1) o1.innerHTML = `<table class="fzout">${r('i_α', n(c.al))}${r('i_β', n(c.be))}${r('i_0', n(c.z))}${r('|i| = √(i_α² + i_β²)', n(Math.hypot(c.al, c.be)))}${r('úhel vektoru', fmt(Math.atan2(c.be, c.al) / DEG, 2) + '°')}${r('i_d', n(p.d))}${r('i_q', n(p.q))}</table>`;
  const ab = tfInvPark(v('d'), v('q'), v('th2') * DEG), x = tfInvClarke(ab.al, ab.be, v('z'), TF.inv);
  const o2 = $('#tfc-out2'); if (o2) o2.innerHTML = `<table class="fzout">${r('i_α', n(ab.al))}${r('i_β', n(ab.be))}${r('i_a', n(x[0]))}${r('i_b', n(x[1]))}${r('i_c', n(x[2]))}${r('kontrola i_a + i_b + i_c', n(x[0] + x[1] + x[2]))}</table>`;
}
function tfDraw() {
  const S = tfState(TF.t), a = $('#tf-pl'); if (!a) return;
  a.innerHTML = tfPlane(S); $('#tf-tm').innerHTML = tfTime(S); $('#tf-val').innerHTML = tfVals(S);
}
function tfLoop(ts) {
  tfRaf = 0; if (tab !== 'trf' || !$('#tf-pl')) { tfLast = 0; return; }
  const dt = tfLast ? Math.min(0.05, (ts - tfLast) / 1000) : 0; tfLast = ts;
  if (TF.run && dt) { TF.t += dt * TF.sp; const S = tfState(TF.t); tfHist.push({ al: S.al, be: S.be }); if (tfHist.length > 160) tfHist.shift(); tfDraw(); }
  tfRaf = requestAnimationFrame(tfLoop);
}
function tfStart() { if (!tfRaf) { tfLast = 0; tfRaf = requestAnimationFrame(tfLoop); } }
function tfReset() { tfHist = []; $('#tf-ctl').innerHTML = tfCtlHTML(); tfDraw(); tfCalc(); }
document.addEventListener('click', e => {
  if (tab !== 'trf') return; const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (b.id === 'tf-go') { TF.run = !TF.run; b.textContent = TF.run ? '❚❚ Zastavit' : '▶ Spustit'; }
  else if (b.id === 'tf-step') { TF.t += 1 / 24; const S = tfState(TF.t); tfHist.push({ al: S.al, be: S.be }); tfDraw(); }
  else if (d.tfs) { TF.seq = d.tfs; tfReset(); }
  else if (d.tff) { TF.fr = d.tff; tfReset(); }
  else if (d.tfi) { TF.inv = d.tfi; tfReset(); const n = $('.trf .note'); if (n) n.textContent = 'Obě kalkulačky používají konstantu zvolenou v ukázce (teď ' + (TF.inv === 'pow' ? 'výkonovou √(2/3)' : 'amplitudovou 2/3') + ').'; }
  else if (d.tfp) { const [, o, note] = TF_PRE[+d.tfp]; Object.assign(TF, JSON.parse(JSON.stringify(o))); TF.note = note; tfReset(); }
});
document.addEventListener('input', e => {
  if (tab !== 'trf') return; const t = e.target, k = t.dataset.tf;
  if (k) {
    const v = +t.value; if (k[0] === 'A') TF.A[+k[1]] = v; else if (k === 'd1') TF.dph[1] = v; else TF[k] = v;
    const o = $('#tfv-' + k); if (o) o.textContent = fmt(v, +t.step < 1 ? 2 : 0) + (k === 'd1' || k === 'th0' ? ' °' : k === 'k' ? ' × ω' : ''); tfHist = []; tfDraw();
  } else if (t.id && t.id.startsWith('tfc-')) tfCalc();
});
document.addEventListener('change', e => {
  if (tab !== 'trf') return; const t = e.target;
  if (t.id === 'tf-sp') TF.sp = +t.value; else if (t.dataset.tfsh) { TF.show[t.dataset.tfsh] = t.checked; tfDraw(); }
});
const TF_THEORY = `
<h3 id="tf-eq">Vzorce</h3>
<div class="arts"><div class="art"><h4>Prostorový vektor (Clarke, amplitudově invariantní)</h4>
<p>\\[ \\underline{i} = i_\\alpha + j\\,i_\\beta = \\tfrac{2}{3}\\left(i_a + \\underline{a}\\,i_b + \\underline{a}^2 i_c\\right),\\qquad \\underline{a} = e^{j120^\\circ} \\]</p>
<p>\\[ \\begin{bmatrix} i_\\alpha \\\\ i_\\beta \\\\ i_0 \\end{bmatrix} = \\frac{2}{3}\\begin{bmatrix} 1 & -\\tfrac12 & -\\tfrac12 \\\\ 0 & \\tfrac{\\sqrt3}{2} & -\\tfrac{\\sqrt3}{2} \\\\ \\tfrac12 & \\tfrac12 & \\tfrac12 \\end{bmatrix} \\begin{bmatrix} i_a \\\\ i_b \\\\ i_c \\end{bmatrix} \\]</p>
<p>Bez nulové složky (i_a + i_b + i_c = 0) stačí dvě fáze: \\( i_\\alpha = i_a,\\; i_\\beta = (i_a + 2 i_b)/\\sqrt3 \\).</p></div>
<div class="art"><h4>Zpětná transformace</h4>
<p>\\[ i_a = i_\\alpha + i_0,\\quad i_b = -\\tfrac12 i_\\alpha + \\tfrac{\\sqrt3}{2} i_\\beta + i_0,\\quad i_c = -\\tfrac12 i_\\alpha - \\tfrac{\\sqrt3}{2} i_\\beta + i_0 \\]</p>
<p>Tedy \\( i_k = \\mathrm{Re}\\{\\underline{i}\\,e^{-j(k-1)120^\\circ}\\} + i_0 \\): okamžitá hodnota fáze je průmět vektoru na osu této fáze.</p></div>
<div class="art"><h4>Park: do soustavy natočené o θ</h4>
<p>\\[ \\underline{i}_{dq} = i_d + j\\,i_q = \\underline{i}\\,e^{-j\\vartheta} \\]</p>
<p>\\[ \\begin{bmatrix} i_d \\\\ i_q \\end{bmatrix} = \\begin{bmatrix} \\cos\\vartheta & \\sin\\vartheta \\\\ -\\sin\\vartheta & \\cos\\vartheta \\end{bmatrix} \\begin{bmatrix} i_\\alpha \\\\ i_\\beta \\end{bmatrix},\\qquad \\begin{bmatrix} i_\\alpha \\\\ i_\\beta \\end{bmatrix} = \\begin{bmatrix} \\cos\\vartheta & -\\sin\\vartheta \\\\ \\sin\\vartheta & \\cos\\vartheta \\end{bmatrix} \\begin{bmatrix} i_d \\\\ i_q \\end{bmatrix} \\]</p></div>
<div class="art"><h4>Výkon a moment v transformovaných veličinách</h4>
<p>\\[ p = u_a i_a + u_b i_b + u_c i_c = \\tfrac32\\,\\mathrm{Re}\\{\\underline{u}\\,\\underline{i}^*\\} + 3 u_0 i_0 = \\tfrac32 (u_d i_d + u_q i_q) + 3u_0 i_0 \\]</p>
<p>\\[ M = \\tfrac32\\,p_p\\,(\\psi_d i_q - \\psi_q i_d) \\]</p>
<p>Při výkonově invariantní konstantě \\( \\sqrt{2/3} \\) koeficient 3/2 zmizí, ale vektor je \\( \\sqrt{3/2} \\)krát delší než amplituda.</p></div>
<div class="art"><h4>Napěťová rovnice v rotující soustavě</h4>
<p>\\[ \\underline{u} = R\\,\\underline{i} + \\frac{d\\underline{\\psi}}{dt} \\;\\Rightarrow\\; \\underline{u}_{dq} = R\\,\\underline{i}_{dq} + \\frac{d\\underline{\\psi}_{dq}}{dt} + j\\,\\omega_k\\,\\underline{\\psi}_{dq} \\]</p>
<p>Člen \\( j\\omega_k\\underline{\\psi} \\) (ω_k = rychlost soustavy) vzniká derivací \\( e^{j\\vartheta} \\): \\( u_d = R i_d + \\dot\\psi_d - \\omega_k \\psi_q,\\; u_q = R i_q + \\dot\\psi_q + \\omega_k \\psi_d \\). To jsou „vazební“ členy, které se ve vektorovém řízení kompenzují.</p></div>
<div class="art"><h4>Jak se soustava volí</h4><ul><li>Stojící (αβ, ω_k = 0): model asynchronního stroje, odhad toku, PWM.</li><li>S rotorem (ω_k = p·Ω): synchronní stroj, osa d v ose pólů – parametry X_d, X_q jsou pak konstantní.</li><li>S tokem rotoru (ω_k = ω_1): vektorové řízení asynchronního motoru, osa d = směr ψ_2.</li></ul></div></div>
<h3 id="tf-why">Proč a k čemu</h3>
<ul class="lt"><li><b>Tři fáze → jeden komplexní signál.</b> Ve trojvodičové soustavě je součet proudů nulový, takže stačí dvě nezávislé veličiny. Prostorový vektor je zapíše jako jedno komplexní číslo, které má i fyzikální význam: ukazuje, kam míří výsledné magnetické pole vinutí.</li>
<li><b>Proč 2/3.</b> Tři fáze, každá s amplitudou Î, dají součet 3/2·Î (viz točivé pole); konstanta 2/3 to vrátí na Î. Délka vektoru je pak přímo amplituda fázové veličiny a průměty na osy fází dávají okamžité hodnoty.</li>
<li><b>Proč Park.</b> V soustavě, která se točí s vektorem, jsou střídavé veličiny konstantní. Regulátory PI pak regulují stejnosměrné veličiny bez fázového zpoždění, jako u stejnosměrného motoru: i_d ↔ budicí proud, i_q ↔ proud kotvy.</li>
<li><b>Synchronní stroj.</b> V soustavě spojené s rotorem přestanou indukčnosti záviset na natočení (u vyniklých pólů L_d ≠ L_q), rovnice jsou lineární s konstantními koeficienty.</li></ul>
<h3 id="tf-pit">Chyby a pasti</h3>
<ul class="lt"><li><b>Konstanta.</b> Při 2/3 je výkon 3/2·(u_d i_d + u_q i_q); při √(2/3) jen (u_d i_d + u_q i_q). Míchání obou dá chybu 1,5× ve výkonu i momentu.</li>
<li><b>Fázové vs. sdružené.</b> Transformují se fázové veličiny. Délka napěťového vektoru = amplituda fázového napětí, tj. U·√2/√3 (400 V → 326 V).</li>
<li><b>Směr osy q.</b> Obvykle q předbíhá d o 90° (i_dq = i·e^{−jθ}). Některé knihy používají q za d nebo transformaci se sinem (osa a na q) – výsledky se liší znaménkem nebo záměnou d a q.</li>
<li><b>Elektrický vs. mechanický úhel.</b> θ v Parkově transformaci je elektrický: θ = p·θ_mech.</li>
<li><b>Nulová složka.</b> Prostorový vektor ji nevidí. Stejnosměrná složka nebo 3. harmonická společná všem fázím se neprojeví v i_α, i_β.</li>
<li><b>Fázor ≠ prostorový vektor.</b> Fázor popisuje jednu sinusovou veličinu v ustáleném stavu (efektivní hodnota, točí se ω), prostorový vektor všechny tři fáze v libovolném okamžiku i přechodném ději. V ustáleném souměrném stavu platí i = √2·I_fázor·e^{jωt}.</li></ul>
<h3 id="tf-q">Otázky na zkoušku</h3>
${[['Co je prostorový vektor a jak z něj získám okamžitý proud fáze b?', 'Komplexní veličina 2/3(i_a + a·i_b + a²·i_c). Proud fáze b je průmět vektoru na osu b (natočenou o 120°), plus nulová složka: i_b = Re{i·e^{−j120°}} + i_0.'],
['Proč jsou v soustavě dq ustálené veličiny konstantní?', 'Souměrná sinusová soustava dává vektor stálé délky točící se úhlovou rychlostí ω. Soustava dq se točí stejně, takže vektor je vůči ní v klidu.'],
['Co uvidím v dq, když je v síti zpětná složka?', 'Kmitání s dvojnásobným kmitočtem 2f (zpětný vektor se vůči soustavě točí rychlostí −2ω). Sousledná složka je střední hodnota.'],
['Proč se ve vztahu pro moment objevuje 3/2?', 'Kvůli amplitudově invariantní konstantě 2/3: skutečný výkon tří fází je 3/2·Re{u·i*}. Při výkonově invariantní transformaci je koeficient 1.'],
['Odkud se v rovnicích v dq berou členy ω·ψ?', 'Z derivace součinu: ψ = ψ_dq·e^{jθ} ⇒ dψ/dt = (dψ_dq/dt + jω_k·ψ_dq)·e^{jθ}. Jsou to rotační (pohybová) napětí, která vazbou spojují osy d a q.'],
['Jaký je rozdíl mezi Clarkeovou a Parkovou transformací?', 'Clarke převádí tři fáze na dvě kolmé osy, které stojí (αβ). Park otáčí tuto dvojici o úhel θ (dq). Park bez Clarke nemá smysl, Clarke bez Parka ano (stojící soustava).'],
['Proč ve vektorovém řízení asynchronního motoru potřebuji znát polohu toku, a ne rotoru?', 'Rotor se točí se skluzem vůči poli. Rozklad na tokotvornou a momentotvornou složku platí jen v soustavě spojené s tokem rotoru; poloha toku = poloha rotoru + integrál skluzové rychlosti (nepřímé řízení) nebo odhad z modelu.']].map(([q, a]) => `<details class="zq"><summary><span class="zqt">${sub(q)}</span></summary><div class="zqa"><p>${sub(a)}</p></div></details>`).join('')}`;
