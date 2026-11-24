/* ===== Schémata a průřezy (vlastní kresby) ===== */
const FIG = {};
{
const P = (cx, cy, r, deg) => [cx + r * Math.sin(deg * Math.PI / 180), cy - r * Math.cos(deg * Math.PI / 180)];
const f1 = v => v.toFixed(1);
const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const T = (x, y, t, a = 'start', cls = '') => `<text x="${f1(x)}" y="${f1(y)}" text-anchor="${a}" class="${cls}">${t}</text>`;
const L = (x1, y1, x2, y2, cls = 'k') => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" class="${cls}"/>`;
/* odkaz z bodu na popisek */
const lab = (px, py, tx, ty, text, a = 'start') => `<polyline points="${f1(px)},${f1(py)} ${f1(tx + (a === 'start' ? -6 : 6))},${f1(ty - 4)}" class="ld"/><circle cx="${f1(px)}" cy="${f1(py)}" r="2.5" class="dot"/>` + T(tx, ty, text, a);
const labs = (items, R, y0, dy) => items.map(([px, py, t]) => [px, py, t]).sort((a, b) => a[1] - b[1]).map(([px, py, t], i) => lab(px, py, R, y0 + i * dy, t)).join('');
const arc = (cx, cy, r, a0, a1) => { const [x0, y0] = P(cx, cy, r, a0), [x1, y1] = P(cx, cy, r, a1); return `M${f1(x0)} ${f1(y0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`; };
const ring = (cx, cy, ro, ri, cls) => `<path d="M${cx - ro} ${cy}a${ro} ${ro} 0 1 0 ${2 * ro} 0a${ro} ${ro} 0 1 0 ${-2 * ro} 0ZM${cx - ri} ${cy}a${ri} ${ri} 0 1 1 ${2 * ri} 0a${ri} ${ri} 0 1 1 ${-2 * ri} 0Z" class="${cls}" fill-rule="evenodd"/>`;
const cond = (x, y, dir, r = 5) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="${r}" class="cu"/>` + (dir > 0 ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="1.4" class="kf"/>` : dir < 0 ? `<path d="M${f1(x - r * .55)} ${f1(y - r * .55)}l${f1(r * 1.1)} ${f1(r * 1.1)}M${f1(x + r * .55)} ${f1(y - r * .55)}l${f1(-r * 1.1)} ${f1(r * 1.1)}" class="k1"/>` : '');
const coilH = (x, y, len, n = 4) => { const r = len / n / 2; let d = `M${x} ${y}`; for (let i = 0; i < n; i++) d += `a${r} ${r} 0 0 1 ${2 * r} 0`; return `<path d="${d}" class="k"/>`; };
const coilV = (x, y, len, n = 4) => { const r = len / n / 2; let d = `M${x} ${y}`; for (let i = 0; i < n; i++) d += `a${r} ${r} 0 0 1 0 ${2 * r}`; return `<path d="${d}" class="k"/>`; };
const resH = (x, y, w = 34) => `<rect x="${x}" y="${y - 6}" width="${w}" height="12" class="kb"/>`;
const resV = (x, y, h = 34) => `<rect x="${x - 6}" y="${y}" width="12" height="${h}" class="kb"/>`;
const mot = (x, y, t = 'M', r = 20) => `<circle cx="${x}" cy="${y}" r="${r}" class="kb"/>` + T(x, y + 5, t, 'middle', 'b');
const box = (x, y, w, h, t, sub2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" class="bx"/>` + T(x + w / 2, y + h / 2 + (sub2 ? -2 : 5), t, 'middle', 'b') + (sub2 ? T(x + w / 2, y + h / 2 + 15, sub2, 'middle', 'sm') : '');
const sum = (x, y) => `<circle cx="${x}" cy="${y}" r="11" class="bx"/>` + L(x - 6, y, x + 6, y) + L(x, y - 6, x, y + 6);
const arr = (pts, cls = 'k') => `<polyline points="${pts.map(p => p.map(f1).join(',')).join(' ')}" class="${cls}" marker-end="url(#ah)"/>`;
const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="kf"/></marker></defs>`;
const thy = (x, y, dn = 1) => { const s = dn; return `<path d="M${x - 9} ${y - 7 * s}L${x + 9} ${y - 7 * s}L${x} ${y + 7 * s}Z" class="kb"/>` + L(x - 9, y + 7 * s, x + 9, y + 7 * s) + L(x + 4, y + 3 * s, x + 14, y + 10 * s); };
const dio = (x, y, dn = 1) => { const s = dn; return `<path d="M${x - 8} ${y - 6 * s}L${x + 8} ${y - 6 * s}L${x} ${y + 6 * s}Z" class="kb"/>` + L(x - 8, y + 6 * s, x + 8, y + 6 * s); };
const sw = (x, y) => `<rect x="${x - 9}" y="${y - 10}" width="18" height="20" rx="3" class="kb"/>` + L(x - 4, y + 5, x + 4, y - 5);

/* ---------- 1. Příčný řez stejnosměrným strojem ---------- */
FIG.dcsec = () => {
  const cx = 210, cy = 210; let g = '';
  g += ring(cx, cy, 186, 158, 'fe');
  for (let k = 0; k < 4; k++) {                                         /* hlavní póly */
    const a = k * 90, N = k % 2 === 0;
    g += `<g transform="rotate(${a} ${cx} ${cy})"><path d="M${cx - 24} ${cy - 159}L${cx + 24} ${cy - 159}L${cx + 24} ${cy - 112}L${cx + 46} ${cy - 104}A104 104 0 0 0 ${cx - 46} ${cy - 104}L${cx - 24} ${cy - 112}Z" class="fe2"/>`;
    g += `<rect x="${cx - 47}" y="${cy - 152}" width="19" height="36" rx="3" class="cub"/><rect x="${cx + 28}" y="${cy - 152}" width="19" height="36" rx="3" class="cub"/>`;
    g += cond(cx - 37.5, cy - 134, N ? 1 : -1, 5.5) + cond(cx + 37.5, cy - 134, N ? -1 : 1, 5.5);
    g += '</g>'; { const [tx, ty] = P(cx, cy, 134, a); g += `<text x="${f1(tx)}" y="${f1(ty + 6)}" text-anchor="middle" class="b pole">${N ? 'N' : 'S'}</text>`; }
  }
  for (let k = 0; k < 4; k++) {                                         /* pomocné póly */
    const a = 45 + k * 90;
    g += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - 9}" y="${cy - 159}" width="18" height="60" class="fe2"/><rect x="${cx - 21}" y="${cy - 148}" width="10" height="28" rx="2" class="cub"/><rect x="${cx + 11}" y="${cy - 148}" width="10" height="28" rx="2" class="cub"/></g>`;
  }
  g += `<circle cx="${cx}" cy="${cy}" r="92" class="fe3"/>`;
  for (let i = 0; i < 24; i++) {                                        /* drážky kotvy */
    const a = i * 15 + 7.5, [x, y] = P(cx, cy, 80, a), q = Math.floor(((a + 45) % 360) / 90);
    g += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - 5}" y="${cy - 91}" width="10" height="21" rx="2" class="slot"/></g>` + cond(x, y, q % 2 === 0 ? -1 : 1, 4.2);
  }
  g += `<circle cx="${cx}" cy="${cy}" r="20" class="shaft"/>`;
  const [n1x, n1y] = P(cx, cy, 182, 45), [n2x, n2y] = P(cx, cy, 182, 225);
  g += L(n1x, n1y, n2x, n2y, 'neu');
  /* popisky */
  const R = 450;
  g += labs([[...P(cx, cy, 172, 20), 'Jho statoru'], [...P(cx, cy, 140, 90), 'Hlavní pól (zde S)'], [...P(cx, cy, 101, 75), 'Pólový nástavec'], [cx + 141.5, cy - 6, 'Budicí vinutí hlavního pólu'],
    [...P(cx, cy, 130, 135), 'Pomocný pól, vinutí v sérii s kotvou'], [...P(cx, cy, 97, 108), 'Vzduchová mezera (1–3 mm, velké 10–15 mm)'], [...P(cx, cy, 80, 112.5), 'Drážka s vodiči vinutí kotvy'],
    [...P(cx, cy, 55, 150), 'Kotva z izolovaných plechů 0,5 mm'], [...P(cx, cy, 12, 180), 'Hřídel'], [...P(cx, cy, 112, 225), 'Geometrická neutrála (zde komutují cívky)']], R, 40, 34);
  g += T(R, 388, '⊙ proud k nám, ⊗ od nás; čtyřpólový stroj', 'start', 'sm');
  return svg(800, 420, g, 'Příčný řez stejnosměrným strojem');
};

