/* ---------- další schémata (vkládá build.py do bloku figures.js) ---------- */
const pth = (pts, cls) => `<path d="${pts.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('')}" class="${cls}"/>`;
const shaft = (x1, y, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="shl"/>`;

/* Leonardovo soustrojí */
FIG.leonard = () => {
  let g = defs; const y = 120;
  g += T(20, 30, 'síť 3~', 'start', 'b') + L(20, 40, 70, 40) + L(70, 40, 70, y - 22);
  g += shaft(110, y, 330) + mot(90, y, 'M 3~', 24) + mot(200, y, 'G', 24) + mot(300, y, 'B', 16);
  g += T(90, y + 44, 'pohonný motor', 'middle', 'sm') + T(190, y - 32, 'generátor', 'end', 'sm') + T(300, y - 24, 'budič', 'middle', 'sm');
  /* kotvy G a M přímo spojené */
  g += L(200, y - 24, 200, 50) + L(200, 50, 520, 50) + L(520, 50, 520, y - 24) + L(200, y + 24, 200, 200) + L(200, 200, 520, 200) + L(520, 200, 520, y + 24);
  g += arr([[360, 62], [400, 62]], 'kr') + T(380, 80, 'I', 'middle', 'sm') + T(360, 40, 'kotvy spojené napřímo, bez spínacích prvků', 'middle', 'sm');
  g += mot(520, y, 'M', 24) + shaft(544, y, 600) + `<rect x="600" y="${y - 22}" width="70" height="44" rx="6" class="bx"/>` + T(635, y + 5, 'zátěž', 'middle', 'b');
  /* buzení G z budiče přes potenciometr */
  g += L(300, y + 16, 300, 175) + L(300, 175, 260, 175) + `<rect x="226" y="169" width="34" height="12" class="kb"/>` + arr([[232, 192], [256, 162]], 'kr');
  g += coilV(240, 140, 26, 3) + L(240, 166, 240, 169) + L(226, 175, 214, 175) + L(214, 175, 214, 140) + L(214, 140, 240, 140);
  g += T(150, 186, 'buzení G:', 'end', 'sm') + T(150, 202, 'regulace a reverzace', 'end', 'sm');
  /* buzení M */
  g += coilV(570, 160, 30, 3) + L(570, 160, 570, 150) + L(570, 150, 556, 150) + L(570, 190, 556, 190) + T(586, 178, 'buzení M (stálé, nebo odbuzení)', 'start', 'sm');
  g += T(20, 236, 'U_G se mění buzením generátoru od 0 do U_N: plný moment při každé rychlosti; obrácení buzení G = reverzace;', 'start', 'sm');
  g += T(20, 254, 'když U_i motoru > U_G, energie teče zpět: G pracuje jako motor a pohonný motor jako generátor (rekuperace)', 'start', 'sm');
  return svg(760, 266, g, 'Leonardovo soustrojí');
};

/* Svorkovnice a rozběh Y–D */
FIG.yd = () => {
  let g = ''; const term = (x0, y0, mode) => {
    let s = `<rect x="${x0}" y="${y0}" width="170" height="110" rx="8" class="bxm"/>`;
    const top = ['U1', 'V1', 'W1'], bot = ['W2', 'U2', 'V2'];
    for (let i = 0; i < 3; i++) {
      const x = x0 + 35 + i * 50;
      s += L(x, y0 - 30, x, y0 + 30) + T(x, y0 - 36, 'L' + (i + 1), 'middle', 'sm');
      s += `<circle cx="${x}" cy="${y0 + 32}" r="8" class="kb"/>` + T(x, y0 + 54, top[i], 'middle', 'sm') + `<circle cx="${x}" cy="${y0 + 82}" r="8" class="kb"/>` + T(x, y0 + 104, bot[i], 'middle', 'sm');
      if (mode === 'D') s += `<rect x="${x - 4}" y="${y0 + 30}" width="8" height="54" rx="3" class="link"/>`;
    }
    if (mode === 'Y') s += `<rect x="${x0 + 30}" y="${y0 + 78}" width="110" height="8" rx="3" class="link"/>`;
    return s;
  };
  g += T(115, 16, 'Hvězda (Y)', 'middle', 'b') + term(30, 70, 'Y') + T(385, 16, 'Trojúhelník (D)', 'middle', 'b') + term(300, 70, 'D');
  /* schéma vinutí */
  const sx = 115, sy = 238; g += L(sx, sy, sx, sy - 36) + L(sx, sy, sx - 31, sy + 18) + L(sx, sy, sx + 31, sy + 18) + `<circle cx="${sx}" cy="${sy}" r="3" class="kf"/>`;
  const dx = 385, dy = 236; g += `<path d="M${dx} ${dy - 34}L${dx + 32} ${dy + 20}L${dx - 32} ${dy + 20}Z" class="k"/>`;
  g += T(115, 290, 'na vinutí U/√3', 'middle', 'sm') + T(385, 290, 'na vinutí U', 'middle', 'sm');
  const x = 520;
  g += T(x, 70, 'Rozběh: nejdřív Y, po rozběhu přepnout na D', 'start', 'b');
  g += T(x, 100, 'proud ze sítě:  I_Y = I_D / 3', 'start') + T(x, 126, 'moment:  M_Y = M_D / 3', 'start');
  g += T(x, 156, 'jen pro motory, které mají', 'start', 'sm') + T(x, 174, 'v trojúhelníku jmenovité napětí sítě', 'start', 'sm') + T(x, 192, '(např. 400 V D pro síť 3 × 400 V)', 'start', 'sm');
  g += T(x, 222, 'při přepnutí vzniká proudový ráz;', 'start', 'sm') + T(x, 240, 'rozběhem s plnou zátěží se motor', 'start', 'sm') + T(x, 258, 've hvězdě nemusí rozběhnout', 'start', 'sm');
  return svg(760, 300, g, 'Svorkovnice: zapojení do hvězdy a do trojúhelníku, rozběh Y–D');
};

/* Kroužkový motor s rotorovým spouštěčem a momentové charakteristiky */
FIG.kruz = () => {
  let g = '';
  ['L1', 'L2', 'L3'].forEach((n, i) => { g += T(18, 44 + i * 18, n, 'start', 'sm') + L(40, 40 + i * 18, 90, 40 + i * 18); });
  g += `<rect x="90" y="26" width="70" height="66" rx="6" class="bx"/>` + T(125, 64, 'stator', 'middle', 'b');
  /* rotor ve hvězdě */
  const rx = 115, ry = 180;
  for (const a of [0, 120, 240]) { const [x, y] = P(rx, ry, 30, a); g += L(rx, ry, x, y); }
  g += `<circle cx="${rx}" cy="${ry}" r="40" class="kd"/>` + T(rx, ry + 58, 'vinutí rotoru (Y)', 'middle', 'sm');
  for (let i = 0; i < 3; i++) {
    const kx = 200 + i * 26, [x, y] = P(rx, ry, 30, i * 120), yy = 132 - i * 8;
    g += `<ellipse cx="${kx}" cy="180" rx="7" ry="30" class="kb"/>`;
    g += pth([[x, y], [i ? x + (i === 1 ? 14 : -14) : x, y], [i ? x + (i === 1 ? 14 : -14) : x, yy], [kx, yy], [kx, 150]], 'k1');
    g += `<rect x="${kx - 5}" y="212" width="10" height="12" class="kf"/>` + L(kx, 224, kx, 236 + i * 12) + L(kx, 236 + i * 12, 320 + i * 36, 236 + i * 12) + L(320 + i * 36, 236 + i * 12, 320 + i * 36, 262);
  }
  g += shaft(160, 180, 290) + T(272, 156, 'kroužky a kartáče', 'start', 'sm');
  for (let i = 0; i < 3; i++) { const x = 320 + i * 36; g += resV(x, 262, 36) + arr([[x - 14, 306], [x + 12, 268]], 'kr'); }
  g += L(320, 298, 392, 298) + T(356, 326, 'odporník R_p (stupně se vyřazují)', 'middle', 'sm');
  /* charakteristiky n(M) */
  const X0 = 470, Y0 = 250, W = 260, H = 210, Mk = 2.5;
  g += arr([[X0, Y0], [X0 + W, Y0]]) + arr([[X0, Y0], [X0, Y0 - H]]) + T(X0 + W, Y0 + 18, 'M', 'end', 'b') + T(X0 - 6, Y0 - H + 8, 'n', 'end', 'b');
  const sks = [0.12, 0.3, 0.6, 1.0];
  sks.forEach((sk, k) => { const pts = []; for (let i = 0; i <= 80; i++) { const s = 0.0005 + i / 80; const M = 2 * Mk / (s / sk + sk / s); pts.push([X0 + M / 2.7 * W, Y0 - (1 - s) * (H - 20)]); } g += pth(pts, k ? 'kg' : 'kr'); });
  g += L(X0 - 4, Y0 - H + 20, X0 + W - 20, Y0 - H + 20, 'kd') + T(X0 + W - 16, Y0 - H + 24, 'n_s', 'start', 'sm');
  g += T(X0 + 4, Y0 + 34, 'červeně R_p = 0, šedě rostoucí R_p: moment zvratu', 'start', 'sm') + T(X0 + 4, Y0 + 52, 'se nemění, posouvá se k menším otáčkám', 'start', 'sm');
  return svg(760, 336, g, 'Kroužkový motor s rotorovým spouštěčem');
};

/* Komutace */
FIG.komut = () => {
  let g = defs; const y = 150;
  for (let i = 0; i < 7; i++) g += `<rect x="${40 + i * 50}" y="${y}" width="44" height="34" class="cub"/>`;
  g += `<rect x="168" y="${y + 34}" width="62" height="44" rx="3" class="kf"/>` + T(199, y + 100, 'kartáč', 'middle', 'sm');
  /* zkratovaná cívka mezi lamelami 3 a 4 */
  g += `<path d="M184 ${y}L184 110L150 60L262 60L232 110L232 ${y}" class="kr"/>` + T(206, 50, 'komutující cívka (zkratovaná kartáčem)', 'middle', 'sm');
  g += `<path d="M84 ${y}L84 110L70 80M134 ${y}L134 110L120 80" class="k1"/><path d="M284 ${y}L284 110L298 80M334 ${y}L334 110L348 80" class="k1"/>`;
  g += arr([[70, 128], [150, 128]]) + T(110, 120, 'i_a/2', 'middle', 'sm') + arr([[340, 128], [262, 128]]) + T(300, 120, 'i_a/2', 'middle', 'sm');
  g += arr([[300, y + 60], [370, y + 60]]) + T(335, y + 80, 'pohyb lamel v', 'middle', 'sm');
  g += T(40, 270, 'Během T_k se proud cívky musí obrátit z +i_a/2 na −i_a/2.', 'start', 'sm');
  /* průběhy */
  const X0 = 450, Ym = 140, W = 270, A = 80;
  g += arr([[X0, Ym], [X0 + W + 10, Ym]]) + L(X0, Ym - A - 14, X0, Ym + A + 14) + T(X0 + W + 10, Ym + 18, 't', 'end', 'b') + T(X0 - 6, Ym - A + 4, '+i_a/2', 'end', 'sm') + T(X0 - 6, Ym + A + 4, '−i_a/2', 'end', 'sm');
  g += L(X0 + W, Ym - A - 6, X0 + W, Ym + A + 6, 'kd') + T(X0 + W, Ym + A + 24, 'T_k', 'middle', 'sm');
  const cv = f => { const p = []; for (let i = 0; i <= 50; i++) { const x = i / 50; p.push([X0 + x * W, Ym - A * f(x)]); } return p; };
  g += pth(cv(x => 1 - 2 * x), 'k') + pth(cv(x => 1 - 2 * Math.pow(x, 2.2)), 'kr') + pth(cv(x => 1 - 2 * (1 - Math.pow(1 - x, 2.2))), 'kbl');
  g += T(X0 + 60, Ym - 92, 'zpožděná: jiskření na odbíhající hraně', 'start', 'sm') + T(X0 + 120, Ym - 6, 'přímková', 'start', 'sm') + T(X0 + 30, Ym + 64, 'urychlená', 'start', 'sm');
  g += T(450, 270, 'Zpoždění způsobuje reaktanční napětí; ruší ho pomocné póly.', 'start', 'sm');
  return svg(760, 284, g, 'Komutace stejnosměrného stroje');
};

/* Reakce kotvy: rozložení indukce */
FIG.reakce = () => {
  let g = ''; const X0 = 60, W = 640, ym = 160, A = 70, tau = W / 2;
  const X = u => X0 + u * tau;
  g += `<rect x="${X(0.175)}" y="28" width="${0.65 * tau}" height="34" rx="4" class="fe2"/><rect x="${X(1.175)}" y="28" width="${0.65 * tau}" height="34" rx="4" class="fe2"/>`;
  g += T(X(0.5), 51, 'N', 'middle', 'b pole') + T(X(1.5), 51, 'S', 'middle', 'b pole');
  g += L(X0, 72, X0 + W, 72, 'k1') + T(X0 + W, 90, 'kotva (rozvinutá)', 'end', 'sm');
  g += L(X0, ym, X0 + W, ym, 'kg');
  const Bf = u => { const m = ((u % 2) + 2) % 2, sg = m < 1 ? 1 : -1, d = Math.abs((m % 1) - 0.5); return sg * (d < 0.325 ? 1 : d < 0.4 ? 1 - (d - 0.325) / 0.075 : 0); };
  const Ba = u => { const m = ((u % 2) + 2) % 2; return m < 1 ? 0.55 * (m - 0.5) * 2 : -0.55 * (m - 1.5) * 2; };
  const cvv = f => { const p = []; for (let i = 0; i <= 200; i++) { const u = i / 100; p.push([X(u), ym - A * f(u)]); } return p; };
  g += pth(cvv(Bf), 'k') + pth(cvv(Ba), 'kbl') + pth(cvv(u => Bf(u) + Ba(u) * (0.35 + 0.65 * Math.abs(Bf(u)))), 'kr');
  for (const u of [0, 1, 2]) g += L(X(u), 80, X(u), 250, 'kd');
  g += T(X(1), 266, 'geometrická neutrála', 'middle', 'sm');
  g += T(X0, 296, 'černě hlavní pole B_f, modře pole kotvy B_a (největší v neutrále), červeně výsledné: pod jednou hranou pólu zesílené, pod druhou zeslabené;', 'start', 'sm');
  g += T(X0, 314, 'nulová indukce (magnetická neutrála) se posune. Při nasycení zesílené hrany se celkový tok zmenší.', 'start', 'sm');
  return svg(760, 326, g, 'Reakce kotvy: rozložení indukce ve vzduchové mezeře');
};

/* Točivé magnetické pole */
FIG.tocive = () => {
  let g = defs; const X0 = 40, W = 330, ym = 130, A = 80, r = Math.PI / 180;
  g += L(X0, ym, X0 + W, ym, 'kg') + T(X0 + W, ym + 18, 'ωt', 'end', 'sm');
  const ph = [[0, 'kr', 'i_a'], [-120, 'k', 'i_b'], [120, 'kbl', 'i_c']];
  for (const [o, c, nm] of ph) { const p = []; for (let i = 0; i <= 90; i++) { const a = i * 4; p.push([X0 + a / 360 * W, ym - A * Math.cos((a + o) * r)]); } g += pth(p, c); }
  g += T(X0 + 6, ym - A - 6, 'i_a', 'start', 'sm') + T(X0 + 120, ym - A + 6, 'i_b', 'start', 'sm') + T(X0 + 230, ym - A + 6, 'i_c', 'start', 'sm');
  [0, 60, 120].forEach((a, k) => { const x = X0 + a / 360 * W; g += L(x, ym - A - 20, x, ym + A + 10, 'kd') + T(x + 3, ym + A + 26, ['①', '②', '③'][k], 'middle', 'b'); });
  [0, 60, 120].forEach((a, k) => {
    const cx = 450 + k * 110, cy = 120;
    g += `<circle cx="${cx}" cy="${cy}" r="44" class="fe3"/><circle cx="${cx}" cy="${cy}" r="26" class="slot"/>`;
    for (const [b, nm] of [[0, 'a'], [120, 'b'], [240, 'c']]) { const x = cx + 50 * Math.cos(b * r), y = cy - 50 * Math.sin(b * r); g += T(x, y + 4, nm, 'middle', 'sm'); }
    const x2 = cx + 38 * Math.cos(a * r), y2 = cy - 38 * Math.sin(a * r);
    g += arr([[cx, cy], [x2, y2]], 'kr') + T(cx, cy + 74, ['①', '②', '③'][k] + ' ωt = ' + a + '°', 'middle', 'sm');
  });
  g += T(410, 232, 'Výsledný vektor má stálou velikost', 'start', 'sm') + T(410, 250, '(3/2 amplitudy fáze), otáčí se s ωt: n_s = 60 f / p', 'start', 'sm');
  g += T(X0, 262, 'Souměrné proudy, vinutí posunutá o 120°', 'start', 'sm');
  return svg(760, 274, g, 'Vznik točivého magnetického pole');
};

/* Rovina Ω–M a kvadranty */
FIG.kvadr = () => {
  let g = defs; const cx = 230, cy = 140, a = 120, b = 115;
  g += arr([[cx - a, cy], [cx + a, cy]]) + arr([[cx, cy + b], [cx, cy - b]]) + T(cx + a, cy + 18, 'M', 'end', 'b') + T(cx + 8, cy - b + 10, 'Ω', 'start', 'b');
  const q = [[1, 1, 'I', 'motor vpřed'], [-1, 1, 'II', 'brzda vpřed'], [-1, -1, 'III', 'motor vzad'], [1, -1, 'IV', 'brzda vzad']];
  for (const [sx, sy, n, t] of q) { const x = cx + sx * 64, y = cy - sy * 58; g += T(x, y - 4, n, 'middle', 'b') + T(x, y + 14, t, 'middle', 'sm'); }
  g += pth([[cx - 110, cy - 96], [cx + 100, cy - 74]], 'kr') + T(cx + 104, cy - 70, 'DC motor, U = U_N', 'start', 'sm');
  const x = 420;
  g += T(x, 46, 'P = M · Ω', 'start', 'b');
  g += T(x, 74, 'I a III: P > 0, energie jde ze zdroje do zátěže', 'start', 'sm') + T(x, 94, 'II a IV: P < 0, stroj brzdí, energie jde zpět', 'start', 'sm');
  g += T(x, 114, 'do zdroje (rekuperace) nebo do odporu', 'start', 'sm');
  g += T(x, 144, 'Jednokvadrantový pohon: jen I', 'start', 'sm') + T(x, 164, 'Dvoukvadrantový: I a II (brzdění) nebo I a IV', 'start', 'sm') + T(x, 184, 'Čtyřkvadrantový: reverzace i brzdění v obou', 'start', 'sm') + T(x, 204, 'směrech (např. jeřáb, válcovací stolice)', 'start', 'sm');
  return svg(760, 270, g, 'Rovina Ω–M: čtyři kvadranty');
};

/* Momentová charakteristika asynchronního stroje M(s) */
FIG.mschar = () => {
  let g = defs; const X0 = 60, W = 470, ym = 150, A = 100, s0 = -1, s1 = 2, sk = 0.2, Mk = 1;
  const X = s => X0 + (s1 - s) / (s1 - s0) * W, Y = M => ym - M * A;
  g += arr([[X0, ym], [X0 + W + 14, ym]]) + T(X0 + W + 14, ym + 18, 'n', 'end', 'b') + L(X(0), ym - A - 26, X(0), ym + A + 16, 'kd') + L(X(1), ym - A - 26, X(1), ym + A + 16, 'k1');
  g += T(X(0), ym + A + 32, 's = 0 (n_s)', 'middle', 'sm') + T(X(1), ym + A + 32, 's = 1 (n = 0)', 'middle', 'sm');
  const p = []; for (let i = 0; i <= 300; i++) { const s = s1 - i / 300 * (s1 - s0); const M = Math.abs(s) < 1e-6 ? 0 : 2 * Mk / (s / sk + sk / s); p.push([X(s), Y(M)]); }
  g += pth(p, 'kr');
  g += `<circle cx="${f1(X(sk))}" cy="${f1(Y(Mk))}" r="4" class="kf"/>` + T(X(sk) - 6, Y(Mk) - 10, 'M_zv při s_zv', 'end', 'sm');
  const Mz = 2 * Mk / (1 / sk + sk); g += `<circle cx="${f1(X(1))}" cy="${f1(Y(Mz))}" r="4" class="kf"/>` + T(X(1) + 8, Y(Mz) - 8, 'záběrný moment', 'start', 'sm');
  g += L(X(0.04), Y(0.39), X(0.04) + 1, Y(0.39)) + `<circle cx="${f1(X(0.04))}" cy="${f1(Y(2 * Mk / (0.04 / sk + sk / 0.04)))}" r="4" class="kf"/>` + T(X(0.04) + 8, Y(0.38) + 4, 'M_N', 'start', 'sm');
  g += T(X(1.5), ym - A - 10, 'brzda (s > 1)', 'middle', 'b') + T(X(0.5), ym + 40, 'motor (0 < s < 1)', 'middle', 'b') + T(X(-0.5), ym + A - 10, 'generátor (s < 0)', 'middle', 'b');
  const x = 570;
  g += T(x, 50, 'Klossův vztah (R₁ ≈ 0):', 'start', 'b') + T(x, 76, 'M = 2 M_zv / (s/s_zv + s_zv/s)', 'start', 'sm');
  g += T(x, 104, 'malý skluz: M ≈ 2 M_zv s / s_zv', 'start', 'sm') + T(x, 124, '(tvrdá, téměř přímková část)', 'start', 'sm');
  g += T(x, 152, 's_zv ~ R₂, M_zv ~ U²', 'start', 'sm') + T(x, 180, 'stabilní chod: 0 < s < s_zv', 'start', 'sm');
  return svg(760, 300, g, 'Momentová charakteristika asynchronního stroje');
};

/* Fázorový diagram transformátoru (Kappův trojúhelník) */
FIG.trafoph = () => {
  let g = defs; const o = [60, 190], sc = 270, phi = 37 * Math.PI / 180, Rk = 0.12, Xk = 0.26, Ik = 0.6;
  const U2 = [1, 0], I = [Ik * Math.cos(-phi), Ik * Math.sin(-phi)], RI = [Rk * I[0], Rk * I[1]], XI = [-Xk * I[1], Xk * I[0]];
  const pt = v => [o[0] + v[0] * sc, o[1] - v[1] * sc], A = [U2[0] + RI[0], U2[1] + RI[1]], U1 = [A[0] + XI[0], A[1] + XI[1]];
  g += arr([o, pt(U2)]) + T(pt(U2)[0] - 20, pt(U2)[1] + 20, 'U₂′', 'middle', 'b');
  g += arr([o, pt(I)], 'kr') + T(pt(I)[0] + 8, pt(I)[1] + 4, 'I', 'start', 'b');
  g += arr([pt(U2), pt(A)], 'kbl') + T(pt(A)[0] + 8, pt(A)[1] + 16, 'R_k I', 'start', 'sm');
  g += arr([pt(A), pt(U1)], 'kbl') + T((pt(A)[0] + pt(U1)[0]) / 2 + 10, (pt(A)[1] + pt(U1)[1]) / 2 + 4, 'jX_k I', 'start', 'sm');
  g += arr([o, pt(U1)]) + T(pt(U1)[0] - 4, pt(U1)[1] - 10, 'U₁', 'end', 'b');
  g += `<path d="M${o[0] + 60} ${o[1]}A60 60 0 0 1 ${f1(o[0] + 60 * Math.cos(phi))} ${f1(o[1] + 60 * Math.sin(phi))}" class="ld"/>` + T(o[0] + 70, o[1] + 26, 'φ₂', 'start', 'b');
  const x = 470;
  g += T(x, 50, 'Zjednodušené náhradní schéma', 'start', 'b') + T(x, 70, '(bez příčné větve):', 'start', 'b');
  g += T(x, 98, 'U₁ = U₂′ + (R_k + jX_k) I', 'start', 'sm') + T(x, 126, 'Δu ≈ u_R cos φ₂ + u_X sin φ₂', 'start', 'sm');
  g += T(x, 154, 'největší při φ₂ = φ_k (Δu = u_k),', 'start', 'sm') + T(x, 174, 'při kapacitní zátěži může být záporný', 'start', 'sm');
  g += T(x, 202, 'trojúhelník R_k I, jX_k I je zvětšený', 'start', 'sm');
  return svg(760, 260, g, 'Fázorový diagram transformátoru (Kappův trojúhelník)');
};

/* Hodinový úhel */
FIG.hodiny = () => {
  let g = defs;
  [['Yy0', 0, 'hvězda / hvězda'], ['Yd1', 30, 'hvězda / trojúhelník'], ['Dy5', 150, 'trojúhelník / hvězda']].forEach(([n, ang, t], k) => {
    const cx = 120 + k * 240, cy = 120;
    g += `<circle cx="${cx}" cy="${cy}" r="76" class="kb"/>`;
    for (let h = 0; h < 12; h++) { const [x1, y1] = P(cx, cy, 70, h * 30), [x2, y2] = P(cx, cy, h % 3 ? 64 : 58, h * 30); g += L(x1, y1, x2, y2, 'k1'); }
    for (const h of [3, 6, 9]) { const [x, y] = P(cx, cy, 46, h * 30); g += T(x, y + 5, h, 'middle', 'sm'); }
    g += arr([[cx, cy], P(cx, cy, 62, 0)]) + arr([[cx, cy], P(cx, cy, 40, ang)], 'kr') + `<circle cx="${cx}" cy="${cy}" r="4" class="kf"/>`;
    g += T(cx, cy + 102, n, 'middle', 'b') + T(cx, cy + 120, t, 'middle', 'sm');
  });
  g += T(20, 270, 'Dlouhá ručička: napětí vyššího napětí na 12; krátká (červená): odpovídající napětí nižšího napětí. Číslo = posun v násobcích 30°.', 'start', 'sm');
  return svg(760, 282, g, 'Hodinový úhel trojfázového transformátoru');
};

/* Nabuzení derivačního dynama */
FIG.dynamo = () => {
  let g = defs; const X0 = 60, Y0 = 250, W = 420, H = 210, Ur = 0.06;
  const U = i => Ur + (1 - Ur) * Math.tanh(1.6 * i);
  const X = i => X0 + i / 1.6 * W, Y = u => Y0 - u / 1.25 * H;
  g += arr([[X0, Y0], [X0 + W + 10, Y0]]) + arr([[X0, Y0], [X0, Y0 - H - 10]]) + T(X0 + W + 10, Y0 + 18, 'I_f', 'end', 'b') + T(X0 - 8, Y0 - H, 'U₀', 'end', 'b');
  const p = []; for (let i = 0; i <= 80; i++) { const x = i / 80 * 1.6; p.push([X(x), Y(U(x))]); } g += pth(p, 'kr') + T(X(1.5), Y(U(1.5)) - 10, 'charakteristika naprázdno', 'end', 'sm');
  g += T(X0 + 6, Y(Ur) + 4, 'U_r', 'start', 'sm');
  for (const [k, cls, t] of [[0.85, 'k', 'R < R_kr: ustálí se v průsečíku'], [1.6 + Ur * 1.3, 'kbl', 'R = R_kr (kritický odpor)'], [3.2, 'kg', 'R > R_kr: nenabudí se']]) {
    const i2 = Math.min(1.6, 1.2 / k); g += L(X(0), Y(0), X(i2), Y(k * i2), cls);
    const ly = 226 + [0.85, 3.2].indexOf(k) * 0 + (k === 0.85 ? 0 : k > 3 ? 40 : 20); g += L(560, ly - 4, 590, ly - 4, cls) + T(598, ly, t, 'start', 'sm');
  }
  const x = 560;
  g += T(x, 60, 'Podmínky nabuzení:', 'start', 'b') + T(x, 86, '1. remanentní tok', 'start', 'sm') + T(x, 106, '2. budicí proud zesiluje remanenci', 'start', 'sm') + T(x, 126, '3. odpor obvodu buzení menší', 'start', 'sm') + T(x, 144, '    než kritický', 'start', 'sm');
  g += T(x, 176, 'Odporová přímka: U = R · I_f', 'start', 'sm') + T(x, 196, 'Kritický odpor roste s otáčkami.', 'start', 'sm');
  return svg(800, 280, g, 'Nabuzení derivačního dynama');
};

/* Fázování alternátoru na síť */
FIG.fazovani = () => {
  let g = defs;
  g += T(20, 30, 'síť 3~', 'start', 'b');
  for (let i = 0; i < 3; i++) g += L(20, 46 + i * 16, 420, 46 + i * 16) + T(430, 50 + i * 16, 'L' + (i + 1), 'start', 'sm');
  for (let i = 0; i < 3; i++) { const x = 150 + i * 40; g += L(x, 46 + i * 16, x, 120) + `<circle cx="${x}" cy="120" r="3" class="kf"/>` + L(x, 120, x + 12, 136) + L(x, 140, x, 190); }
  g += T(282, 132, 'vypínač', 'start', 'sm');
  g += mot(190, 220, 'G 3~', 30) + shaft(220, 220, 300) + `<rect x="300" y="200" width="80" height="40" rx="6" class="bx"/>` + T(340, 225, 'turbína', 'middle', 'b');
  for (let i = 0; i < 3; i++) { const x = 70 + i * 26; g += `<circle cx="${x}" cy="160" r="10" class="kb"/>` + L(x - 6, 154, x + 6, 166, 'k1') + L(x + 6, 154, x - 6, 166, 'k1'); }
  g += T(96, 190, 'žárovky (tmavé = shoda)', 'middle', 'sm');
  const x = 480;
  g += T(x, 90, 'Podmínky fázování:', 'start', 'b') + T(x, 116, '1. stejný sled fází', 'start', 'sm') + T(x, 136, '2. stejná velikost napětí (buzením)', 'start', 'sm') + T(x, 156, '3. stejný kmitočet (otáčkami turbíny)', 'start', 'sm') + T(x, 176, '4. stejná fáze v okamžiku sepnutí', 'start', 'sm') + T(x, 196, 'teprve pak sepnout vypínač', 'start', 'sm');
  g += T(x, 226, 'Po připojení: činný výkon řídí turbína,', 'start', 'sm') + T(x, 246, 'jalový výkon buzení.', 'start', 'sm');
  return svg(760, 262, g, 'Fázování synchronního alternátoru na síť');
};
