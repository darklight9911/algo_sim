/*
 * Shared pieces for local search on 8-queens: state helpers, board, line chart, pseudocode.
 * A state is 8 digits (1-8): the row of the queen in each column, counted from the bottom,
 * exactly like the slides (e.g. "24748552").
 */
(function (ns) {
  'use strict';

  /* ---------- seeded random ---------- */
  ns.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  ns.newSeed = () => (Math.random() * 1e9) | 0;

  /* ---------- 8-queens ---------- */
  const Q = {
    h(s) {
      let c = 0;
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (s[i] === s[j] || Math.abs(s[i] - s[j]) === j - i) c++;
      return c;
    },
    fitness: (s) => 28 - Q.h(s),
    attacked(s) {
      const set = new Set();
      for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (s[i] === s[j] || Math.abs(s[i] - s[j]) === j - i) { set.add(i); set.add(j); }
      return set;
    },
    random: (rnd) => Array.from({ length: 8 }, () => 1 + Math.floor(rnd() * 8)),
    neighbours(s) {
      const out = [];
      for (let c = 0; c < 8; c++) for (let d = 1; d <= 8; d++) {
        if (d === s[c]) continue;
        const t = s.slice(); t[c] = d;
        out.push({ c, d, h: Q.h(t), s: t });
      }
      return out;
    },
    str: (s) => s.join(''),
    parse: (str) => str.split('').map(Number),
  };
  ns.Q = Q;

  /* ---------- board ---------- */
  const QUEEN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 8.6a1.4 1.4 0 1 1 1-.4l2.6 4.6 1.9-6.2a1.4 1.4 0 1 1 1.3-.6L12 11.4l1-5.4a1.4 1.4 0 1 1 1.3.6l1.9 6.2 2.6-4.6a1.4 1.4 0 1 1 1 .4L17.9 17H6.1L4.2 8.6zM6 18.4h12v2.1H6z" fill="currentColor"/></svg>';

  ns.QueenBoard = function QueenBoard(el, opts = {}) {
    el.className = 'qboard' + (opts.mini ? ' mini' : '');
    el.innerHTML = '';
    const cells = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div');
        cell.className = 'qcell ' + ((r + c) % 2 ? 'dark' : 'light');
        cell.innerHTML = `<span class="qnum"></span><span class="queen">${QUEEN}</span>`;
        el.append(cell);
        cells.push(cell);
      }
    }
    const at = (c, d) => cells[(8 - d) * 8 + c];
    return {
      /* v: { s, nums(c,d)->text, best:Set('c,d'), ghost:{c,d,kind}, from:{c,d} } */
      render(v) {
        const att = Q.attacked(v.s);
        for (let c = 0; c < 8; c++) {
          for (let d = 1; d <= 8; d++) {
            const cell = at(c, d);
            const k = `${c},${d}`;
            const isQ = v.s[c] === d;
            const ghost = v.ghost && v.ghost.c === c && v.ghost.d === d;
            const from = v.from && v.from.c === c && v.from.d === d;
            cell.className = `qcell ${(8 - d + c) % 2 ? 'dark' : 'light'}` +
              (isQ ? ' has-q' + (att.has(c) ? ' is-attacked' : ' is-safe') : '') +
              (ghost ? ` has-ghost ghost-${v.ghost.kind}` : '') + (from ? ' is-from' : '') +
              (v.best && v.best.has(k) ? ' is-best' : '');
            const txt = !isQ && v.nums ? v.nums(c, d) : '';
            const num = cell.firstChild;
            if (num.textContent !== String(txt ?? '')) num.textContent = txt ?? '';
          }
        }
      },
    };
  };

  /* ---------- line chart ---------- */
  ns.LineChart = function LineChart(host, series, opts = {}) {
    const W = 300, H = 90;
    const n = Math.max(...series.map((s) => s.values.length));
    const max = opts.max != null ? opts.max : Math.max(1, ...series.flatMap((s) => s.values));
    const x = (i) => (n > 1 ? (i / (n - 1)) * W : 0);
    const y = (v) => H - 4 - (v / max) * (H - 8);
    const id = 'clip' + Math.random().toString(36).slice(2);
    const pathOf = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
    host.innerHTML = `
      <div class="chart">
        <div class="chart-legend">${series.map((s) => `<span class="${s.cls}"><i></i>${s.label}</span>`).join('')}<span class="chart-max">max ${opts.maxLabel || ns.fmt(max)}</span></div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs><clipPath id="${id}"><rect x="0" y="0" width="0" height="${H}"/></clipPath></defs>
          ${opts.ref != null ? `<line class="ref" x1="0" x2="${W}" y1="${y(opts.ref)}" y2="${y(opts.ref)}"/>` : ''}
          ${series.map((s) => `<path class="ghost ${s.cls}" d="${pathOf(s.values)}"/>`).join('')}
          <g clip-path="url(#${id})">${series.map((s) => `<path class="line ${s.cls}" d="${pathOf(s.values)}"/>`).join('')}</g>
          <line class="cursor" x1="0" x2="0" y1="0" y2="${H}"/>
        </svg>
      </div>`;
    const rect = host.querySelector('clipPath rect');
    const cursor = host.querySelector('.cursor');
    return {
      update(i) {
        const px = x(Math.min(i, n - 1));
        rect.setAttribute('width', px + 0.5);
        cursor.setAttribute('x1', px); cursor.setAttribute('x2', px);
      },
    };
  };

  /* ---------- pseudocode with an active line ---------- */
  ns.pseudo = (lines) => `<pre class="pseudo">${lines.map((l, i) => `<span data-line="${i}">${l}</span>`).join('\n')}</pre>`;
  ns.setPseudo = (host, active) => {
    host.querySelectorAll('.pseudo [data-line]').forEach((el) => el.classList.toggle('is-active', active.includes(+el.dataset.line)));
  };

  /* ---------- common page frame ---------- */
  ns.localFrame = (cfg) => `
    <div class="sim">
      <header class="sim-head">
        <div>
          <div class="eyebrow">${cfg.category}</div>
          <h1>${cfg.name}</h1>
          <p class="lede">${cfg.lede}</p>
        </div>
      </header>
      <div data-ref="body"></div>
    </div>`;

  ns.stepCard = (kind, badge, idx, total, title, body) => `
    <div class="step-kicker"><span class="badge badge-${kind}">${badge}</span><span class="step-no">step ${idx + 1} / ${total}</span></div>
    <h2 class="step-title">${title}</h2>
    <div class="step-body">${body}</div>`;
})(window.AlgoSim);