/* ---------- 2. Zapojení buzení stejnosměrného stroje ---------- */
FIG.dcconn = () => {
  let g = defs; const W = 190;
  const rails = (x0) => L(x0 + 18, 40, x0 + 172, 40) + L(x0 + 18, 170, x0 + 172, 170) + T(x0 + 12, 44, '+', 'end', 'b') + T(x0 + 12, 174, '−', 'end', 'b');
  /* cizí */
  let x = 0; g += rails(x) + L(x + 60, 40, x + 60, 85) + mot(x + 60, 105, 'A') + L(x + 60, 125, x + 60, 170);
  g += `<rect x="${x + 108}" y="58" width="64" height="94" rx="8" class="bxd"/>` + T(x + 140, 74, 'U_f', 'middle', 'sm') + coilV(x + 140, 82, 50) + L(x + 140, 132, x + 140, 145);
  g += T(x + 95, 200, 'cizí buzení', 'middle', 'b') + T(x + 95, 218, 'buzení z jiného zdroje', 'middle', 'sm');
  /* paralelní */
  x = W; g += rails(x) + L(x + 60, 40, x + 60, 85) + mot(x + 60, 105, 'A') + L(x + 60, 125, x + 60, 170) + L(x + 130, 40, x + 130, 60) + resV(x + 130, 60, 26) + coilV(x + 130, 96, 50) + L(x + 130, 146, x + 130, 170) + T(x + 146, 76, 'R_d', 'start', 'sm');
  g += T(x + 95, 200, 'paralelní (derivační)', 'middle', 'b') + T(x + 95, 218, 'buzení na napětí kotvy', 'middle', 'sm');
  /* sériové */
  x = 2 * W; g += rails(x) + L(x + 95, 40, x + 95, 50) + coilV(x + 95, 50, 44) + L(x + 95, 94, x + 95, 105) + mot(x + 95, 125, 'A') + L(x + 95, 145, x + 95, 170);
  g += T(x + 95, 200, 'sériové', 'middle', 'b') + T(x + 95, 218, 'budicí proud = proud kotvy', 'middle', 'sm');
  /* kompoundní */
  x = 3 * W; g += rails(x) + L(x + 60, 40, x + 60, 48) + coilV(x + 60, 48, 36) + L(x + 60, 84, x + 60, 95) + mot(x + 60, 115, 'A') + L(x + 60, 135, x + 60, 170) + L(x + 135, 40, x + 135, 80) + coilV(x + 135, 80, 50) + L(x + 135, 130, x + 135, 170);
  g += T(x + 95, 200, 'smíšené (kompoundní)', 'middle', 'b') + T(x + 95, 218, 'sériové + paralelní vinutí', 'middle', 'sm');
  return svg(760, 232, g, 'Zapojení buzení stejnosměrného stroje');
};

