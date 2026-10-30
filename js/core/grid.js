/*
 * Grid playground for BFS, DFS, UCS, Greedy best-first and A*.
 *   AlgoSim.mountGrid(host, cfg)  — cfg.mode in bfs | dfs | ucs | greedy | astar
 */
(function (ns) {
  'use strict';

  const { fmt } = ns;
  const COLS = 41;
  const ROWS = 23;
  const N = COLS * ROWS;
  const SQRT2 = Math.SQRT2;
  const S_NONE = 0, S_OPEN = 1, S_CLOSED = 2;

  const HEURISTICS = {
    octile: { name: 'Octile', fn: (dx, dy) => dx + dy + (SQRT2 - 2) * Math.min(dx, dy) },
    manhattan: { name: 'Manhattan', fn: (dx, dy) => dx + dy },
    euclidean: { name: 'Euclidean', fn: (dx, dy) => Math.hypot(dx, dy) },
    chebyshev: { name: 'Chebyshev', fn: (dx, dy) => Math.max(dx, dy) },
  };

  class MinHeap {
    constructor(less) { this.a = []; this.less = less; }
    get size() { return this.a.length; }
    push(v) {
      const a = this.a; a.push(v);
      let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (!this.less(a[i], a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; }
    }
    pop() {
      const a = this.a; const top = a[0]; const last = a.pop();
      if (a.length) {
        a[0] = last; let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1; let m = i;
          if (l < a.length && this.less(a[l], a[m])) m = l;
          if (r < a.length && this.less(a[r], a[m])) m = r;
          if (m === i) break;
          [a[i], a[m]] = [a[m], a[i]]; i = m;
        }
      }
      return top;
    }
  }

  function solve({ walls, start, goal, heuristic, diagonal, mode }) {
    const g = new Float64Array(N).fill(Infinity);
    const parent = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const gx = goal % COLS, gy = (goal / COLS) | 0;
    const hfn = HEURISTICS[heuristic].fn;
    const h = (i) => hfn(Math.abs((i % COLS) - gx), Math.abs(((i / COLS) | 0) - gy));

    const dirs = [[1, 0, 1], [0, 1, 1], [-1, 0, 1], [0, -1, 1]];
    if (diagonal) dirs.push([1, 1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2], [1, -1, SQRT2]);

    // Frontier: queue, stack or priority queue depending on the algorithm
    let push, pop, size;
    if (mode === 'bfs') {
      const q = []; let head = 0;
      push = (e) => q.push(e); pop = () => q[head++]; size = () => q.length - head;
    } else if (mode === 'dfs') {
      const s = [];
      push = (e) => s.push(e); pop = () => s.pop(); size = () => s.length;
    } else {
      const key = { ucs: (e) => e.g, greedy: (e) => e.h, astar: (e) => e.g + e.h }[mode];
      const heap = new MinHeap((a, b) => (key(a) - key(b) || a.h - b.h || a.o - b.o) < 0);
      push = (e) => heap.push(e); pop = () => heap.pop(); size = () => heap.size;
    }
    const discoverOnce = mode === 'bfs' || mode === 'dfs' || mode === 'greedy';

    let order = 0;
    g[start] = 0;
    push({ i: start, g: 0, h: h(start), o: order++ });
    const steps = [{ cur: -1, opened: [start, 0, -1] }];
    let found = false;

    while (size()) {
      const top = pop();
      const cur = top.i;
      if (closed[cur] || top.g > g[cur]) continue;
      if (cur === goal) { steps.push({ cur, opened: [], done: true }); found = true; break; }
      closed[cur] = 1;

      const cx = cur % COLS, cy = (cur / COLS) | 0;
      const opened = [];
      const order8 = mode === 'dfs' ? dirs.slice().reverse() : dirs;
      for (const [dx, dy, cost] of order8) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const ni = ny * COLS + nx;
        if (walls[ni]) continue;
        if (dx && dy && (walls[cy * COLS + nx] || walls[ny * COLS + cx])) continue;
        const ng = g[cur] + cost;
        if (discoverOnce ? g[ni] === Infinity : ng < g[ni] - 1e-9) {
          g[ni] = ng; parent[ni] = cur; closed[ni] = 0;
          push({ i: ni, g: ng, h: h(ni), o: order++ });
          opened.push(ni, ng, cur);
        }
      }
      steps.push({ cur, opened });
    }
    const path = [];
    if (found) for (let c = goal; c !== -1; c = parent[c]) path.unshift(c);
    return { steps, path, found, cost: found ? g[goal] : Infinity, h };
  }

  ns.mountGrid = function mountGrid(host, cfg) {
    const mode = cfg.mode;
    const usesH = mode === 'greedy' || mode === 'astar';
    const walls = new Uint8Array(N);
    let start = 11 * COLS + 7;
    let goal = 11 * COLS + 33;
    let heuristic = 'octile';
    let diagonal = mode !== 'bfs' && mode !== 'dfs';
    let result = null;
    let hover = -1;
    let drag = null;

    for (let y = 4; y <= 18; y++) walls[y * COLS + 20] = 1;
    for (let x = 14; x <= 20; x++) { walls[4 * COLS + x] = 1; walls[18 * COLS + x] = 1; }

    const hOptions = Object.entries(HEURISTICS).map(([k, v]) => `<option value="${k}"${k === heuristic ? ' selected' : ''}>${v.name}</option>`).join('');
    const frontierName = { bfs: 'Queue', dfs: 'Stack', ucs: 'Frontier', greedy: 'Frontier', astar: 'Frontier' }[mode];

    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar">
            ${usesH ? `<label class="field"><span>Heuristic</span><select class="select" data-ref="heur">${hOptions}</select></label>` : ''}
            <label class="switch"><input type="checkbox" data-ref="diag"${diagonal ? ' checked' : ''}><span class="switch-track"></span>Diagonal moves</label>
            <span class="sep"></span>
            <div class="btn-row">
              <button class="btn" data-ref="maze" type="button">Maze</button>
              <button class="btn" data-ref="scatter" type="button">Scatter</button>
              <button class="btn" data-ref="clear" type="button">Clear</button>
            </div>
            <span class="toolbar-hint">Drag to draw walls · drag start / goal to move</span>
          </div>
          <div class="card stage">
            <div class="grid-wrap" data-ref="wrap"><canvas data-ref="canvas" aria-label="Grid"></canvas></div>
            <div class="legend square">
              <span><i class="lg-start" style="border-radius:50%"></i>Start</span>
              <span><i class="lg-goal" style="border-radius:50%"></i>Goal</span>
              <span><i class="lg-wall"></i>Wall</span>
              <span><i class="lg-open"></i>${frontierName}</span>
              <span><i class="lg-closed"></i>Explored</span>
              <span><i class="lg-current"></i>Current</span>
              <span><i class="lg-path"></i>Path</span>
            </div>
          </div>
          <div data-ref="player"></div>
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card">
            <header class="card-head"><h3>Progress</h3></header>
            <div class="stats" data-ref="stats"></div>
          </section>
          <section class="card">
            <header class="card-head"><h3>Cell under cursor</h3><span class="count" data-ref="hpos">–</span></header>
            <div data-ref="hover"></div>
          </section>
          <section class="card">
            <details class="learn" open>
              <summary>What to try</summary>
              <ul>${(cfg.gridTips || []).map((t) => `<li>${t}</li>`).join('')}</ul>
            </details>
          </section>
        </aside>
      </div>`;

    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const canvas = $('canvas');
    const ctx = canvas.getContext('2d');
    const wrap = $('wrap');

    const rs = { upTo: -1, state: new Uint8Array(N), g: new Float64Array(N), par: new Int32Array(N), expanded: 0, open: 0 };
    function resetReplay() { rs.upTo = -1; rs.state.fill(0); rs.g.fill(Infinity); rs.par.fill(-1); rs.expanded = 0; rs.open = 0; }
    function replayTo(i) {
      if (i < rs.upTo) resetReplay();
      for (let k = rs.upTo + 1; k <= i; k++) {
        const s = result.steps[k];
        if (s.cur >= 0) {
          if (rs.state[s.cur] === S_OPEN) rs.open--;
          rs.state[s.cur] = S_CLOSED;
          rs.expanded++;
        }
        const o = s.opened;
        for (let j = 0; j < o.length; j += 3) {
          if (rs.state[o[j]] !== S_OPEN) rs.open++;
          rs.state[o[j]] = S_OPEN; rs.g[o[j]] = o[j + 1]; rs.par[o[j]] = o[j + 2];
        }
      }
      rs.upTo = i;
    }

    const player = new ns.Player($('player'), { onRender: render, speed: 7 });

    function recompute(keepEnd) {
      const wasEnd = keepEnd ?? (player.atEnd && player.total > 1);
      player.pause();
      result = solve({ walls, start, goal, heuristic, diagonal, mode });
      resetReplay();
      player.load(result.steps.length, wasEnd ? result.steps.length - 1 : 0);
    }

    let colors = {};
    function readColors() {
      const v = (n) => ns.cssVar(host, n);
      colors = {
        bg: v('--panel'), cell: v('--cell'), wall: v('--wall'), open: v('--open'), openSoft: v('--open-soft'),
        explored: v('--explored'), accent: v('--accent'), path: v('--path'), goal: v('--goal'), panel: v('--panel'), muted: v('--muted'),
      };
    }

    let cs = 20;
    function resize() {
      const w = wrap.clientWidth - 24;
      cs = Math.max(6, Math.floor(w / COLS));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = cs * COLS + 'px';
      canvas.style.height = cs * ROWS + 'px';
      canvas.width = cs * COLS * dpr;
      canvas.height = cs * ROWS * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function rrect(x, y, w, h, r) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    }

    function draw() {
      if (!result) return;
      const i = player.index;
      const st = result.steps[i];
      const last = i === result.steps.length - 1;
      const fresh = new Set();
      for (let j = 0; j < st.opened.length; j += 3) fresh.add(st.opened[j]);

      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, cs * COLS, cs * ROWS);
      const gap = cs > 14 ? 1.5 : 1;
      const r = Math.max(2, cs * 0.18);

      for (let c = 0; c < N; c++) {
        const x = (c % COLS) * cs, y = ((c / COLS) | 0) * cs;
        if (walls[c]) { ctx.fillStyle = colors.wall; ctx.fillRect(x, y, cs, cs); continue; }
        ctx.fillStyle = rs.state[c] === S_CLOSED ? colors.explored : rs.state[c] === S_OPEN ? colors.openSoft : colors.cell;
        rrect(x + gap, y + gap, cs - gap * 2, cs - gap * 2, r); ctx.fill();
        if (rs.state[c] === S_OPEN) {
          ctx.strokeStyle = colors.open;
          ctx.globalAlpha = fresh.has(c) ? 1 : 0.45;
          ctx.lineWidth = 1.5;
          rrect(x + gap + 0.75, y + gap + 0.75, cs - gap * 2 - 1.5, cs - gap * 2 - 1.5, r); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      if (st.cur >= 0 && !st.done) {
        ctx.fillStyle = colors.accent;
        rrect((st.cur % COLS) * cs + gap, ((st.cur / COLS) | 0) * cs + gap, cs - gap * 2, cs - gap * 2, r); ctx.fill();
      }

      let line = [];
      const final = last && result.found;
      if (final) line = result.path;
      else if (st.cur >= 0) for (let c = st.cur; c !== -1; c = rs.par[c]) line.unshift(c);
      if (line.length > 1) {
        ctx.strokeStyle = final ? colors.path : colors.accent;
        ctx.globalAlpha = final ? 1 : 0.55;
        ctx.lineWidth = Math.max(2, cs * (final ? 0.3 : 0.16));
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        line.forEach((c, k) => {
          const x = (c % COLS) * cs + cs / 2, y = ((c / COLS) | 0) * cs + cs / 2;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const dot = (c, rad, color) => {
        ctx.fillStyle = color; ctx.beginPath();
        ctx.arc((c % COLS) * cs + cs / 2, ((c / COLS) | 0) * cs + cs / 2, cs * rad, 0, Math.PI * 2); ctx.fill();
      };
      dot(start, 0.42, colors.accent); dot(start, 0.16, colors.panel);
      dot(goal, 0.42, colors.goal); dot(goal, 0.27, colors.panel); dot(goal, 0.13, colors.goal);

      if (hover >= 0 && !drag) {
        ctx.strokeStyle = colors.muted; ctx.lineWidth = 1.5;
        rrect((hover % COLS) * cs + 1, ((hover / COLS) | 0) * cs + 1, cs - 2, cs - 2, r); ctx.stroke();
      }
    }

    const xy = (c) => `(${c % COLS}, ${(c / COLS) | 0})`;

    function render(i) {
      replayTo(i);
      draw();
      const st = result.steps[i];
      const last = i === result.steps.length - 1;
      let kind, title, body;
      let warn = '';
      if (mode === 'astar' && diagonal && heuristic === 'manhattan') warn = '<div class="note warn">Manhattan distance overestimates when diagonal moves are allowed, so this path is not guaranteed to be the shortest.</div>';
      if (mode === 'bfs' && diagonal) warn = '<div class="note warn">With diagonal moves the step costs differ (1 vs 1.4). BFS finds the path with the fewest moves, which may not be the cheapest.</div>';
      if (mode === 'dfs') warn = '<div class="note">DFS finds <i>a</i> path, usually far from the shortest. Compare the cost with BFS or A*.</div>';
      if (mode === 'greedy') warn = '<div class="note">Greedy only looks at h, so it rushes toward the goal and may take a longer path.</div>';

      if (i === 0) {
        kind = 'init'; title = 'Put the start cell in the frontier';
        body = `Start cell <b>${xy(start)}</b> is the only cell in the ${frontierName.toLowerCase()}. Press play or <kbd>→</kbd> to step.`;
      } else if (st.done) {
        kind = 'done'; title = 'Goal reached';
        body = `Path of <b>${result.path.length - 1} moves</b> with cost <b>${fmt(result.cost)}</b>, found after expanding <b>${rs.expanded - 1}</b> cells.${warn}`;
      } else {
        kind = 'expand';
        const gv = rs.g[st.cur], hv = result.h(st.cur);
        title = `Expand ${xy(st.cur)}`;
        const why = {
          bfs: `It is at the <b>front of the queue</b> (FIFO).`,
          dfs: `It is on <b>top of the stack</b> (LIFO): the most recently added cell.`,
          ucs: `Lowest path cost: <span class="eq">g = ${fmt(gv)}</span>.`,
          greedy: `Looks closest to the goal: lowest <span class="eq">h = ${fmt(hv)}</span>.`,
          astar: `Lowest <span class="eq">f = ${fmt(gv)} + ${fmt(hv)} = ${fmt(gv + hv)}</span>.`,
        }[mode];
        const n = st.opened.length / 3;
        body = `${why} ${n ? `${n} neighbour${n === 1 ? '' : 's'} added to the ${frontierName.toLowerCase()}.` : 'No new neighbours.'}`;
        if (last && !result.found) { kind = 'fail'; title = 'No path'; body = 'The frontier is empty: walls completely separate the start from the goal.'; }
      }
      $('step').innerHTML = `
        <div class="step-kicker"><span class="badge badge-${kind}">${{ init: 'Start', expand: 'Expand', done: 'Done', fail: 'Failed' }[kind]}</span>
        <span class="step-no">step ${i + 1} / ${result.steps.length}</span></div>
        <h2 class="step-title">${title}</h2>
        <div class="step-body">${body}</div>`;

      const done = last && result.found;
      $('stats').innerHTML = `
        <div class="stat"><div class="k">Expanded</div><div class="v">${Math.max(0, rs.expanded - (st.done ? 1 : 0))}</div></div>
        <div class="stat"><div class="k">In ${frontierName.toLowerCase()}</div><div class="v">${rs.open}</div></div>
        <div class="stat"><div class="k">Path length</div><div class="v">${done ? result.path.length - 1 : '–'}${done ? ' <small>moves</small>' : ''}</div></div>
        <div class="stat"><div class="k">Path cost</div><div class="v">${done ? fmt(result.cost) : '–'}</div></div>`;
      renderHover();
    }

    function renderHover() {
      const box = $('hover');
      if (hover < 0) { $('hpos').textContent = '–'; box.innerHTML = '<div class="hover-empty">Hover a cell to see its values.</div>'; return; }
      $('hpos').textContent = xy(hover);
      if (walls[hover]) { box.innerHTML = '<div class="hover-empty">Wall: not traversable.</div>'; return; }
      const hv = result.h(hover);
      const known = rs.state[hover] !== S_NONE;
      const gv = known ? rs.g[hover] : Infinity;
      const state = ['not reached yet', `in the ${frontierName.toLowerCase()}`, 'explored'][rs.state[hover]];
      const cells = usesH
        ? [['g', known ? fmt(gv) : '–'], ['h', fmt(hv)], [mode === 'greedy' ? 'f = h' : 'f', mode === 'greedy' ? fmt(hv) : known ? fmt(gv + hv) : '–']]
        : [['g (cost)', known ? fmt(gv) : '–']];
      box.innerHTML = `<div class="kv" style="grid-template-columns:repeat(${cells.length},1fr)">${cells.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>
        <div class="hover-empty" style="margin-top:8px">${hover === start ? 'Start cell · ' : hover === goal ? 'Goal cell · ' : ''}${state}</div>`;
    }

    const cellAt = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - r.left) / cs), y = Math.floor((e.clientY - r.top) / cs);
      return x < 0 || y < 0 || x >= COLS || y >= ROWS ? -1 : y * COLS + x;
    };
    function apply(c) {
      if (c < 0) return false;
      if (drag === 'start' || drag === 'goal') {
        if (walls[c] || c === start || c === goal) return false;
        if (drag === 'start') start = c; else goal = c;
        return true;
      }
      if (c === start || c === goal) return false;
      const v = drag === 'draw' ? 1 : 0;
      if (walls[c] === v) return false;
      walls[c] = v;
      return true;
    }
    let lastCell = -1;
    canvas.addEventListener('pointerdown', (e) => {
      const c = cellAt(e);
      if (c < 0) return;
      canvas.setPointerCapture(e.pointerId);
      drag = c === start ? 'start' : c === goal ? 'goal' : walls[c] ? 'erase' : 'draw';
      canvas.classList.add('is-drag');
      lastCell = c;
      if (apply(c)) recompute();
    });
    canvas.addEventListener('pointermove', (e) => {
      const c = cellAt(e);
      if (c !== hover) { hover = c; if (!drag) { draw(); renderHover(); } }
      canvas.classList.toggle('is-handle', !drag && (c === start || c === goal));
      if (!drag || c === lastCell) return;
      let changed = false;
      if (lastCell >= 0 && c >= 0 && (drag === 'draw' || drag === 'erase')) {
        const x0 = lastCell % COLS, y0 = (lastCell / COLS) | 0, x1 = c % COLS, y1 = (c / COLS) | 0;
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 1; k <= n; k++) changed = apply(Math.round(y0 + ((y1 - y0) * k) / n) * COLS + Math.round(x0 + ((x1 - x0) * k) / n)) || changed;
      } else changed = apply(c);
      lastCell = c;
      if (changed) recompute();
    });
    const endDrag = () => { drag = null; lastCell = -1; canvas.classList.remove('is-drag'); draw(); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => { if (!drag) { hover = -1; draw(); renderHover(); } });

    if ($('heur')) $('heur').addEventListener('change', (e) => { heuristic = e.target.value; recompute(); });
    $('diag').addEventListener('change', (e) => { diagonal = e.target.checked; recompute(); });
    $('clear').addEventListener('click', () => { walls.fill(0); recompute(false); });
    $('scatter').addEventListener('click', () => {
      for (let c = 0; c < N; c++) walls[c] = c !== start && c !== goal && Math.random() < 0.28 ? 1 : 0;
      recompute(false);
    });
    $('maze').addEventListener('click', () => {
      walls.fill(1);
      const stack = [[1, 1]];
      walls[COLS + 1] = 0;
      while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const nbrs = [[2, 0], [-2, 0], [0, 2], [0, -2]]
          .map(([dx, dy]) => [x + dx, y + dy, x + dx / 2, y + dy / 2])
          .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && walls[ny * COLS + nx]);
        if (!nbrs.length) { stack.pop(); continue; }
        const [nx, ny, mx, my] = nbrs[(Math.random() * nbrs.length) | 0];
        walls[my * COLS + mx] = 0; walls[ny * COLS + nx] = 0;
        stack.push([nx, ny]);
      }
      for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
        const c = y * COLS + x;
        if (walls[c] && Math.random() < 0.1 && ((walls[c - 1] && walls[c + 1] && !walls[c - COLS] && !walls[c + COLS]) || (!walls[c - 1] && !walls[c + 1] && walls[c - COLS] && walls[c + COLS]))) walls[c] = 0;
      }
      start = COLS + 1;
      goal = (ROWS - 2) * COLS + (COLS - 2);
      recompute(false);
    });

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const onTheme = () => { readColors(); draw(); };
    window.addEventListener('algosim:theme', onTheme);

    readColors();
    recompute(false);
    resize();
    return () => { player.destroy(); ro.disconnect(); window.removeEventListener('algosim:theme', onTheme); };
  };
})(window.AlgoSim);
