/* ===== Laboratoř: velký řez strojem – pole v mezeře, proudy v drážkách, klec, kotva a komutátor ===== */
const IV = { fld: true, ist: true, irt: true, lbl: true };
const ICX = 260, ICY = 260, DEGR = Math.PI / 180;
const ip = (r, th) => [ICX + r * Math.cos(th), ICY - r * Math.sin(th)];       /* matematický úhel, proti směru hodinových ručiček */
const f2 = v => v.toFixed(1);
const iSector = (r1, r2, a0, a1) => { const [x1, y1] = ip(r2, a0), [x2, y2] = ip(r2, a1), [x3, y3] = ip(r1, a1), [x4, y4] = ip(r1, a0), lg = a1 - a0 > Math.PI ? 1 : 0;
  return `M${f2(x1)} ${f2(y1)}A${r2} ${r2} 0 ${lg} 0 ${f2(x2)} ${f2(y2)}L${f2(x3)} ${f2(y3)}A${r1} ${r1} 0 ${lg} 1 ${f2(x4)} ${f2(y4)}Z`; };
/* vodič s proudem: kruh + tečka (⊙ proud k nám) + křížek (⊗ od nás); barvy a znak mění iCond */
const iCondSVG = (id, x, y, r) => `<g id="${id}"><circle cx="${f2(x)}" cy="${f2(y)}" r="${r}" class="icn"/><circle cx="${f2(x)}" cy="${f2(y)}" r="${(r * 0.28).toFixed(1)}" class="icd"/><path d="M${f2(x - r * .5)} ${f2(y - r * .5)}l${f2(r)} ${f2(r)}M${f2(x + r * .5)} ${f2(y - r * .5)}l${f2(-r)} ${f2(r)}" class="icx"/></g>`;
const icache = {};
function iCond(id, v) {                                                    /* v = poměrný proud −1…1 */
  let e = icache[id]; if (!e || !e.g.isConnected) { const g = document.getElementById(id); if (!g) return; e = icache[id] = { g, c: g.children[0], d: g.children[1], x: g.children[2] }; }
  const a = Math.min(1, Math.abs(v)), show = IV.ist || IV.irt;
  e.c.setAttribute('class', 'icn ' + (v >= 0 ? 'pos' : 'neg')); e.c.style.fillOpacity = (0.12 + 0.88 * a).toFixed(2);
  e.d.style.display = v > 0.08 ? '' : 'none'; e.x.style.display = v < -0.08 ? '' : 'none';
}
function iSet(id, op) { const e = document.getElementById(id); if (e) e.style.opacity = op; }
/* fázové pásy trojfázového vinutí (60°): −b, +a, −c, +b, −a, +c se středy 30°, 90°, …, 330° el. */
const BELT = [['b', -1], ['a', 1], ['c', -1], ['b', 1], ['a', -1], ['c', 1]];
const beltOf = eps => BELT[Math.floor((((eps / DEGR) % 360) + 360) % 360 / 60)];
const NS = 24, NB = 28;