/* ---------- 3. Náhradní schéma kotvy a buzení ---------- */
FIG.dcekv = () => {
  let g = defs;
  g += L(40, 50, 90, 50) + resH(90, 50) + L(124, 50, 150, 50) + coilH(150, 50, 60) + L(210, 50, 270, 50) + `<circle cx="290" cy="90" r="20" class="kb"/>` + T(290, 95, 'u_i', 'middle', 'b') + L(270, 50, 290, 50) + L(290, 50, 290, 70) + L(290, 110, 290, 130) + L(40, 130, 290, 130);
  g += T(107, 36, 'R_d', 'middle', 'sm') + T(180, 36, 'L_d', 'middle', 'sm') + T(325, 95, 'u_i = ξ Ω', 'start') + T(26, 95, 'u_q', 'middle', 'b') + arr([[40, 118], [40, 62]]) + arr([[60, 50], [84, 50]], 'kr') + T(60, 68, 'i_q', 'start', 'sm');
  g += T(40, 165, 'kotva: u_q = R_d i_q + L_d di_q/dt + u_i', 'start', 'sm');
  const o = 460;
  g += L(o, 50, o + 40, 50) + resH(o + 40, 50) + L(o + 74, 50, o + 100, 50) + coilH(o + 100, 50, 60) + L(o + 160, 50, o + 200, 50) + L(o + 200, 50, o + 200, 130) + L(o, 130, o + 200, 130);
  g += T(o + 57, 36, 'R_f', 'middle', 'sm') + T(o + 130, 36, 'L_f', 'middle', 'sm') + T(o - 14, 95, 'u_f', 'middle', 'b') + arr([[o, 118], [o, 62]]);
  g += T(o, 165, 'buzení: u_f = R_f i_f + L_f di_f/dt, Φ ≈ k_Φ i_f', 'start', 'sm');
  g += T(380, 205, 'Moment M = ξ i_q, pohyb M − M_z = J dΩ/dt; tatáž ξ = CΦ váže napětí s rychlostí i moment s proudem', 'middle', 'sm');
  return svg(760, 220, g, 'Náhradní schéma kotvy a buzení');
};

/* ---------- 4. Kaskádní regulace ---------- */
FIG.casc = () => {
  let g = defs; const y = 70;
  g += T(14, y + 5, 'n*', 'start', 'b') + arr([[34, y], [52, y]]) + box(52, y - 22, 66, 44, 'rampa') + arr([[118, y], [139, y]]) + sum(150, y) + arr([[161, y], [180, y]]) + box(180, y - 22, 62, 44, 'R_Ω', 'PI, SO');
  g += arr([[242, y], [262, y]]) + `<rect x="262" y="${y - 22}" width="56" height="44" rx="6" class="bx"/><path d="M270 ${y + 12}L282 ${y + 12}L298 ${y - 12}L310 ${y - 12}" class="k"/>` + T(290, y + 38, '±I_max', 'middle', 'sm');
  g += arr([[318, y], [339, y]]) + T(330, y - 10, 'i_q*', 'middle', 'sm') + sum(350, y) + arr([[361, y], [380, y]]) + box(380, y - 22, 62, 44, 'R_iq', 'PI, OM') + arr([[442, y], [462, y]]) + box(462, y - 22, 84, 44, 'měnič', '1/(1+sτ_U)') + arr([[546, y], [570, y]]) + T(558, y - 10, 'u_q', 'middle', 'sm');
  g += `<rect x="570" y="${y - 34}" width="110" height="68" rx="8" class="bxm"/>` + T(625, y - 6, 'stejnosměrný', 'middle', 'b') + T(625, y + 12, 'motor', 'middle', 'b');
  g += arr([[680, y], [740, y]]) + T(724, y - 10, 'n', 'middle', 'b');
  g += arr([[625, y + 34], [625, y + 64], [350, y + 64], [350, y + 11]], 'kr') + T(490, y + 80, 'měřený proud kotvy i_q (vnitřní, rychlá smyčka)', 'middle', 'sm');
  g += arr([[710, y], [710, y + 104], [150, y + 104], [150, y + 11]], 'kr') + T(430, y + 120, 'měřená rychlost přes filtr T_fω (vnější smyčka)', 'middle', 'sm');
  g += T(139, y - 16, '+', 'end', 'sm') + T(158, y + 26, '−', 'start', 'sm') + T(339, y - 16, '+', 'end', 'sm') + T(358, y + 26, '−', 'start', 'sm');
  return svg(760, 205, g, 'Kaskádní regulace proudu a rychlosti');
};

/* ---------- 5. Měniče pro DC motor ---------- */
FIG.conv = () => {
  let g = defs;
  /* šestipulzní můstek */
  const xs = [70, 130, 190];
  g += T(20, 26, 'Tyristorový usměrňovač 6 pulzů (můstek)', 'start', 'b');
  ['L1', 'L2', 'L3'].forEach((n, i) => { g += T(18, 112 + i * 22, n, 'start', 'sm') + L(40, 108 + i * 22, xs[i], 108 + i * 22) + `<circle cx="${xs[i]}" cy="${108 + i * 22}" r="2.5" class="dot"/>` + L(xs[i], 72, xs[i], 160 + 0); });
  g += L(70, 50, 250, 50) + L(70, 190, 250, 190);
  xs.forEach(x => { g += L(x, 50, x, 62) + thy(x, 72, -1) + L(x, 82, x, 96) + L(x, 150, x, 164) + thy(x, 174, -1) + L(x, 184, x, 190); });
  g += L(250, 50, 250, 90) + mot(250, 120, 'M') + L(250, 140, 250, 190) + T(272, 70, 'U_d = U_d0 cos α', 'start', 'sm') + T(272, 172, 'τ_U = T/(2q) = 1,67 ms', 'start', 'sm');
  /* pulzní měnič */
  const o = 410;
  g += T(o, 26, 'Pulzní měnič (S₁ snižuje napětí, S₂ rekuperuje)', 'start', 'b');
  g += L(o + 20, 50, o + 300, 50) + L(o + 20, 190, o + 300, 190) + T(o + 10, 55, '+', 'end', 'b') + T(o + 10, 195, '−', 'end', 'b') + T(o + 30, 125, 'U₁', 'start', 'b');
  g += L(o + 120, 50, o + 120, 85) + sw(o + 120, 96) + L(o + 120, 106, o + 120, 120) + L(o + 120, 120, o + 120, 140) + sw(o + 120, 152) + L(o + 120, 162, o + 120, 190);
  g += L(o + 120, 70, o + 160, 70) + L(o + 160, 70, o + 160, 88) + dio(o + 160, 96, -1) + L(o + 160, 103, o + 160, 112) + L(o + 160, 112, o + 120, 112);
  g += L(o + 120, 132, o + 160, 132) + L(o + 160, 132, o + 160, 145) + dio(o + 160, 152, -1) + L(o + 160, 159, o + 160, 172) + L(o + 160, 172, o + 120, 172);
  g += T(o + 98, 100, 'S₁', 'end', 'sm') + T(o + 98, 156, 'S₂', 'end', 'sm');
  g += L(o + 120, 120, o + 230, 120) + coilH(o + 190, 120, 30, 3) + L(o + 230, 120, o + 260, 120) + L(o + 260, 120, o + 260, 130) + mot(o + 260, 150, 'M') + L(o + 260, 170, o + 260, 190) + T(o + 205, 108, 'L', 'middle', 'sm');
  g += T(o + 20, 222, 'U₂(AV) = z·U₁, zpoždění 1/(2f_sp); zpětné diody vedou proud při vypnutí spínače', 'start', 'sm');
  return svg(760, 236, g, 'Měniče pro stejnosměrný motor');
};

