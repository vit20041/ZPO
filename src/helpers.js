const $ = s => document.querySelector(s);
const fmt = (v, d = 0) => (v == null || !isFinite(v)) ? '–' : v.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
const r3 = v => +(+v).toPrecision(3);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* „L_d“ → L<sub>d</sub> (jen pro texty napsané v této stránce) */
const sub = s => String(s).replace(/_\(([^)]+)\)/g, '<sub>$1</sub>').replace(/_([A-Za-zΣσμωΩφψξϑ0-9*]+)/g, '<sub>$1</sub>');
const bis = (a, v) => { let lo = 0, hi = a.length - 1; if (hi < 1) return 0; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m; else hi = m; } return (v - a[lo] < a[hi] - v) ? lo : hi; };
function ticks(lo, hi, n) {
  const span = hi - lo, step0 = span / Math.max(1, n), mag = 10 ** Math.floor(Math.log10(step0)), r = step0 / mag;
  const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6 && out.length < 40; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out.length > 1 ? out : [lo, hi];
}
