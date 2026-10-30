/* Heuristic functions on the 8-puzzle (Topic 4): h1 = misplaced tiles, h2 = total Manhattan distance. */
(function (ns) {
  'use strict';

  const SLIDE = [7, 2, 4, 5, 0, 6, 8, 3, 1];
  const GOAL = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const dist = (s, i) => (s[i] ? Math.abs(((i / 3) | 0) - ((s[i] / 3) | 0)) + Math.abs((i % 3) - (s[i] % 3)) : 0);
  const H = {
    h1: (s) => s.reduce((a, t, i) => a + (t && t !== i ? 1 : 0), 0),
    h2: (s) => s.reduce((a, _, i) => a + dist(s, i), 0),
    h0: () => 0,
  };
  const isGoal = (s) => s.every((t, i) => t === i);

  function moves(s) {
    const b = s.indexOf(0), r = (b / 3) | 0, c = b % 3;
    const out = [];
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr > 2 || nc > 2) return;
      const t = s.slice(); const j = nr * 3 + nc;
      t[b] = t[j]; t[j] = 0;
      out.push(t);
    });
    return out;
  }

  // A* (graph search) returning the number of expanded nodes and the solution path
  function astar(start, hfn, cap = 250000) {
    const key = (s) => s.join('');
    const heap = [];
    const less = (a, b) => a.f < b.f || (a.f === b.f && a.o > b.o);
    const push = (v) => { heap.push(v); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (!less(heap[i], heap[p])) break; [heap[i], heap[p]] = [heap[p], heap[i]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    const g = new Map(), parent = new Map(), closed = new Set();
    let o = 0, expanded = 0;
    const k0 = key(start);
    g.set(k0, 0);
    push({ s: start, k: k0, g: 0, f: hfn(start), o: o++ });
    while (heap.length) {
      const cur = pop();
      if (closed.has(cur.k)) continue;
      if (isGoal(cur.s)) {
        const path = [];
        for (let k = cur.k; k; k = parent.get(k)) path.unshift(k.split('').map(Number));
        return { found: true, expanded, path };
      }
      closed.add(cur.k);
      if (++expanded > cap) return { found: false, expanded };
      for (const n of moves(cur.s)) {
        const kn = key(n);
        if (closed.has(kn)) continue;
        const ng = cur.g + 1;
        if (ng < (g.has(kn) ? g.get(kn) : Infinity)) {
          g.set(kn, ng); parent.set(kn, cur.k);
          push({ s: n, k: kn, g: ng, f: ng + hfn(n), o: o++ });
        }
      }
    }
    return { found: false, expanded };
  }

  function mount(container, cfg) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    let state = SLIDE.slice();
    let solution = null; // array of states
    let results = null;

    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar">
            <div class="btn-row">
              <button class="btn" type="button" data-ref="slide">Slide example</button>
              <button class="btn" type="button" data-ref="shuffle">Shuffle</button>
              <button class="btn" type="button" data-ref="goal">Goal state</button>
            </div>
            <span class="toolbar-hint">Click a tile next to the blank to slide it</span>
          </div>
          <div class="card stage puzzle-stage">
            <div class="puzzle-boards">
              <div><div class="puzzle-cap">Current state</div><div class="puzzle" data-ref="board"></div></div>
              <div class="puzzle-arrow">→</div>
              <div><div class="puzzle-cap">Goal state</div><div class="puzzle small" data-ref="goalBoard"></div></div>
            </div>
            <div class="h-break">
              <div class="h-row"><span class="h-name">h<sub>1</sub></span><span class="h-desc">tiles out of place</span><span class="h-terms" data-ref="h1t"></span><span class="h-val" data-ref="h1"></span></div>
              <div class="h-row"><span class="h-name">h<sub>2</sub></span><span class="h-desc">sum of Manhattan distances</span><span class="h-terms" data-ref="h2t"></span><span class="h-val" data-ref="h2"></span></div>
            </div>
            <div class="legend"><span><i class="lg-misplaced"></i>Out of place (counts for h₁)</span><span><i class="lg-placed"></i>In place</span><span style="margin-left:auto">small number = moves that tile is away from its goal square</span></div>
          </div>
          <div data-ref="player"></div>
          <section class="card about">
            <div class="about-idea"><h3>How it works</h3><ul>
              <li><b>h₁</b> counts tiles that are not on their goal square (the blank does not count). In the slide example h₁ = 8.</li>
              <li><b>h₂</b> adds up, for every tile, how many rows + columns it is away from its goal square. In the slide example h₂ = 3+1+2+2+2+3+3+2 = 18.</li>
              <li>Both are <b>admissible</b>: every misplaced tile needs at least one move, and at least its Manhattan distance in moves. So h ≤ h* (the true cost).</li>
              <li>h₂ ≥ h₁ for every state: h₂ <b>dominates</b> h₁. A more accurate heuristic makes A* expand far fewer nodes. Run the comparison to see it.</li>
            </ul></div>
            <div class="about-props"><h3>8-puzzle problem</h3><ul>
              <li><b>States:</b> location of each tile and the blank.</li>
              <li><b>Actions:</b> move the blank Left, Right, Up or Down.</li>
              <li><b>Goal test:</b> the goal configuration is reached.</li>
              <li><b>Path cost:</b> number of moves.</li>
            </ul></div>
          </section>
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card">
            <header class="card-head"><h3>A* with each heuristic</h3></header>
            <div data-ref="compare"></div>
          </section>
          <section class="card"><header class="card-head"><h3>Heuristic vs true cost along the solution</h3></header><div data-ref="chart"><div class="hover-empty">Run the comparison to see how h₁ and h₂ compare with the true remaining cost h*.</div></div></section>
        </aside>
      </div>`;

    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const player = new ns.Player($('player'), { onRender: render, speed: 3 });
    let chart = null;

    function tiles(el, s, interactive) {
      if (!el.children.length) {
        el.innerHTML = Array.from({ length: 8 }, (_, k) => `<button type="button" class="tile" data-t="${k + 1}"${interactive ? '' : ' tabindex="-1"'}><span class="n">${k + 1}</span><span class="d"></span></button>`).join('');
      }
      [...el.children].forEach((b) => {
        const t = +b.dataset.t;
        const i = s.indexOf(t);
        b.style.setProperty('--r', (i / 3) | 0);
        b.style.setProperty('--c', i % 3);
        b.classList.toggle('is-misplaced', t !== i);
        const d = dist(s, i);
        b.querySelector('.d').textContent = interactive && d ? d : '';
      });
    }

    $('board').addEventListener('click', (e) => {
      const b = e.target.closest('.tile');
      if (!b) return;
      const s = current();
      const i = s.indexOf(+b.dataset.t), z = s.indexOf(0);
      if (Math.abs(((i / 3) | 0) - ((z / 3) | 0)) + Math.abs((i % 3) - (z % 3)) !== 1) return;
      const t = s.slice(); t[z] = t[i]; t[i] = 0;
      setState(t);
    });
    $('slide').addEventListener('click', () => setState(SLIDE.slice()));
    $('goal').addEventListener('click', () => setState(GOAL.slice()));
    $('shuffle').addEventListener('click', () => {
      let s = GOAL.slice(), prev = null;
      for (let k = 0; k < 40; k++) {
        const opts = moves(s).filter((m) => !prev || m.join('') !== prev);
        prev = s.join('');
        s = opts[Math.floor(Math.random() * opts.length)];
      }
      setState(s);
    });

    const current = () => (solution ? solution[player.index] : state);

    function setState(s) {
      state = s;
      solution = null; results = null;
      $('chart').innerHTML = '<div class="hover-empty">Run the comparison to see how h₁ and h₂ compare with the true remaining cost h*.</div>';
      chart = null;
      renderCompare();
      player.pause();
      player.load(1, 0);
    }

    function renderCompare(busy) {
      if (!results) {
        $('compare').innerHTML = `<p class="card-hint" style="margin:0 0 10px">Solve the current board with A* three times, once per heuristic, and count how many nodes each run expands.</p>
          <button class="btn btn-primary" type="button" data-ref="run"${busy ? ' disabled' : ''}>${busy ? 'Solving…' : 'Run A* comparison'}</button>`;
        if (!busy) $('run').addEventListener('click', compare);
        return;
      }
      const max = Math.max(...results.map((r) => r.expanded));
      $('compare').innerHTML = `<table class="ftable cmp"><thead><tr><th>Heuristic</th><th>Expanded</th><th>Moves</th></tr></thead><tbody>
        ${results.map((r) => `<tr><td><span class="name">${r.label}</span><div class="bar"><span style="width:${Math.max(2, (r.expanded / max) * 100)}%"></span></div></td>
          <td class="f">${r.found ? r.expanded.toLocaleString() : '> ' + r.expanded.toLocaleString()}</td><td>${r.found ? r.path.length - 1 : '–'}</td></tr>`).join('')}
        </tbody></table>
        <p class="card-hint" style="margin:10px 0 0">All three find an optimal solution of the same length, but the better the heuristic, the fewer nodes A* has to look at.</p>`;
    }

    function compare() {
      renderCompare(true);
      setTimeout(() => {
        const s = state.slice();
        results = [
          { label: 'h = 0 (uniform cost)', ...astar(s, H.h0) },
          { label: 'h₁ misplaced tiles', ...astar(s, H.h1) },
          { label: 'h₂ Manhattan distance', ...astar(s, H.h2) },
        ];
        const best = results.find((r) => r.found);
        renderCompare();
        if (best) {
          solution = best.path;
          const n = solution.length - 1;
          chart = ns.LineChart($('chart'), [
            { values: solution.map((_, i) => n - i), cls: 's-true', label: 'h* (true cost)' },
            { values: solution.map(H.h2), cls: 's-h', label: 'h₂' },
            { values: solution.map(H.h1), cls: 's-t', label: 'h₁' },
          ], { ref: 0 });
          player.load(solution.length, 0);
        }
      }, 30);
    }

    function render(i) {
      const s = current();
      tiles($('board'), s, true);
      const h1 = H.h1(s), h2 = H.h2(s);
      $('h1').textContent = `= ${h1}`;
      $('h2').textContent = `= ${h2}`;
      const mis = [1, 2, 3, 4, 5, 6, 7, 8].filter((t) => s.indexOf(t) !== t);
      $('h1t').innerHTML = mis.length ? mis.map((t) => `<span class="term" title="tile ${t}">${t}</span>`).join('') : '<span class="muted">none</span>';
      $('h2t').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8].map((t) => `<span class="term${dist(s, s.indexOf(t)) ? '' : ' zero'}" title="tile ${t}">${dist(s, s.indexOf(t))}<sub>${t}</sub></span>`).join('<span class="plus">+</span>');

      let title, body, kind = 'init', badge = 'State';
      if (solution) {
        const n = solution.length - 1;
        const left = n - i;
        if (i === 0) { title = `Start: ${n} moves from the goal`; body = `The true remaining cost is <span class="eq">h* = ${n}</span>. Both heuristics underestimate it: <span class="eq">h₁ = ${h1} ≤ ${n}</span>, <span class="eq">h₂ = ${h2} ≤ ${n}</span>.`; }
        else {
          const prev = solution[i - 1];
          const moved = s[prev.indexOf(0)];
          kind = left ? 'expand' : 'done'; badge = left ? `Move ${i}` : 'Solved';
          title = left ? `Slide tile ${moved}` : 'Goal reached';
          body = left ? `<span class="eq">g = ${i}</span>, still ${left} move${left === 1 ? '' : 's'} to go (h* = ${left}). Estimates: h₁ = ${h1}, h₂ = ${h2}. h₂ is closer to the truth.` : `Solved in ${n} moves, the optimal number.`;
        }
      } else {
        title = isGoal(s) ? 'This is the goal state' : `h₁ = ${h1}, h₂ = ${h2}`;
        body = isGoal(s) ? 'Both heuristics are 0. Shuffle or load the slide example.' : 'Edit the board by clicking tiles, then <b>run the A* comparison</b> to solve it and replay the solution move by move.';
      }
      $('step').innerHTML = ns.stepCard(kind, badge, i, solution ? solution.length : 1, title, body);
      if (chart) chart.update(i);
    }

    tiles($('goalBoard'), GOAL, false);
    renderCompare();
    player.load(1, 0);
    return () => player.destroy();
  }

  const cfg = {
    id: 'heuristics', name: 'Heuristic Functions', category: 'Informed Search',
    blurb: 'Compare h₁ (misplaced tiles) and h₂ (Manhattan) on the 8-puzzle.',
    lede: 'Two admissible heuristics for the <b>8-puzzle</b>: h₁ = number of misplaced tiles, h₂ = total Manhattan distance. See why a better heuristic makes A* faster.',
  };
  ns.register({ ...cfg, mount: (el) => mount(el, cfg) });
})(window.AlgoSim);