/* ---------- 6. Sériový motor: chod a odporové brzdění ---------- */
FIG.ser = () => {
  let g = defs;
  g += T(20, 26, 'Motor: buzení v sérii s kotvou', 'start', 'b');
  g += L(40, 60, 70, 60) + resH(70, 60) + L(104, 60, 140, 60) + coilH(140, 60, 64) + L(204, 60, 260, 60) + L(260, 60, 260, 90) + mot(260, 110, 'A') + L(260, 130, 260, 160) + L(40, 160, 260, 160);
  g += T(87, 46, 'R_p', 'middle', 'sm') + T(172, 46, 'budicí vinutí', 'middle', 'sm') + T(28, 115, 'U', 'middle', 'b') + arr([[110, 76], [134, 76]], 'kr') + T(122, 92, 'i', 'middle', 'sm');
  g += T(40, 190, 'M = C_M i²,  Ω = U/(C_U i) − R/C_U', 'start', 'sm');
  const o = 400;
  g += T(o, 26, 'Odporové brzdění (buzení přepólované)', 'start', 'b');
  g += L(o + 40, 60, o + 80, 60) + resH(o + 80, 60) + L(o + 114, 60, o + 150, 60) + coilH(o + 150, 60, 64) + L(o + 214, 60, o + 270, 60) + L(o + 270, 60, o + 270, 90) + mot(o + 270, 110, 'A') + L(o + 270, 130, o + 270, 160) + L(o + 40, 160, o + 270, 160) + L(o + 40, 60, o + 40, 160);
  g += T(o + 97, 46, 'R_br', 'middle', 'sm') + T(o + 182, 46, 'buzení (obráceně)', 'middle', 'sm') + `<path d="M${o + 160} 82 q22 14 44 0" class="kr" marker-end="url(#ah)"/>`;
  g += T(o + 40, 190, 'nabudí se z remanence, jen když C_U Ω > R + R_br', 'start', 'sm');
  return svg(760, 206, g, 'Sériový motor a odporové brzdění');
};

/* ---------- 7. Příčný řez asynchronním motorem ---------- */
FIG.amsec = () => {
  const cx = 210, cy = 210; let g = '';
  g += ring(cx, cy, 188, 112, 'fe');
  const ph = ['U', 'U', 'W′', 'W′', 'V', 'V', 'U′', 'U′', 'W', 'W', 'V′', 'V′'], col = { U: 'pa', V: 'pb', W: 'pc' };
  for (let i = 0; i < 36; i++) {
    const a = i * 10 + 5, band = Math.floor(i / 3) % 12, p = ph[band], neg = p.includes('′');
    g += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - 6}" y="${cy - 140}" width="12" height="27" rx="3" class="slot"/><rect x="${cx - 4}" y="${cy - 137}" width="8" height="21" rx="2" class="${col[p[0]]}"/></g>`;
  }
  for (let k = 0; k < 12; k++) { const [x, y] = P(cx, cy, 154, k * 30 + 15); g += T(x, y + 5, ph[k], 'middle', 'sm b'); }
  g += `<circle cx="${cx}" cy="${cy}" r="108" class="fe3"/>`;
  for (let i = 0; i < 28; i++) { const a = i * 360 / 28, [x, y] = P(cx, cy, 94, a); g += `<circle cx="${f1(x)}" cy="${f1(y)}" r="6.5" class="al"/>`; }
  g += `<circle cx="${cx}" cy="${cy}" r="24" class="shaft"/>`;
  g += labs([[...P(cx, cy, 175, 25), 'Svazek statorových plechů 0,5 mm'], [...P(cx, cy, 126, 55), 'Drážka statoru s trojfázovým vinutím'], [...P(cx, cy, 168, 75), 'Fázové pásy U, V, W (′ = zpětná strana)'],
    [...P(cx, cy, 110, 100), 'Vzduchová mezera (malá, kvůli I_μ)'], [...P(cx, cy, 94, 128.6), 'Tyče klece (hliníkový odlitek)'], [...P(cx, cy, 60, 150), 'Rotor z plechů'], [...P(cx, cy, 15, 180), 'Hřídel']], 450, 44, 34);
  /* klec */
  const kx = 600, ky = 340;
  g += `<ellipse cx="${kx - 70}" cy="${ky}" rx="12" ry="44" class="alr"/><ellipse cx="${kx + 70}" cy="${ky}" rx="12" ry="44" class="alr"/>`;
  for (let i = 0; i < 9; i++) { const yy = ky - 40 + i * 10; g += L(kx - 70, yy, kx + 70, yy, 'bar'); }
  g += T(kx, ky + 66, 'Klec nakrátko: tyče a zkratovací kruhy', 'middle', 'sm');
  g += T(20, 444, 'dvoupólové rozložení, 36 drážek; kroužkový rotor má místo klece trojfázové vinutí vyvedené na kroužky', 'start', 'sm');
  return svg(800, 456, g, 'Příčný řez asynchronním motorem');
};