function labInsideSVG() {
  const m = L.m; let g = `<defs><marker id="iah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" style="fill:var(--red)"/></marker></defs>`;
  /* vzduchová mezera: barevný prstenec s rozložením indukce */
  const gap = (r1, r2) => { let s = `<g id="igap">`; for (let k = 0; k < 72; k++) s += `<path d="${iSector(r1, r2, k * 5 * DEGR, (k + 1) * 5 * DEGR)}" id="igp${k}" class="igp"/>`; return s + '</g>'; };
  if (m === 'dc') {
    g += `<circle cx="${ICX}" cy="${ICY}" r="248" class="lfe"/><circle cx="${ICX}" cy="${ICY}" r="212" class="lgap"/>`;
    for (const top of [1, -1]) {                                           /* hlavní póly nahoře (N) a dole (S) */
      const yb = ICY - top * 212, yt = ICY - top * 180;
      g += `<path d="M${ICX - 36} ${yb}L${ICX + 36} ${yb}L${ICX + 36} ${yt}L${ICX - 36} ${yt}Z" class="lfe2"/><path d="${iSector(166, 182, top > 0 ? 35 * DEGR : 215 * DEGR, top > 0 ? 145 * DEGR : 325 * DEGR)}" class="lfe2"/>`;
      g += `<text x="${ICX}" y="${ICY - top * 194 + 7}" text-anchor="middle" class="lpole">${top > 0 ? 'N' : 'S'}</text>`;
      for (const sx of [-1, 1]) { const cx = ICX + sx * 49, cy = ICY - top * 196; g += `<rect x="${cx - 12}" y="${cy - 12}" width="24" height="24" rx="4" class="lcu"/>` + iCondSVG(`ifc${top > 0 ? 0 : 1}${sx > 0 ? 1 : 0}`, cx, cy, 8); }
    }
    g += gap(152, 165);
    g += `<line x1="${ICX - 252}" y1="${ICY}" x2="${ICX + 252}" y2="${ICY}" class="ineu"/>` + `<text x="${ICX}" y="${ICY + 278}" text-anchor="middle" class="ilb">čárkovaně geometrická neutrála; uprostřed komutátor, černě kartáče</text>`;
    let rot = `<circle cx="${ICX}" cy="${ICY}" r="150" class="lrot"/>`;
    for (let k = 0; k < NS; k++) { const a = (k + 0.5) * 2 * Math.PI / NS, [x, y] = ip(133, a), [x2, y2] = ip(108, a); rot += `<line x1="${f2(x)}" y1="${f2(y)}" x2="${f2(x2)}" y2="${f2(y2)}" class="iwire"/>` + iCondSVG('ia' + k, x, y, 9); }
    for (let k = 0; k < NS; k++) { const a0 = k * 2 * Math.PI / NS + 0.01, a1 = (k + 1) * 2 * Math.PI / NS - 0.01; rot += `<path d="${iSector(62, 92, a0, a1)}" id="icm${k}" class="icm"/>`; }
    rot += `<circle cx="${ICX}" cy="${ICY}" r="24" class="lshaft"/>`;
    g += `<g id="lab-rot">${rot}</g>`;
    g += `<rect x="${ICX - 112}" y="${ICY - 11}" width="22" height="22" rx="3" class="lbrush"/><rect x="${ICX + 90}" y="${ICY - 11}" width="22" height="22" rx="3" class="lbrush"/>`;
    g += `<g id="lab-fld"><line x1="${ICX}" y1="${ICY}" x2="${ICX}" y2="${ICY + 120}" class="lfld" marker-end="url(#iah)"/></g>`;
  } else {
    g += `<circle cx="${ICX}" cy="${ICY}" r="248" class="lfe"/><circle cx="${ICX}" cy="${ICY}" r="168" class="lgap"/>`;
    for (let k = 0; k < NS; k++) {
      const a = (k + 0.5) * 2 * Math.PI / NS, deg = 90 - a / DEGR, [x, y] = ip(196, a), [bx, by] = ip(232, a), [ph, sg] = beltOf(2 * a);
      g += `<g transform="rotate(${f2(deg)} ${ICX} ${ICY})"><rect x="${ICX - 11}" y="${ICY - 226}" width="22" height="56" rx="3" class="slot"/></g>` + iCondSVG('is' + k, x, y, 10);
      g += `<text x="${f2(bx)}" y="${f2(by + 4)}" text-anchor="middle" class="iph ip${ph}">${sg < 0 ? '−' : ''}${ph.toUpperCase()}</text>`;
    }
    g += gap(152, 166);
    let rot;
    if (m === 'am') {
      rot = `<circle cx="${ICX}" cy="${ICY}" r="150" class="lrot"/><circle cx="${ICX}" cy="${ICY}" r="122" class="iring"/>`;
      for (let k = 0; k < NB; k++) { const a = k * 2 * Math.PI / NB, [x, y] = ip(136, a); rot += iCondSVG('ib' + k, x, y, 8.5); }
      rot += `<rect x="${ICX - 3}" y="${ICY - 112}" width="6" height="70" rx="3" class="lmark"/><circle cx="${ICX}" cy="${ICY}" r="26" class="lshaft"/>`;
    } else {
      rot = `<circle cx="${ICX}" cy="${ICY}" r="62" class="lrot"/>`;
      for (let k = 0; k < 4; k++) {                                         /* vyniklé póly s budicím vinutím */
        const a = k * Math.PI / 2, deg = 90 - a / DEGR;
        rot += `<g transform="rotate(${f2(deg)} ${ICX} ${ICY})"><path d="M${ICX - 24} ${ICY - 60}L${ICX + 24} ${ICY - 60}L${ICX + 24} ${ICY - 118}L${ICX - 24} ${ICY - 118}Z" class="lfe2"/><path d="${iSector(118, 150, (90 - 34) * DEGR, (90 + 34) * DEGR)}" class="lfe2"/><text x="${ICX}" y="${ICY - 128}" text-anchor="middle" class="lpole">${k % 2 ? 'S' : 'N'}</text></g>`;
        for (const sx of [-1, 1]) { const [x, y] = ip(90, a + sx * 0.36); rot += iCondSVG(`irc${k}${sx > 0 ? 1 : 0}`, x, y, 9); }
      }
      rot += `<circle cx="${ICX}" cy="${ICY}" r="24" class="lshaft"/>`;
    }
    g += `<g id="lab-rot">${rot}</g>`;
    g += `<g id="lab-fld">${[0, 1, 2, 3].map(k => { const a = k * Math.PI / 2, [x, y] = ip(262, a); return `<text x="${f2(x)}" y="${f2(y + 7)}" text-anchor="middle" class="ins ${k % 2 ? 'in' : 'is'}">${k % 2 ? 'N' : 'S'}</text>`; }).join('')}</g>`;
  }
  return `<svg viewBox="-24 -24 568 568" class="inside" role="img" aria-label="Řez strojem s proudy a magnetickým polem">${g}</svg>`;
}
function labInsideHTML() {
  const m = L.m, lab = m === 'dc' ? [['fld', 'pole v mezeře'], ['ist', 'proudy v budicím vinutí'], ['irt', 'proudy v kotvě a komutátor']] : m === 'am' ? [['fld', 'pole v mezeře, póly N/S'], ['ist', 'proudy v drážkách statoru'], ['irt', 'proudy v tyčích klece']] : [['fld', 'pole v mezeře, póly N/S'], ['ist', 'proudy v drážkách statoru'], ['irt', 'budicí vinutí rotoru']];
  const note = m === 'dc' ? 'Vodiče pod pólem N mají jeden smysl proudu, pod S opačný. Rozložení proudů v kotvě stojí v prostoru, i když se kotva točí: obstarává to komutátor. Ve vodičích u neutrály se proud právě obrací (komutace, zlatě zvýrazněné lamely pod kartáči). Šipka ukazuje výsledné pole; s proudem kotvy se stáčí (reakce kotvy) a prstenec ukazuje posunutí neutrály.'
    : m === 'am' ? 'Drážky statoru jsou obarvené podle okamžitého proudu ve fázi (červená ⊙ k nám, modrá ⊗ od nás); písmena u drážek jsou fázové pásy A, B, C. Pás proudů se posouvá a s ním se otáčí pole ve vzduchové mezeře (červená = indukce ze statoru do rotoru, póly N/S). V tyčích klece se indukuje proud úměrný skluzu; jeho rozložení se vůči rotoru posouvá s kmitočtem f₂ = s f₁. Pro sledování proudů nastavte zpomalení 100× až 500×.'
    : 'Stator je stejný jako u asynchronního stroje. Rotor nese stejnosměrné budicí vinutí, takže jeho póly N/S jsou pevně spojené s rotorem. V synchronizmu se rotor točí stejně rychle jako pole statoru (písmena N/S po obvodu) a zaostává za ním o zátěžný úhel β/p.';
  return `<div class="lgh">Uvnitř stroje</div><div class="lrow ivw">${lab.map(([k, t]) => `<label class="chk"><input type="checkbox" data-iv="${k}"${IV[k] ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div>
<div class="iwrap">${labInsideSVG()}</div><p class="note">${sub(note)}</p>`;
}
const iRun = { n1: 1, n2: 1, nb: 1 };
function iNorm(key, v, floor) { const k = iRun[key + 'k'] = Math.max(Math.abs(v), (iRun[key + 'k'] || floor) * 0.985, floor); return k; }
function labInsideUpdate() {
  if (!document.getElementById('igap')) return;
  const m = L.m;
  iSet('igap', IV.fld ? 1 : 0); iSet('lab-fld', IV.fld ? 1 : 0);
  const gapCol = (B) => { for (let k = 0; k < 72; k++) { const e = document.getElementById('igp' + k); if (!e) continue; const b = B((k + 0.5) * 5 * DEGR); e.setAttribute('class', 'igp ' + (b >= 0 ? 'pos' : 'neg')); e.style.fillOpacity = Math.min(1, Math.abs(b)).toFixed(2); } };
  if (m === 'am') {
    const { Lh, L1, L2, D } = L.d, s = L.s, pp = L.P.pp;
    const i1 = [(L2 * s[0] - Lh * s[2]) / D, (L2 * s[1] - Lh * s[3]) / D], i2 = [(L1 * s[2] - Lh * s[0]) / D, (L1 * s[3] - Lh * s[1]) / D];
    const pm = [Lh * (i1[0] + i2[0]), Lh * (i1[1] + i2[1])], pN = L.d.psiNat || 0.9;
    const kv = !L.gen && LAB_AM.src === 'sit' && LAB_AM.yd === 'Y' ? 1 / SQ3 : 1;
    const ph = { a: i1[0], b: -i1[0] / 2 + SQ3 / 2 * i1[1], c: -i1[0] / 2 - SQ3 / 2 * i1[1] };
    const n1 = iNorm('s', Math.hypot(...i1), 8), n2 = iNorm('r', Math.hypot(...i2), 8);
    for (let k = 0; k < NS; k++) { const a = (k + 0.5) * 2 * Math.PI / NS, [p, sg] = beltOf(pp * a); iCond('is' + k, IV.ist ? sg * ph[p] / n1 : 0); iSet('is' + k, IV.ist ? 1 : 0.25); }
    for (let k = 0; k < NB; k++) { const e = pp * (L.thv + k * 2 * Math.PI / NB) - Math.PI / 2; iCond('ib' + k, IV.irt ? (i2[0] * Math.cos(e) + i2[1] * Math.sin(e)) / n2 : 0); iSet('ib' + k, IV.irt ? 1 : 0.25); }
    gapCol(th => -(pm[0] * Math.cos(pp * th) + pm[1] * Math.sin(pp * th)) / pN);   /* červeně: tok ze statoru do rotoru (pól N statoru) */
    const fa = Math.atan2(pm[1], pm[0]) / pp; document.getElementById('lab-fld').setAttribute('transform', `rotate(${f2(-fa / DEGR)} ${ICX} ${ICY})`);
    iSet('lab-fld', IV.fld ? Math.min(1, Math.hypot(...pm) / pN * 1.2).toFixed(2) : 0);
  } else if (m === 'dc') {
    const s = L.s, d = L.d, ia = s[0], flux = (L.gen ? xiSat(d, s[2]) : d.xiN * s[2] / d.ifN) / d.xiN, IN = L.P.IN, w = 10 * DEGR;
    for (let t = 0; t < 2; t++) for (let x = 0; x < 2; x++) iCond(`ifc${t}${x}`, IV.ist ? (x ? 1 : -1) * Math.min(1, s[2] / d.ifN) : 0);
    for (let k = 0; k < NS; k++) {
      const a = L.thv + (k + 0.5) * 2 * Math.PI / NS, sn = Math.sin(a), dist = Math.asin(Math.min(1, Math.abs(sn)));   /* vzdálenost od neutrály */
      const v = IV.irt ? -Math.sign(sn) * Math.min(1, dist / w) * ia / (1.2 * IN) : 0;
      iCond('ia' + k, v);
      const c0 = (k * 2 * Math.PI / NS + L.thv), cm = c0 + Math.PI / NS, under = Math.abs(Math.sin(cm)) < Math.sin(9 * DEGR);
      const ce = document.getElementById('icm' + k); if (ce) ce.setAttribute('class', 'icm' + (under && IV.irt ? ' on' : ''));
    }
    const kr = 0.35 * ia / IN;                                              /* reakce kotvy */
    gapCol(th => { const fromTop = Math.abs(((th - Math.PI / 2 + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI), fromBot = Math.PI - fromTop;
      const shape = fromTop < 55 * DEGR ? 1 : fromTop < 65 * DEGR ? (65 * DEGR - fromTop) / (10 * DEGR) : fromBot < 55 * DEGR ? -1 : fromBot < 65 * DEGR ? -(65 * DEGR - fromBot) / (10 * DEGR) : 0;
      const tri = 1 - 2 * Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) / Math.PI;
      return flux * shape - kr * tri * (0.35 + 0.65 * Math.abs(shape)); });
    const ang = Math.atan2(-flux, -kr); document.getElementById('lab-fld').setAttribute('transform', `rotate(${f2(90 - ang / DEGR - 180)} ${ICX} ${ICY})`);
    iSet('lab-fld', IV.fld ? Math.min(1, Math.hypot(flux, kr) + 0.1).toFixed(2) : 0);
  } else {
    const gen = L.gen, S = gen ? G_SM : LAB_SM, on = S.on, exc = gen ? S.exc : S.on && S.exc, P = L.P, pp = P.pp;
    const b = Math.atan2(Math.sin(pp * (L.fang - L.thv)), Math.cos(pp * (L.fang - L.thv)));
    let iv = [0, 0];
    if (on) { const c = smCurV(P, b, exc ? S.Ui : 0), th = pp * L.fang + Math.PI / 2 + c.arg; iv = [c.I * Math.cos(th), c.I * Math.sin(th)]; }
    const ph = { a: iv[0], b: -iv[0] / 2 + SQ3 / 2 * iv[1], c: -iv[0] / 2 - SQ3 / 2 * iv[1] }, n1 = iNorm('s', Math.hypot(...iv), 1);
    for (let k = 0; k < NS; k++) { const a = (k + 0.5) * 2 * Math.PI / NS, [p, sg] = beltOf(pp * a); iCond('is' + k, IV.ist ? sg * ph[p] / n1 : 0); iSet('is' + k, IV.ist ? 1 : 0.25); }
    for (let k = 0; k < 4; k++) for (let x = 0; x < 2; x++) iCond(`irc${k}${x}`, IV.irt && exc ? ((k % 2 ? -1 : 1) * (x ? 1 : -1)) : 0);
    const fa = on ? pp * L.fang : pp * L.thv, mag = on ? 1 : exc ? Math.min(1, S.Ui * L.nu) : 0;
    gapCol(th => -mag * Math.cos(pp * th - fa));
    document.getElementById('lab-fld').setAttribute('transform', `rotate(${f2(-(fa / pp) / DEGR)} ${ICX} ${ICY})`); iSet('lab-fld', IV.fld ? mag.toFixed(2) : 0);
  }
}
function smCurV(P, b, Ui) {                                                /* proud motoru jako fázor vůči napětí sítě */
  const Iq = -P.U * Math.sin(b) / P.Xq, Id = (Ui - P.U * Math.cos(b)) / P.Xd;
  const Ir = Id * Math.cos(-b - Math.PI / 2) + Iq * Math.cos(-b), Ii = Id * Math.sin(-b - Math.PI / 2) + Iq * Math.sin(-b);
  return { I: Math.hypot(Ir, Ii), arg: Math.atan2(-Ii, -Ir) };
}
document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.iv; if (k) { IV[k] = e.target.checked; } });
