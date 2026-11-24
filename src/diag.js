/* ===== Laboratoř: přístroje a diagramy (synchronoskop, fázorový diagram, charakteristiky s pracovním bodem, V-křivky) ===== */
let dgTick = 0; const DGC = {};
const dgMemo = (slot, key, f) => DGC[slot] && DGC[slot].key === key ? DGC[slot].v : (DGC[slot] = { key, v: f() }).v;
/* malý graf: osy, křivky, vodorovné/svislé čáry, body */
function miniPlot(o) {
  const W = 420, H = 280, m = { l: 52, r: 14, t: 14, b: 40 }, [x0, x1] = o.xr, [y0, y1] = o.yr;
  const X = x => m.l + (W - m.l - m.r) * (x - x0) / (x1 - x0), Y = y => H - m.b - (H - m.t - m.b) * (y - y0) / (y1 - y0), f = v => v.toFixed(1);
  let g = '';
  for (const t of ticks(x0, x1, 5)) g += `<line x1="${f(X(t))}" x2="${f(X(t))}" y1="${m.t}" y2="${H - m.b}" class="mgr"/><text x="${f(X(t))}" y="${H - m.b + 16}" text-anchor="middle" class="mtx">${fmt(t, Math.abs(x1 - x0) < 5 ? 1 : 0)}</text>`;
  for (const t of ticks(y0, y1, 5)) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${f(Y(t))}" y2="${f(Y(t))}" class="mgr"/><text x="${m.l - 6}" y="${f(Y(t) + 4)}" text-anchor="end" class="mtx">${fmt(t, Math.abs(y1 - y0) < 5 ? 1 : 0)}</text>`;
  if (x0 < 0 && x1 > 0) g += `<line x1="${f(X(0))}" x2="${f(X(0))}" y1="${m.t}" y2="${H - m.b}" class="max"/>`;
  if (y0 < 0 && y1 > 0) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${f(Y(0))}" y2="${f(Y(0))}" class="max"/>`;
  for (const fl of o.fills || []) { const p = fl.pts.filter(q => isFinite(q[0]) && isFinite(q[1])); if (p.length > 2) g += `<path d="M${p.map(q => f(X(clamp(q[0], x0, x1))) + ' ' + f(Y(clamp(q[1], y0, y1)))).join('L')}Z" class="${fl.c}"/>`; }
  for (const c of o.curves || []) { let d = '', pen = false; for (const [x, y] of c.pts) { if (!isFinite(x) || !isFinite(y) || x < x0 - (x1 - x0) || x > x1 + (x1 - x0)) { pen = false; continue; } d += (pen ? 'L' : 'M') + f(X(clamp(x, x0, x1))) + ' ' + f(Y(clamp(y, y0, y1))); pen = true; } g += `<path d="${d}" class="${c.c}"/>`; if (c.t) { const q = c.pts[c.tAt ?? c.pts.length - 1]; if (q && isFinite(q[1])) g += `<text x="${f(X(clamp(q[0], x0, x1)) + 4)}" y="${f(Y(clamp(q[1], y0, y1)) - 5)}" class="mtl ${c.c}">${lsub(c.t)}</text>`; } }
  for (const h of o.hl || []) if (h.y >= y0 && h.y <= y1) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${f(Y(h.y))}" y2="${f(Y(h.y))}" class="${h.c}"/>` + (h.t ? `<text x="${W - m.r - 4}" y="${f(Y(h.y) - 5)}" text-anchor="end" class="mtl ${h.c}">${lsub(h.t)}</text>` : '');
  for (const v of o.vl || []) if (v.x >= x0 && v.x <= x1) g += `<line x1="${f(X(v.x))}" x2="${f(X(v.x))}" y1="${m.t}" y2="${H - m.b}" class="${v.c}"/>` + (v.t ? `<text x="${f(X(v.x) + 4)}" y="${m.t + 12}" class="mtl ${v.c}">${lsub(v.t)}</text>` : '');
  for (const p of o.pts || []) if (isFinite(p.x) && isFinite(p.y)) g += `<circle cx="${f(X(clamp(p.x, x0, x1)))}" cy="${f(Y(clamp(p.y, y0, y1)))}" r="${p.r || 6}" class="${p.c || 'mpt'}"/>`;
  g += `<text x="${W - m.r}" y="${H - 6}" text-anchor="end" class="mxl">${lsub(o.xl)}</text><text x="14" y="${(H - m.b + m.t) / 2}" text-anchor="middle" class="mxl" transform="rotate(-90 14 ${(H - m.b + m.t) / 2})">${lsub(o.yl)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="mini" role="img" aria-label="${o.al || 'graf'}">${g}</svg>`;
}
/* synchronoskop: ručka = fázový rozdíl napětí stroje a sítě, nahoře = ve fázi */
function syncoSVG(dphi, df, on) {
  const cx = 110, cy = 110, R = 88, a = (on ? 0 : dphi) * Math.PI / 180;
  let g = `<circle cx="${cx}" cy="${cy}" r="${R}" class="sco"/>`;
  for (let k = 0; k < 36; k++) { const t = k * 10 * Math.PI / 180, r1 = k % 9 === 0 ? R - 14 : R - 7; g += `<line x1="${(cx + R * Math.sin(t)).toFixed(1)}" y1="${(cy - R * Math.cos(t)).toFixed(1)}" x2="${(cx + r1 * Math.sin(t)).toFixed(1)}" y2="${(cy - r1 * Math.cos(t)).toFixed(1)}" class="gtk"/>`; }
  g += `<path d="M${cx - 16} ${cy - R + 3}A${R - 3} ${R - 3} 0 0 1 ${cx + 16} ${cy - R + 3}" class="scok"/>`;
  g += `<text x="${cx + 52}" y="${cy + 6}" text-anchor="middle" class="stx">rychle ↻</text><text x="${cx - 52}" y="${cy + 6}" text-anchor="middle" class="stx">↺ pomalu</text>`;
  g += `<line x1="${cx}" y1="${cy}" x2="${(cx + (R - 18) * Math.sin(a)).toFixed(1)}" y2="${(cy - (R - 18) * Math.cos(a)).toFixed(1)}" class="gnd"/><circle cx="${cx}" cy="${cy}" r="7" class="gcap"/>`;
  return `<svg viewBox="0 0 220 224" class="gauge" aria-hidden="true">${g}<text x="${cx}" y="218" text-anchor="middle" class="stx">${on ? 'připojeno (ve fázi)' : 'Δf = ' + fmt(df, 2) + ' Hz'}</text></svg>`;
}
function dualBar(lab, a, b, max, u, la, lb) {
  const w = v => clamp(v / max, 0, 1) * 100;
  return `<div class="dbar"><p>${lab}</p><div class="dbr"><span>${la}</span><i><b style="width:${w(a).toFixed(1)}%"></b></i><em>${fmt(a, 2)} ${u}</em></div><div class="dbr g"><span>${lb}</span><i><b style="width:${w(b).toFixed(1)}%"></b></i><em>${fmt(b, 2)} ${u}</em></div></div>`;
}
function labDiagHTML() {
  const m = L.m, c = [];
  if (m === 'sm') c.push(['dsync', 'Synchronoskop a měřicí přístroje', 'Ručka ukazuje fázový rozdíl mezi napětím stroje a sítí a točí se rozdílovým kmitočtem; připojovat se má, když se točí pomalu a je nahoře.']);
  if (m !== 'dc') c.push(['dph', 'Fázorový diagram (aktuální stav)', m === 'sm' ? 'Generátorová konvence: U_i = U + jX_d I_d + jX_q I_q; u motoru je β záporné. Platí v synchronizmu.' : 'Ustálený stav z T-schématu pro okamžitý skluz (napájení ze sítě). Proudy ve vlastním měřítku.']);
  c.push(['dch', m === 'sm' ? 'Výkon v závislosti na zátěžném úhlu' : m === 'am' ? 'Momentová charakteristika a pracovní bod' : L.gen ? 'Charakteristika dynama' : 'Mechanická charakteristika a pracovní bod', m === 'sm' ? 'Červený bod je okamžitý stav. Při kývání se pohybuje po křivce kolem rovnovážného bodu; plochy nad a pod čarou momentu turbíny/zátěže se vyrovnávají (metoda rovnosti ploch). Za vrcholem křivky je stroj nestabilní.' : m === 'am' ? 'Červeně ustálená charakteristika M(n) pro aktuální napětí, kmitočet a odpor v rotoru, modře zátěž, bod je okamžitý stav (při rozběhu se od statické křivky odchyluje kvůli přechodovým dějům).' : L.gen ? 'Napětí naprázdno v závislosti na budicím proudu (magnetizační křivka) a odporová přímka budicího obvodu; průsečík je bod nabuzení derivačního dynama.' : 'Přímka n(M) pro aktuální napětí, odpor a buzení; modře zátěž, bod je okamžitý stav.']);
  if (m === 'sm') c.push(['dv', 'V-křivky', 'Proud statoru v závislosti na buzení pro stálý činný výkon. Vlevo od minima je stroj podbuzený (odebírá jalový výkon), vpravo přebuzený (dodává). Bod je okamžitý stav.']);
  c.push(['dflow', 'Tok výkonu (okamžitě)', 'Kam teče výkon právě teď. Modře uzly, červeně co odchází (ztráty, urychlování), zeleně co přitéká (např. energie ze setrvačnosti při brzdění). Při rozběhu je dobře vidět, že u asynchronního motoru se v rotoru ztratí tolik energie, kolik se jí uloží do setrvačnosti.']);
  return c.map(([id, h, n]) => `<div class="lgrp ldg"><p class="lgh">${h}</p><div id="${id}" class="dgb"></div><p class="note">${sub(n)}</p></div>`).join('') + `<div class="lgrp ldg dosc"><p class="lgh">Osciloskop</p>${oscHTML()}<p class="note">${sub(oscNote())}</p></div>`;
}
function labDiagUpdate() {
  if (++dgTick % 3) return;                                                /* stačí asi 20× za sekundu */
  oscDraw();
  if (L.flow) { const e = document.getElementById('dflow'); if (e) e.innerHTML = flowSVG(L.flow, L.flowU); }
  const m = L.m, me = L.meas;
  const put = (id, h) => { const e = document.getElementById(id); if (e) e.innerHTML = h; };
  if (m === 'sm') {
    const gen = L.gen, S = gen ? G_SM : LAB_SM, on = S.on, P = L.P, pp = P.pp, exc = gen ? S.exc : S.on && S.exc, Ui = exc ? S.Ui : 0;
    const b = Math.atan2(Math.sin(pp * (L.fang - L.thv)), Math.cos(pp * (L.fang - L.thv))), dg = -b;   /* úhel stroje vůči síti (generátor +) */
    const Ug = Ui * L.nu, df = 50 * (L.nu - 1), dphi = dg * 180 / Math.PI;
    put('dsync', `<div class="dsy">${syncoSVG(dphi, df, on)}<div class="dsyb">${dualBar('Dvojitý voltmetr', 1, Ug, 2, 'p.j.', 'síť', 'stroj')}${dualBar('Dvojitý kmitočtoměr', 50, 50 * L.nu, 60, 'Hz', 'síť', 'stroj')}<p class="note">${on ? 'Stroj je na síti: napětí i kmitočet určuje síť.' : `Rozdíl napětí ΔU = ${fmt(Math.hypot(Ug * Math.cos(dg) - 1, Ug * Math.sin(dg)), 2)} p.j. (svítí žárovky); podmínky: ΔU ≈ 0, Δf ≈ 0, Δφ ≈ 0.`}</p></div></div>`);
    if (on) put('dph', '<figure class="sch fz">' + figSub(FAZ.sm.calc({ E: Math.max(Ui, 0.01), d: clamp(dg * 180 / Math.PI, -179, 179), Xd: P.Xd, Xq: P.Xq }).svg) + '</figure>');
    else put('dph', '<p class="dgn">Stroj není na síti, fázorový diagram s proudem nemá smysl.</p>');
    /* P(β) v generátorové konvenci, metoda rovnosti ploch */
    const Pg = x => Ui * Math.sin(x) / P.Xd + 0.5 * (1 / P.Xq - 1 / P.Xd) * Math.sin(2 * x);
    const pts = dgMemo('pb', Ui, () => { const q = []; for (let k = -180; k <= 180; k += 3) q.push([k, Pg(k * Math.PI / 180)]); return q; });
    const Pe = Pg(dg), Pm = gen ? (L.Mp - 0.1 * L.nu * Math.abs(L.nu)) : -(LAB.load / 100);
    let d0 = NaN; { let lo = -Math.PI / 2, hi = Math.PI / 2; if (Pg(lo) < Pm && Pg(hi) > Pm) { for (let it = 0; it < 40; it++) { const md = (lo + hi) / 2; if (Pg(md) < Pm) lo = md; else hi = md; } d0 = lo; } }
    const fills = [];
    if (on && isFinite(d0) && Math.abs(dg - d0) > 0.02 && Math.abs(dg) < Math.PI) {
      const n = 30, poly = []; for (let k = 0; k <= n; k++) { const x = d0 + (dg - d0) * k / n; poly.push([x * 180 / Math.PI, Pg(x)]); }
      poly.push([dphi, Pm], [d0 * 180 / Math.PI, Pm]); fills.push({ pts: poly, c: (dg > d0) === (Pe > Pm) ? 'mfb' : 'mfa' });
    }
    put('dch', miniPlot({ xr: [-180, 180], yr: [-2, 2], xl: 'β [°] (generátor +)', yl: 'P [p.j.]', fills, curves: [{ pts, c: 'mc1', t: 'P(β)', tAt: 40 }], hl: [{ y: Pm, c: 'mld', t: gen ? 'turbína' : 'zátěž' }], vl: isFinite(d0) ? [{ x: d0 * 180 / Math.PI, c: 'mdl', t: 'β₀' }] : [], pts: on ? [{ x: dphi, y: Pe }] : [], al: 'Výkon v závislosti na zátěžném úhlu' }));
    /* V-křivky (vyniklé póly, R = 0): pro dané P a U_i najít stabilní β a proud */
    const vcurve = (Pw, c, lab) => { const q = [];
      for (let k = 0; k <= 60; k++) {
        const E = 0.1 + 2.4 * k / 60, f = x => E * Math.sin(x) / P.Xd + 0.5 * (1 / P.Xq - 1 / P.Xd) * Math.sin(2 * x);
        let mx = -1, xm = 0; for (let t = 0; t <= 180; t += 1) { const x = t * Math.PI / 180, p = f(x); if (p > mx) { mx = p; xm = x; } }
        if (Pw > mx) continue;
        let lo = 0, hi = xm; for (let it = 0; it < 40; it++) { const md = (lo + hi) / 2; if (f(md) < Pw) lo = md; else hi = md; }
        q.push([E, smCurV(P, -lo, E).I]);
      }
      return { pts: q, c, t: lab, tAt: 0 }; };
    const vc = dgMemo('v', P.Xd + '|' + P.Xq, () => [0, 0.5, 1].map((Pw, i) => {
      const q = [];
      for (let k = 0; k <= 60; k++) {
        const E = 0.1 + 2.4 * k / 60, f = x => E * Math.sin(x) / P.Xd + 0.5 * (1 / P.Xq - 1 / P.Xd) * Math.sin(2 * x);
        let mx = -1, xm = 0; for (let t = 0; t <= 180; t += 1) { const x = t * Math.PI / 180, p = f(x); if (p > mx) { mx = p; xm = x; } }
        if (Pw > mx) continue;
        let lo = 0, hi = xm; for (let it = 0; it < 40; it++) { const md = (lo + hi) / 2; if (f(md) < Pw) lo = md; else hi = md; }
        q.push([E, smCurV(P, -lo, E).I]);
      }
      return { pts: q, c: 'mc' + (i + 1), t: 'P = ' + fmt(Pw, 1), tAt: 0 };
    }));
    const syn = on && Math.abs(me.sl || 0) < 0.01, Pnow = syn ? Math.abs(Pe) : NaN;
    const vnow = syn ? dgMemo('vn', (Math.round(Pnow * 20) / 20).toFixed(2), () => vcurve(Math.round(Pnow * 20) / 20, 'mdl2', '')) : null;
    put('dv', miniPlot({ xr: [0, 2.5], yr: [0, 2.5], xl: 'U_i ~ I_f [p.j.]', yl: 'I [p.j.]', curves: vnow ? vc.concat([vnow]) : vc, vl: [{ x: 1, c: 'mdl', t: 'cos φ ≈ 1 u P = 0' }], pts: syn ? [{ x: Ui, y: me.I }] : [], al: 'V-křivky' }) + (syn ? `<p class="dgn">Teď: P = ${fmt(Pnow, 2)} p.j., ${(gen ? me.x3 : -me.x3) > 0.01 ? 'přebuzený (dodává jalový výkon)' : (gen ? me.x3 : -me.x3) < -0.01 ? 'podbuzený (odebírá jalový výkon)' : 'cos φ ≈ 1'}</p>` : ''));
  } else if (m === 'am') {
    const Rp = L.gen ? 0 : LAB_AM.Rp, P = { ...L.P, R2: L.P.R2 + Rp }, ua = L.uamp || 0, f = L.f || 0;
    const key = 'am' + Rp + '|' + Math.round(ua) + '|' + f.toFixed(1);
    const crv = dgMemo('amc', key, () => Math.abs(f) > 0.3 && ua > 1 ? imCurve(P, L.d, ua, f, -2000, 2000) : []);
    const Mz = []; for (let n = -2000; n <= 2000; n += 50) { const v = labMz(toRad(n)); Mz.push([v === null ? (n ? LAB.load / 100 * L.MN * Math.sign(n) : 0) : v, n]); }
    const lim = Math.min(400, Math.max(200, ...crv.map(q => Math.abs(q[0])))) * 1.05;
    put('dch', miniPlot({ xr: [-lim, lim], yr: [-2000, 2000], xl: 'M [N·m]', yl: 'n [ot/min]', curves: [{ pts: crv, c: 'mc1', t: L.gen ? 'stroj' : 'motor', tAt: 150 }, { pts: Mz, c: 'mld', t: L.gen ? 'turbína' : 'zátěž', tAt: 72 }], pts: [{ x: me.M, y: me.n }], al: 'Momentová charakteristika' }));
    const sit = L.gen ? G_AM.on : LAB_AM.on && !LAB_AM.dcb;
    if (sit && isFinite(me.x2) && ua > 1 && Math.abs(Math.abs(f) - 50) < 0.5) {
      const r = FAZ.am.calc({ s: clamp(me.x2 / 100, -0.3, 1.2), U: ua / Math.SQRT2, R2: P.R2, Lh: L.P.Lh });
      put('dph', '<figure class="sch fz">' + figSub(r.svg) + '</figure>' + `<p class="dgn">${r.out.slice(2, 5).map(([a, b]) => sub(a) + ': ' + b).join(' · ')}</p>`);
    } else put('dph', '<p class="dgn">Diagram se kreslí z T-schématu pro okamžitý skluz (ustálený stav) při napájení 50 Hz; zapněte stroj na síť, případně měnič na 50 Hz.</p>');
  } else {
    const P = L.P, d = L.d;
    if (L.gen) {
      const pts = [], ifm = 2.5 * d.ifN, W = L.s[1]; for (let k = 0; k <= 60; k++) { const i = ifm * k / 60; pts.push([i, xiSat(d, i) * W]); }
      const Rf = P.Rf + (G_DC.exc === 'cizi' ? 0 : G_DC.Rreg), line = [[0, 0], [ifm, Rf * ifm]];
      put('dch', miniPlot({ xr: [0, ifm], yr: [0, 600], xl: 'I_f [A]', yl: 'U₀ [V]', curves: [{ pts, c: 'mc1', t: 'naprázdno při ' + fmt(toRpm(W), 0) + ' ot/min', tAt: 30 }].concat(G_DC.exc === 'cizi' ? [] : [{ pts: line, c: 'mld', t: 'R_f + R_reg', tAt: 1 }]), pts: [{ x: L.s[2], y: me.x1 }], al: 'Magnetizační křivka dynama' }));
    } else {
      const reg = LAB_DC.mode === 'reg', xi = d.xiN * L.s[2] / d.ifN, U = reg ? L.s[3] : LAB_DC.U, R = P.Rd + (reg ? 0 : LAB_DC.Rp);
      const line = xi > 0.05 && LAB_DC.on ? [-600, 600].map(M => [M, toRpm((U - R * M / xi) / xi)]) : [];
      const Mz = []; for (let n = -2000; n <= 2000; n += 50) { const v = labMz(toRad(n)); Mz.push([v === null ? LAB.load / 100 * L.MN * Math.sign(n || 1) : v, n]); }
      put('dch', miniPlot({ xr: [-600, 600], yr: [-2000, 2000], xl: 'M [N·m]', yl: 'n [ot/min]', curves: [{ pts: line, c: 'mc1', t: reg ? 'okamžité u_q' : 'U = ' + fmt(U, 0) + ' V', tAt: 1 }, { pts: Mz, c: 'mld', t: 'zátěž', tAt: 70 }], pts: [{ x: me.M, y: me.n }], al: 'Mechanická charakteristika' }));
    }
  }
}