/* ---------- 8. T-schéma asynchronního motoru ---------- */
FIG.tsch = () => {
  let g = defs; const y = 50, yb = 160;
  g += L(40, y, 70, y) + resH(70, y) + L(104, y, 120, y) + coilH(120, y, 56) + L(176, y, 280, y) + L(280, y, 400, y) + coilH(400, y, 56) + L(456, y, 480, y) + resH(480, y, 44) + L(524, y, 560, y) + L(560, y, 560, yb) + L(40, yb, 560, yb);
  g += L(240, y, 240, 80) + resV(240, 80, 40) + L(240, 120, 240, yb) + L(320, y, 320, 75) + coilV(320, 75, 50) + L(320, 125, 320, yb) + `<circle cx="240" cy="${y}" r="2.5" class="dot"/><circle cx="320" cy="${y}" r="2.5" class="dot"/><circle cx="240" cy="${yb}" r="2.5" class="dot"/><circle cx="320" cy="${yb}" r="2.5" class="dot"/>`;
  g += T(87, y - 14, 'R₁', 'middle', 'sm') + T(148, y - 14, 'X₁σ', 'middle', 'sm') + T(228, 104, 'R_Fe', 'end', 'sm') + T(334, 104, 'X_μ (X₁h)', 'start', 'sm') + T(428, y - 14, 'X₂σ′', 'middle', 'sm') + T(502, y - 14, 'R₂′/s', 'middle', 'sm');
  g += T(24, 110, 'U₁', 'middle', 'b') + arr([[40, 148], [40, 64]]) + arr([[190, y - 8], [220, y - 8]], 'kr') + T(205, y - 16, 'I₁', 'middle', 'sm') + arr([[540, y - 8], [535, y - 8]], 'kr') + T(545, y - 16, 'I₂′', 'start', 'sm') + T(334, 140, 'I_μ', 'start', 'sm');
  g += T(600, 70, 'R₂′/s = R₂′ + R₂′(1 − s)/s', 'start', 'sm') + T(600, 92, 'ztráty v rotoru: s·P_δ', 'start', 'sm') + T(600, 114, 'mechanický výkon: (1 − s)·P_δ', 'start', 'sm') + T(600, 136, 'P_δ = 3 I₂′² R₂′/s', 'start', 'sm');
  g += T(40, 196, 'Ve skriptech ZPO je I_μ = I₁ − I₂ (rotorový proud orientovaný opačně); fyzikálně stejné.', 'start', 'sm');
  return svg(820, 210, g, 'Náhradní T-schéma asynchronního motoru');
};

/* ---------- 9. Vektorové řízení: blokové schéma ---------- */
FIG.foc = () => {
  let g = defs;
  g += T(10, 52, 'n*', 'start', 'b') + arr([[28, 48], [44, 48]]) + sum(55, 48) + arr([[66, 48], [82, 48]]) + box(82, 28, 54, 40, 'R_Ω') + arr([[136, 48], [158, 48]]) + T(147, 40, 'M*', 'middle', 'sm') + box(158, 28, 54, 40, '÷ Kψ') + arr([[212, 48], [232, 48]]) + T(222, 40, 'i_q*', 'middle', 'sm') + sum(243, 48) + arr([[254, 48], [270, 48]]) + box(270, 28, 54, 40, 'R_i1q');
  g += T(10, 132, 'ψ*', 'start', 'b') + arr([[28, 128], [44, 128]]) + sum(55, 128) + arr([[66, 128], [82, 128]]) + box(82, 108, 54, 40, 'R_Ψ') + arr([[136, 128], [232, 128]]) + T(184, 120, 'i_d*', 'middle', 'sm') + sum(243, 128) + arr([[254, 128], [270, 128]]) + box(270, 108, 54, 40, 'R_i1d');
  g += `<rect x="342" y="28" width="70" height="120" rx="6" class="bx"/>` + T(377, 80, 'odva-', 'middle', 'sm') + T(377, 96, 'zbení', 'middle', 'sm') + arr([[324, 48], [342, 48]]) + arr([[324, 128], [342, 128]]);
  g += arr([[412, 88], [430, 88]]) + box(430, 64, 72, 48, 'dq → αβ', 'úhel ϑ₁') + arr([[502, 88], [522, 88]]) + box(522, 64, 66, 48, 'střídač', 'SVM') + arr([[588, 88], [610, 88]]) + `<circle cx="640" cy="88" r="28" class="bxm"/>` + T(640, 93, 'AM', 'middle', 'b');
  g += arr([[640, 116], [640, 196], [502, 196]], 'kr') + box(430, 176, 72, 40, 'αβ → dq') + arr([[430, 196], [243, 196], [243, 139]], 'kr') + arr([[330, 196], [330, 230], [243, 230], [243, 59]], 'kr');
  g += T(300, 190, 'i_d', 'middle', 'sm') + T(290, 244, 'i_q', 'middle', 'sm');
  g += arr([[668, 88], [720, 88], [720, 268], [175, 268]], 'kr') + T(700, 80, 'Ω', 'middle', 'b') + box(110, 248, 64, 40, 'filtr') + arr([[110, 268], [55, 268], [55, 59]], 'kr');
  g += box(520, 236, 120, 50, 'model toku', 'ψ₂, ω₂ = L_h i_q/(τ₂ψ₂)') + arr([[700, 268], [640, 268]], 'kr') + arr([[520, 262], [466, 262], [466, 112]], 'kr') + T(474, 150, 'ϑ₁ = ∫(p_pΩ + ω₂)dt', 'start', 'sm') + arr([[580, 236], [580, 220], [55, 220], [55, 139]], 'kr') + T(130, 214, 'ψ₂ (model)', 'middle', 'sm');
  return svg(760, 300, g, 'Blokové schéma vektorového řízení');
};

/* ---------- 10. Napěťový střídač ---------- */
FIG.inv = () => {
  let g = defs;
  ['L1', 'L2', 'L3'].forEach((n, i) => { g += T(14, 84 + i * 26, n, 'start', 'sm') + L(36, 80 + i * 26, 60 + i * 40, 80 + i * 26) + `<circle cx="${60 + i * 40}" cy="${80 + i * 26}" r="2.5" class="dot"/>`; });
  [60, 100, 140].forEach(x => { g += L(x, 40, x, 54) + dio(x, 62, -1) + L(x, 68, x, 140) + dio(x, 150, -1) + L(x, 156, x, 200); });
  g += L(60, 40, 400, 40) + L(60, 200, 400, 200) + T(100, 230, 'diodový usměrňovač', 'middle', 'sm');
  g += L(200, 40, 200, 108) + L(184, 108, 216, 108) + L(184, 118, 216, 118) + L(200, 118, 200, 200) + T(224, 118, 'C_d', 'start', 'sm') + T(200, 250, 'meziobvod U_d', 'middle', 'sm');
  const legs = [280, 330, 380], out = ['a', 'b', 'c'];
  legs.forEach((x, i) => {
    g += L(x, 40, x, 60) + sw(x, 72) + L(x, 82, x, 120) + L(x, 120, x, 150) + sw(x, 162) + L(x, 172, x, 200);
    g += L(x, 52, x + 18, 52) + L(x + 18, 52, x + 18, 64) + dio(x + 18, 72, -1) + L(x + 18, 79, x + 18, 92) + L(x + 18, 92, x, 92);
    g += L(x, 142, x + 18, 142) + L(x + 18, 142, x + 18, 154) + dio(x + 18, 162, -1) + L(x + 18, 169, x + 18, 182) + L(x + 18, 182, x, 182);
    g += L(x, 120, 470, 100 + i * 20) + `<circle cx="${x}" cy="120" r="2.5" class="dot"/>`;
  });
  g += `<circle cx="510" cy="120" r="30" class="bxm"/>` + T(510, 125, 'AM', 'middle', 'b') + L(470, 100, 486, 104) + L(470, 140, 486, 136) + L(470, 120, 480, 120);
  g += T(400, 250, 'střídač: 6 vypínatelných prvků se zpětnými diodami', 'middle', 'sm');
  g += T(570, 70, '8 stavů: 6 aktivních (vektor', 'start', 'sm') + T(570, 90, 'skáče po 60°) a 2 nulové', 'start', 'sm') + T(570, 120, 'PWM / SVM: amplituda fáze', 'start', 'sm') + T(570, 140, 'nejvýš U_d/√3', 'start', 'sm') + T(570, 170, 've větvi nesmí sepnout', 'start', 'sm') + T(570, 190, 'oba prvky současně', 'start', 'sm');
  return svg(760, 262, g, 'Nepřímý měnič frekvence s napěťovým meziobvodem');
};

/* ---------- 11. Synchronní stroje: hladký rotor a vyniklé póly ---------- */
FIG.smsec = () => {
  let g = '';
  const stator = (cx, cy) => { let s = ring(cx, cy, 160, 120, 'fe'); for (let i = 0; i < 30; i++) s += `<g transform="rotate(${i * 12 + 6} ${cx} ${cy})"><rect x="${cx - 5}" y="${cy - 142}" width="10" height="21" rx="2" class="slot"/><rect x="${cx - 3}" y="${cy - 139}" width="6" height="15" rx="1" class="${['pa', 'pb', 'pc'][Math.floor(i / 5) % 3]}"/></g>`; return s; };
  /* hladký rotor, dvoupólový */
  let cx = 185, cy = 190;
  g += stator(cx, cy) + `<circle cx="${cx}" cy="${cy}" r="112" class="fe3"/>`;
  for (let i = 0; i < 24; i++) {
    const a = i * 15 + 7.5, rel = ((a % 180) + 180) % 180;
    if (rel > 55 && rel < 125) {
      const [x, y] = P(cx, cy, 98, a);
      g += `<g transform="rotate(${a} ${cx} ${cy})"><rect x="${cx - 5}" y="${cy - 111}" width="10" height="24" rx="2" class="slot"/></g>` + cond(x, y, a < 180 ? 1 : -1, 4);
    }
  }
  g += `<circle cx="${cx}" cy="${cy}" r="26" class="shaft"/>` + T(cx, cy - 64, 'N', 'middle', 'b pole') + T(cx, cy + 76, 'S', 'middle', 'b pole');
  g += T(cx, 372, 'Hladký rotor (turbostroj), 2 póly', 'middle', 'b') + T(cx, 390, 'dlouhý a štíhlý, 3000 min⁻¹, X_d ≈ X_q', 'middle', 'sm');
  g += T(cx, 410, 'budicí vinutí v drážkách na ⅔ obvodu,', 'middle', 'sm') + T(cx, 427, 'nedrážkovaná část tvoří pól', 'middle', 'sm');
  /* vyniklé póly, čtyřpólový */
  cx = 575; g += stator(cx, cy);
  for (let k = 0; k < 4; k++) {
    const a = k * 90 + 45, N = k % 2 === 0;
    g += `<g transform="rotate(${a} ${cx} ${cy})"><path d="M${cx - 22} ${cy - 40}L${cx + 22} ${cy - 40}L${cx + 22} ${cy - 92}L${cx + 46} ${cy - 100}A112 112 0 0 0 ${cx - 46} ${cy - 100}L${cx - 22} ${cy - 92}Z" class="fe2"/><rect x="${cx - 42}" y="${cy - 88}" width="17" height="42" rx="3" class="cub"/><rect x="${cx + 25}" y="${cy - 88}" width="17" height="42" rx="3" class="cub"/>`;
    for (let j = -2; j <= 2; j++) g += `<circle cx="${cx + j * 16}" cy="${cy - 104}" r="3.4" class="al"/>`;
    g += '</g>'; { const [tx, ty] = P(cx, cy, 66, a); g += `<text x="${f1(tx)}" y="${f1(ty + 6)}" text-anchor="middle" class="b pole">${N ? 'N' : 'S'}</text>`; }
  }
  g += `<circle cx="${cx}" cy="${cy}" r="40" class="fe3"/><circle cx="${cx}" cy="${cy}" r="18" class="shaft"/>`;
  g += T(cx, 372, 'Vyniklé póly (hydrostroj), 4 póly', 'middle', 'b') + T(cx, 390, 'velký průměr, pomaluběžný, X_d > X_q', 'middle', 'sm');
  g += T(cx, 410, 'tečky: tlumicí klec v pólových nástavcích,', 'middle', 'sm') + T(cx, 427, 'na pólech budicí cívky', 'middle', 'sm');
  return svg(760, 440, g, 'Synchronní stroj s hladkým rotorem a s vyniklými póly');
};

/* ---------- 12. Fázorový diagram synchronního motoru (hladký rotor) ---------- */
FIG.smph = () => {
  let g = defs; const o = [90, 70], sc = 180;
  const U = [1, 0], I = [Math.cos(0.45), Math.sin(0.45)].map(v => v * 0.55), X = 1.0;
  const jXI = [-X * I[1], X * I[0]], Ui = [U[0] - jXI[0], U[1] - jXI[1]];
  const pt = v => [o[0] + v[0] * sc, o[1] - v[1] * sc];
  g += arr([o, pt(U)]) + T(pt(U)[0] + 8, pt(U)[1] - 8, 'U', 'start', 'b');
  g += arr([o, pt(I)], 'kr') + T(pt(I)[0] + 6, pt(I)[1] + 4, 'I', 'start', 'b');
  g += arr([pt(Ui), pt(U)], 'kb2') + T((pt(Ui)[0] + pt(U)[0]) / 2 + 8, (pt(Ui)[1] + pt(U)[1]) / 2, 'jX_d I', 'start', 'sm');
  g += arr([o, pt(Ui)]) + T(pt(Ui)[0] - 6, pt(Ui)[1] + 18, 'U_i', 'end', 'b');
  g += `<path d="M${o[0] + 70} ${o[1]}A70 70 0 0 1 ${f1(o[0] + 70 * Math.cos(Math.atan2(-Ui[1], Ui[0])))} ${f1(o[1] + 70 * Math.sin(Math.atan2(-Ui[1], Ui[0])))}" class="ld"/>` + T(o[0] + 78, o[1] + 22, 'β', 'start', 'b');
  g += T(420, 60, 'Motor na tvrdé síti, R_s = 0:', 'start', 'b') + T(420, 86, 'U = U_i + jX_d I', 'start') + T(420, 112, 'P = 3 U U_i sin β / X_d', 'start') + T(420, 138, 'M = P/Ω₁, maximum při β = 90°', 'start') + T(420, 170, 'Přebuzený motor (velké U_i):', 'start', 'sm') + T(420, 190, 'proud předbíhá, dodává jalový výkon', 'start', 'sm') + T(420, 214, 'Podbuzený: odebírá jalový výkon', 'start', 'sm');
  return svg(760, 260, g, 'Fázorový diagram synchronního motoru');
};

/* ---------- 13. Speciální motory: PMSM, krokový, SRM ---------- */
FIG.spec = () => {
  let g = '';
  /* PMSM */
  let cx = 125, cy = 140;
  g += ring(cx, cy, 108, 72, 'fe');
  for (let i = 0; i < 12; i++) g += `<g transform="rotate(${i * 30 + 15} ${cx} ${cy})"><rect x="${cx - 7}" y="${cy - 98}" width="14" height="25" rx="3" class="slot"/><rect x="${cx - 5}" y="${cy - 95}" width="10" height="19" rx="2" class="${['pa', 'pb', 'pc'][i % 3]}"/></g>`;
  g += `<circle cx="${cx}" cy="${cy}" r="60" class="fe3"/>`;
  for (let k = 0; k < 4; k++) g += `<path d="${arc(cx, cy, 62, k * 90 - 38, k * 90 + 38)}" class="${k % 2 ? 'mS' : 'mN'}"/>` + T(...P(cx, cy, 44, k * 90).map((v, i) => v + (i ? 5 : 0)), k % 2 ? 'S' : 'N', 'middle', 'b');
  g += `<circle cx="${cx}" cy="${cy}" r="14" class="shaft"/>` + T(cx, 272, 'PMSM: magnety na povrchu rotoru', 'middle', 'b') + T(cx, 290, 'L_d = L_q, moment ~ i_q', 'middle', 'sm');
  /* krokový motor */
  cx = 380;
  g += ring(cx, cy, 108, 92, 'fe');
  for (let k = 0; k < 4; k++) {
    g += `<g transform="rotate(${k * 90} ${cx} ${cy})"><rect x="${cx - 14}" y="${cy - 93}" width="28" height="48" class="fe2"/><rect x="${cx - 30}" y="${cy - 86}" width="14" height="30" rx="2" class="cub"/><rect x="${cx + 16}" y="${cy - 86}" width="14" height="30" rx="2" class="cub"/></g>`;
    g += T(...P(cx, cy, 70, k * 90 + 32), ['A', 'B', 'A′', 'B′'][k], 'middle', 'sm b');
  }
  g += `<circle cx="${cx}" cy="${cy}" r="42" class="fe3"/>`;
  for (let i = 0; i < 18; i++) g += `<g transform="rotate(${i * 20} ${cx} ${cy})"><rect x="${cx - 4}" y="${cy - 46}" width="8" height="6" class="fe2"/></g>`;
  g += `<path d="M${cx - 22} ${cy}L${cx + 22} ${cy}" class="k"/>` + T(cx, cy - 12, 'N', 'middle', 'b') + T(cx, cy + 22, 'S', 'middle', 'b');
  g += T(cx, 272, 'Krokový motor: 2 fáze, aktivní rotor', 'middle', 'b') + T(cx, 290, 'proud +I, 0, −I; krok 360°/(4N_r)', 'middle', 'sm');
  /* SRM 6/4 */
  cx = 635;
  g += ring(cx, cy, 108, 92, 'fe');
  for (let k = 0; k < 6; k++) { g += `<g transform="rotate(${k * 60} ${cx} ${cy})"><rect x="${cx - 13}" y="${cy - 93}" width="26" height="40" class="fe2"/><rect x="${cx - 28}" y="${cy - 86}" width="13" height="26" rx="2" class="${['pa', 'pb', 'pc'][k % 3]}"/><rect x="${cx + 15}" y="${cy - 86}" width="13" height="26" rx="2" class="${['pa', 'pb', 'pc'][k % 3]}"/></g>`; }
  g += `<circle cx="${cx}" cy="${cy}" r="30" class="fe3"/>`;
  for (let k = 0; k < 4; k++) g += `<g transform="rotate(${k * 90 + 15} ${cx} ${cy})"><rect x="${cx - 12}" y="${cy - 51}" width="24" height="24" class="fe3"/></g>`;
  g += `<circle cx="${cx}" cy="${cy}" r="12" class="shaft"/>`;
  g += T(cx, 272, 'SRM 6/4: rotor bez vinutí a magnetů', 'middle', 'b') + T(cx, 290, 'M = ½ (dL/dφ) i², fáze A, B, C', 'middle', 'sm');
  return svg(760, 300, g, 'Průřezy speciálních motorů');
};

/* ---------- 14. Regulační obvod ---------- */
FIG.loop = () => {
  let g = defs; const y = 60;
  g += T(14, y + 5, 'w', 'start', 'b') + arr([[30, y], [58, y]]) + sum(69, y) + arr([[80, y], [110, y]]) + T(95, y - 10, 'e', 'middle', 'sm') + box(110, y - 24, 90, 48, 'regulátor R') + arr([[200, y], [236, y]]) + T(218, y - 10, 'v', 'middle', 'sm');
  g += box(236, y - 24, 96, 48, 'akční člen A', 'měnič') + arr([[332, y], [370, y]]) + T(351, y - 10, 'y', 'middle', 'sm') + sum(381, y) + T(381, y - 30, 'z', 'middle', 'b') + arr([[381, y - 40], [381, y - 11]], 'kr') + arr([[392, y], [424, y]]) + box(424, y - 24, 96, 48, 'soustava S', 'motor + zátěž') + arr([[520, y], [600, y]]) + T(590, y - 10, 'x', 'middle', 'b');
  g += arr([[560, y], [560, y + 76], [370, y + 76]], 'kr') + box(274, y + 54, 96, 44, 'čidlo M') + arr([[274, y + 76], [69, y + 76], [69, y + 11]], 'kr') + T(170, y + 70, 'x₁', 'middle', 'sm') + T(58, y - 14, '+', 'end', 'sm') + T(78, y + 28, '−', 'start', 'sm');
  g += T(620, y - 4, 'G_c = G₁/(1 + G_o)', 'start', 'sm') + T(620, y + 18, 'w žádaná, e odchylka,', 'start', 'sm') + T(620, y + 38, 'v akční, z porucha', 'start', 'sm');
  return svg(760, 150, g, 'Regulační obvod se zápornou zpětnou vazbou');
};

/* ---------- 15. Transformátor: konstrukce a náhradní schéma ---------- */
FIG.trafo = () => {
  let g = defs;
  g += `<path d="M40 40H300V240H40ZM100 90H240V190H100Z" class="fe" fill-rule="evenodd"/>`;
  for (let i = 0; i < 7; i++) g += `<rect x="20" y="${95 + i * 13}" width="20" height="10" rx="3" class="cub"/><rect x="100" y="${95 + i * 13}" width="12" height="10" rx="3" class="cub"/>`;
  for (let i = 0; i < 4; i++) g += `<rect x="300" y="${110 + i * 16}" width="20" height="12" rx="3" class="cua"/><rect x="228" y="${110 + i * 16}" width="12" height="12" rx="3" class="cua"/>`;
  g += `<path d="M70 70H270V210H70Z" class="flux" marker-end="url(#ah)"/>` + T(170, 64, 'Φ (hlavní tok v jádře)', 'middle', 'sm');
  g += T(14, 82, 'N₁', 'start', 'b') + T(330, 104, 'N₂', 'start', 'b') + T(170, 268, 'jádrový transformátor: jádra a spojky z plechů 0,35 mm', 'middle', 'sm');
  g += T(14, 230, 'U₁', 'start', 'b') + T(330, 186, 'U₂', 'start', 'b');
  const o = 400, y = 80, yb = 190;
  g += L(o, y, o + 20, y) + resH(o + 20, y, 28) + L(o + 48, y, o + 56, y) + coilH(o + 56, y, 44) + L(o + 100, y, o + 190, y) + coilH(o + 190, y, 44) + L(o + 234, y, o + 242, y) + resH(o + 242, y, 28) + L(o + 270, y, o + 300, y) + L(o, yb, o + 300, yb);
  g += L(o + 130, y, o + 130, y + 25) + resV(o + 130, y + 25, 36) + L(o + 130, y + 61, o + 130, yb) + L(o + 166, y, o + 166, y + 22) + coilV(o + 166, y + 22, 44) + L(o + 166, y + 66, o + 166, yb);
  g += T(o + 34, y - 12, 'R₁', 'middle', 'sm') + T(o + 78, y - 12, 'X₁σ', 'middle', 'sm') + T(o + 212, y - 12, 'X₂σ′', 'middle', 'sm') + T(o + 256, y - 12, 'R₂′', 'middle', 'sm') + T(o + 120, y + 48, 'R_Fe', 'end', 'sm') + T(o + 178, y + 48, 'X_μ', 'start', 'sm');
  g += T(o - 8, 140, 'U₁', 'end', 'b') + T(o + 310, 140, 'U₂′', 'start', 'b') + T(o + 150, 226, 'R₂′ = p²R₂, X₂σ′ = p²X₂σ, U₂′ = pU₂, p = N₁/N₂', 'middle', 'sm');
  g += T(o + 150, 250, 'naprázdno: příčná větev (ztráty v železe, I₀ několik % I_N)', 'middle', 'sm') + T(o + 150, 270, 'nakrátko: podélné prvky (u_k, ztráty ve vinutí)', 'middle', 'sm');
  return svg(760, 284, g, 'Transformátor: konstrukce a náhradní schéma');
};
}
