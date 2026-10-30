/* Local search on 8-queens (Topic 4): hill climbing, simulated annealing, local beam search, genetic algorithm. */
(function (ns) {
  'use strict';

  const { Q, fmt } = ns;
  const CAT = 'Local Search';
  const SLIDE_HC = [4, 5, 6, 3, 4, 5, 6, 5]; // h = 17, figure 4.3(a)
  const SLIDE_GA = ['24748552', '32752411', '24415124', '32543213']; // figure 4.6(a)
  const sq = (c, d) => `<b>column ${c + 1}, row ${d}</b>`;

  function aboutCard(learn, pseudoLines) {
    return `<section class="card about">
      <div class="about-idea"><h3>How it works</h3><ul>${learn.map((l) => `<li>${l}</li>`).join('')}</ul></div>
      <div class="about-props"><h3>Pseudocode</h3>${ns.pseudo(pseudoLines)}</div>
    </section>`;
  }

  function stats(items) {
    return items.map(([k, v, small]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}${small ? ` <small>${small}</small>` : ''}</div></div>`).join('');
  }

  /* ================================================================
     Hill climbing
     ================================================================ */
  function hillClimb(init, variant, seed) {
    const rnd = ns.rng(seed);
    const steps = [];
    let s = init.slice();
    let moves = 0, restarts = 0, evals = 0;
    const push = (x) => steps.push({ s: s.slice(), h: Q.h(s), moves, restarts, evals, ...x });
    push({ kind: 'init' });

    while (steps.length < 600) {
      const hc = Q.h(s);
      if (hc === 0) { push({ kind: 'done' }); break; }
      const nb = Q.neighbours(s);
      let pick = null, tries = 0;
      if (variant === 'first') {
        const order = nb.slice();
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        for (const n of order) { tries++; if (n.h < hc) { pick = n; break; } }
        evals += tries;
      } else {
        evals += nb.length;
        const minH = Math.min(...nb.map((n) => n.h));
        if (variant === 'stochastic') {
          const up = nb.filter((n) => n.h < hc);
          if (up.length) pick = up[Math.floor(rnd() * up.length)];
        } else if (minH < hc) {
          const best = nb.filter((n) => n.h === minH);
          pick = best[Math.floor(rnd() * best.length)];
        }
      }
      if (!pick) {
        const bestH = Math.min(...nb.map((n) => n.h));
        push({ kind: 'stuck', bestH });
        if (variant === 'restart' && restarts < 40) {
          restarts++;
          s = Q.random(rnd);
          push({ kind: 'restart' });
          continue;
        }
        break;
      }
      const from = s[pick.c];
      s = pick.s.slice();
      moves++;
      push({ kind: 'move', move: { c: pick.c, from, to: pick.d }, hBefore: hc, tries });
    }
    return steps;
  }

  function mountHill(container, cfg) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    let variant = 'steepest';
    let start = SLIDE_HC.slice();
    let seed = ns.newSeed();
    let steps = [];

    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar">
            <label class="field"><span>Variant</span><select class="select" data-ref="variant">
              <option value="steepest">Steepest ascent (slides)</option>
              <option value="stochastic">Stochastic</option>
              <option value="first">First-choice</option>
              <option value="restart">Random-restart</option>
            </select></label>
            <span class="sep"></span>
            <div class="btn-row">
              <button class="btn" type="button" data-ref="slide">Slide board (h = 17)</button>
              <button class="btn" type="button" data-ref="random">Random board</button>
            </div>
            <span class="toolbar-hint">Click a square to move that column's queen</span>
          </div>
          <div class="card stage board-stage"><div data-ref="board"></div>
            <div class="legend"><span><i class="lg-safe"></i>Safe queen</span><span><i class="lg-attacked"></i>Attacked queen</span><span><i class="lg-best"></i>Best move</span><span><i class="lg-from"></i>Previous square</span><span style="margin-left:auto">numbers = h after moving there</span></div>
          </div>
          <div data-ref="player"></div>
          ${aboutCard([
            'State: 8 queens, one per column. A <b>neighbour</b> moves one queen to another square in its column (8 × 7 = 56 neighbours).',
            '<b>h</b> = number of pairs of queens attacking each other. We want h = 0, so here “uphill” means <i>lower h</i>.',
            'Each number on the board is the h you would get by moving that column\'s queen there. Hill climbing takes the best one.',
            'It stops when no neighbour is better: a <b>local minimum</b>, or a plateau. From random starts this happens about 86% of the time.',
            '<b>Random-restart</b> simply starts again from a new random board until it succeeds.',
          ], [
            'current ← MAKE-NODE(INITIAL-STATE[problem])',
            'loop do',
            '   neighbor ← a highest-valued successor of current',
            '   if VALUE[neighbor] ≤ VALUE[current] then return current',
            '   current ← neighbor',
          ])}
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card"><header class="card-head"><h3>Progress</h3></header><div class="stats" data-ref="stats"></div></section>
          <section class="card"><header class="card-head"><h3>h over time</h3></header><div data-ref="chart"></div></section>
        </aside>
      </div>`;
    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const board = ns.QueenBoard($('board'));
    const player = new ns.Player($('player'), { onRender: render, speed: 3 });
    let chart;

    $('board').addEventListener('click', (e) => {
      const cell = e.target.closest('.qcell');
      if (!cell) return;
      const i = [...$('board').children].indexOf(cell);
      const c = i % 8, d = 8 - Math.floor(i / 8);
      const cur = steps[player.index].s.slice();
      if (cur[c] === d) return;
      cur[c] = d;
      start = cur;
      run();
    });
    $('variant').addEventListener('change', (e) => { variant = e.target.value; run(); });
    $('slide').addEventListener('click', () => { start = SLIDE_HC.slice(); run(); });
    $('random').addEventListener('click', () => { seed = ns.newSeed(); start = Q.random(ns.rng(seed + 1)); run(); });

    function run() {
      player.pause();
      steps = hillClimb(start, variant, seed);
      chart = ns.LineChart($('chart'), [{ values: steps.map((s) => s.h), cls: 's-h', label: 'h (attacking pairs)' }], { ref: 0 });
      player.load(steps.length, 0);
    }

    function render(i) {
      const st = steps[i];
      const nb = Q.neighbours(st.s);
      const minH = Math.min(...nb.map((n) => n.h));
      const showBest = st.kind !== 'done' && st.kind !== 'stuck' && minH < st.h;
      const hMap = {};
      nb.forEach((n) => { hMap[`${n.c},${n.d}`] = n.h; });
      board.render({
        s: st.s,
        nums: (c, d) => (st.kind === 'done' ? '' : hMap[`${c},${d}`]),
        best: showBest && variant !== 'first' && variant !== 'stochastic' ? new Set(nb.filter((n) => n.h === minH).map((n) => `${n.c},${n.d}`)) : null,
        from: st.move ? { c: st.move.c, d: st.move.from } : null,
      });

      let kind = 'expand', badge = 'Move', title, body, lines = [2, 4];
      if (st.kind === 'init') {
        kind = 'init'; badge = 'Start'; lines = [0];
        title = `Start: h = ${st.h}`;
        body = `${st.h} pairs of queens attack each other. Every number shows the h after moving that column's queen to that square. ` +
          (minH < st.h ? `The best moves give <b>h = ${minH}</b> (highlighted).` : 'No move improves h.');
      } else if (st.kind === 'move') {
        title = `Move to h = ${st.h}`;
        body = `Move the queen in column ${st.move.c + 1} from row ${st.move.from} to row ${st.move.to}: ` +
          `<span class="eq">h ${st.hBefore} → ${st.h}</span>. ` +
          (variant === 'first' ? `First-choice tried <b>${st.tries}</b> random neighbour${st.tries === 1 ? '' : 's'} before finding a better one.` :
            variant === 'stochastic' ? 'Stochastic hill climbing picked a <b>random uphill</b> move, not necessarily the best.' :
              'It took the best neighbour (ties broken at random).');
      } else if (st.kind === 'stuck') {
        kind = 'fail'; badge = 'Stuck'; lines = [3];
        title = st.h > 0 ? 'Stuck at a local minimum' : 'Solved';
        body = `Current h = ${st.h}, but the best neighbour has h = ${st.bestH}. ` +
          `No neighbour is better, so hill climbing <b>stops here</b> even though it is not a solution.` +
          (variant === 'restart' ? ' Random-restart will try again from a new board.' : ' Try <b>Random-restart</b>, or simulated annealing.');
      } else if (st.kind === 'restart') {
        kind = 'select'; badge = 'Restart'; lines = [0];
        title = `Restart #${st.restarts}: h = ${st.h}`;
        body = 'Throw the stuck board away and start from a fresh random board.';
      } else {
        kind = 'done'; badge = 'Solved'; lines = [3];
        title = 'Solution found: h = 0';
        body = `No two queens attack each other. Found after ${st.moves} move${st.moves === 1 ? '' : 's'}` + (st.restarts ? ` and ${st.restarts} restart${st.restarts === 1 ? '' : 's'}` : '') + '.';
      }
      $('step').innerHTML = ns.stepCard(kind, badge, i, steps.length, title, body);
      $('stats').innerHTML = stats([['h now', st.h], ['Moves', st.moves], ['Restarts', st.restarts], ['States evaluated', st.evals]]);
      ns.setPseudo(host, lines);
      chart.update(i);
    }

    run();
    return () => player.destroy();
  }

  /* ================================================================
     Simulated annealing
     ================================================================ */
  function anneal(init, T0, alpha, seed) {
    const rnd = ns.rng(seed);
    const steps = [];
    let s = init.slice();
    let T = T0, t = 0, accBad = 0, rejected = 0, best = Q.h(s);
    steps.push({ kind: 'init', s: s.slice(), h: Q.h(s), T, t, accBad, rejected, best });
    while (steps.length < 6000) {
      t++;
      T = T0 * Math.pow(alpha, t);
      const hc = Q.h(s);
      if (hc === 0) { steps.push({ kind: 'done', s: s.slice(), h: 0, T, t, accBad, rejected, best: 0 }); break; }
      if (T < 0.01) { steps.push({ kind: 'frozen', s: s.slice(), h: hc, T, t, accBad, rejected, best }); break; }
      const c = Math.floor(rnd() * 8);
      let d = 1 + Math.floor(rnd() * 7); if (d >= s[c]) d++;
      const next = s.slice(); next[c] = d;
      const hn = Q.h(next);
      const dE = hc - hn; // VALUE = -h
      let p = 1, r = null, accepted = true;
      if (dE <= 0) { p = Math.exp(dE / T); r = rnd(); accepted = r < p; }
      if (accepted && dE < 0) accBad++;
      if (!accepted) rejected++;
      const before = s.slice();
      if (accepted) s = next;
      best = Math.min(best, Q.h(s));
      steps.push({ kind: 'try', before, s: s.slice(), prop: { c, d, from: before[c] }, hc, hn, dE, T, p, r, accepted, h: Q.h(s), t, accBad, rejected, best });
    }
    return steps;
  }

  function mountAnneal(container, cfg) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    let T0 = 3, alpha = 0.998;
    let seed = ns.newSeed();
    let start = Q.random(ns.rng(seed + 1));
    let steps = [];

    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar">
            <div class="field"><span>Start temperature T₀</span><div class="stepper"><button type="button" data-ref="tm">−</button><b data-ref="tv">${T0}</b><button type="button" data-ref="tp">+</button></div></div>
            <label class="field"><span>Cooling</span><select class="select" data-ref="alpha">
              <option value="0.998" selected>Slow (T × 0.998)</option>
              <option value="0.995">Medium (T × 0.995)</option>
              <option value="0.98">Fast (T × 0.98)</option>
            </select></label>
            <span class="sep"></span>
            <div class="btn-row"><button class="btn" type="button" data-ref="random">Random board</button><button class="btn" type="button" data-ref="slide">Slide board (h = 17)</button></div>
          </div>
          <div class="card stage board-stage"><div data-ref="board"></div>
            <div class="legend"><span><i class="lg-safe"></i>Safe queen</span><span><i class="lg-attacked"></i>Attacked queen</span><span><i class="lg-from"></i>Moving from</span><span><i class="lg-good"></i>Better move</span><span><i class="lg-bad"></i>Worse, accepted</span><span><i class="lg-rej"></i>Rejected</span></div>
          </div>
          <div data-ref="player"></div>
          ${aboutCard([
            'Like hill climbing, but it picks a <b>random</b> neighbour instead of the best one.',
            'A better move is always taken. A worse move is taken only with probability <span class="eq">e<sup>ΔE/T</sup></span>, where ΔE &lt; 0 is how much worse it is.',
            'The temperature <b>T</b> starts high (many bad moves accepted, so it can escape local minima) and cools down step by step (almost only good moves).',
            'If T decreases slowly enough, the best state is reached with high probability. Try fast vs slow cooling.',
          ], [
            'current ← MAKE-NODE(INITIAL-STATE[problem])',
            'for t ← 1 to ∞ do',
            '   T ← schedule[t]',
            '   if T = 0 then return current',
            '   next ← a randomly selected successor of current',
            '   ΔE ← VALUE[next] − VALUE[current]',
            '   if ΔE > 0 then current ← next',
            '   else current ← next only with probability e^(ΔE/T)',
          ])}
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card"><header class="card-head"><h3>Progress</h3></header><div class="stats" data-ref="stats"></div></section>
          <section class="card"><header class="card-head"><h3>h and temperature</h3></header><div data-ref="chart"></div><div data-ref="chartT" style="margin-top:10px"></div></section>
        </aside>
      </div>`;
    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const board = ns.QueenBoard($('board'));
    const player = new ns.Player($('player'), { onRender: render, speed: 9 });
    let chart, chartT;

    const setT = (v) => { T0 = Math.max(0.5, Math.min(10, Math.round(v * 2) / 2)); $('tv').textContent = T0; run(); };
    $('tm').addEventListener('click', () => setT(T0 - 0.5));
    $('tp').addEventListener('click', () => setT(T0 + 0.5));
    $('alpha').addEventListener('change', (e) => { alpha = +e.target.value; run(); });
    $('random').addEventListener('click', () => { seed = ns.newSeed(); start = Q.random(ns.rng(seed + 1)); run(); });
    $('slide').addEventListener('click', () => { seed = ns.newSeed(); start = SLIDE_HC.slice(); run(); });

    function run() {
      player.pause();
      steps = anneal(start, T0, alpha, seed);
      chart = ns.LineChart($('chart'), [{ values: steps.map((s) => s.h), cls: 's-h', label: 'h (attacking pairs)' }], { ref: 0 });
      chartT = ns.LineChart($('chartT'), [{ values: steps.map((s) => s.T), cls: 's-t', label: 'temperature T' }], { max: T0, maxLabel: T0 });
      player.load(steps.length, 0);
    }

    function render(i) {
      const st = steps[i];
      let kind, badge, title, body, lines;
      if (st.kind === 'try') {
        const better = st.dE > 0;
        board.render({ s: st.before, from: { c: st.prop.c, d: st.prop.from }, ghost: { c: st.prop.c, d: st.prop.d, kind: better ? 'good' : st.accepted ? 'bad' : 'rej' } });
        const move = `Try moving the queen in column ${st.prop.c + 1} from row ${st.prop.from} to row ${st.prop.d}: <span class="eq">h ${st.hc} → ${st.hn}</span>, so <span class="eq">ΔE = ${st.dE}</span>.`;
        if (better) {
          kind = 'done'; badge = 'Better'; title = 'Better move: accept'; lines = [4, 5, 6];
          body = `${move} It is an improvement, so it is <b>always accepted</b>.`;
        } else {
          kind = st.accepted ? 'expand' : 'fail'; badge = st.accepted ? 'Accepted' : 'Rejected'; lines = [4, 5, 7];
          title = st.dE === 0 ? `Equal move: ${st.accepted ? 'accepted' : 'rejected'}` : `Worse move: ${st.accepted ? 'accepted anyway' : 'rejected'}`;
          body = `${move} Accept with probability <span class="eq">e<sup>${st.dE}/${st.T.toFixed(2)}</sup> = ${st.p.toFixed(2)}</span>. ` +
            `Random number <span class="eq">${st.r.toFixed(2)}</span> ${st.accepted ? '&lt;' : '≥'} ${st.p.toFixed(2)}, so it is <b>${st.accepted ? 'accepted' : 'rejected'}</b>.` +
            (st.accepted && st.dE < 0 ? ' Bad moves like this let the search escape local minima.' : '');
        }
      } else {
        board.render({ s: st.s });
        if (st.kind === 'init') { kind = 'init'; badge = 'Start'; lines = [0]; title = `Start: h = ${st.h}, T = ${st.T}`; body = 'At high temperature, most bad moves are still accepted. As T cools, the search becomes almost pure hill climbing.'; }
        else if (st.kind === 'done') { kind = 'done'; badge = 'Solved'; lines = [6]; title = 'Solution found: h = 0'; body = `Solved after ${st.t - 1} tries. ${st.accBad} worse moves were accepted along the way.`; }
        else { kind = 'fail'; badge = 'Frozen'; lines = [3]; title = `Frozen at h = ${st.h}`; body = `The temperature is almost 0 (${st.T.toFixed(3)}), so the search stops. Best h seen: ${st.best}. Try slower cooling or a higher T₀.`; }
      }
      $('step').innerHTML = ns.stepCard(kind, badge, i, steps.length, title, body);
      $('stats').innerHTML = stats([['Temperature T', st.T.toFixed(2)], ['h now', st.h], ['Worse moves accepted', st.accBad], ['Moves rejected', st.rejected]]);
      ns.setPseudo(host, lines);
      chart.update(i); chartT.update(i);
    }

    run();
    return () => player.destroy();
  }

  /* ================================================================
     Local beam search
     ================================================================ */
  function beam(k, stochastic, seed) {
    const rnd = ns.rng(seed);
    const steps = [];
    let states = Array.from({ length: k }, () => Q.random(rnd)).map((s, i) => ({ s, h: Q.h(s), parent: null, id: i + 1 }));
    steps.push({ kind: 'init', states, iter: 0, best: Math.min(...states.map((x) => x.h)) });
    let bestEver = Math.min(...states.map((x) => x.h)), stale = 0;
    for (let iter = 1; iter <= 40; iter++) {
      if (states.some((x) => x.h === 0)) break;
      const pool = [];
      const seen = new Set();
      states.forEach((st, i) => Q.neighbours(st.s).forEach((n) => {
        const key = Q.str(n.s);
        if (seen.has(key)) return;
        seen.add(key);
        pool.push({ s: n.s, h: n.h, parent: i + 1 });
      }));
      let kept;
      if (stochastic) {
        kept = [];
        const left = pool.slice();
        while (kept.length < k && left.length) {
          const w = left.map((x) => Math.exp(-x.h * 0.9));
          let r = rnd() * w.reduce((a, b) => a + b, 0), j = 0;
          while (r > w[j]) { r -= w[j]; j++; }
          kept.push(left.splice(Math.min(j, left.length - 1), 1)[0]);
        }
      } else {
        pool.sort((a, b) => a.h - b.h || rnd() - 0.5);
        kept = pool.slice(0, k);
      }
      kept = kept.map((x, i) => ({ ...x, id: i + 1 }));
      const goal = kept.find((x) => x.h === 0);
      const best = Math.min(...kept.map((x) => x.h));
      if (best < bestEver) { bestEver = best; stale = 0; } else stale++;
      steps.push({ kind: goal ? 'done' : stale >= 6 ? 'stuck' : 'iter', states: kept, iter, pool: pool.length, best });
      states = kept;
      if (goal || stale >= 6) break;
    }
    const last = steps[steps.length - 1];
    if (last.kind === 'iter') last.kind = 'stuck';
    return steps;
  }

  function mountBeam(container, cfg) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    let k = 4, stochastic = false, seed = ns.newSeed();
    let steps = [];
    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar">
            <div class="field"><span>Beam width k</span><div class="stepper"><button type="button" data-ref="km">−</button><b data-ref="kv">${k}</b><button type="button" data-ref="kp">+</button></div></div>
            <label class="switch"><input type="checkbox" data-ref="stoch"><span class="switch-track"></span>Stochastic beam</label>
            <span class="sep"></span>
            <button class="btn" type="button" data-ref="random">New random start</button>
          </div>
          <div class="card stage"><div class="beam-grid" data-ref="boards"></div>
            <div class="legend"><span><i class="lg-safe"></i>Safe queen</span><span><i class="lg-attacked"></i>Attacked queen</span><span style="margin-left:auto">“from #n” = which board it is a successor of</span></div>
          </div>
          <div data-ref="player"></div>
          ${aboutCard([
            'Keep track of <b>k</b> states instead of just one. Start with k random boards.',
            'Each step: generate <b>all</b> successors of all k states (k × 56), then keep the k best of them.',
            'Unlike k independent random restarts, the k searches <b>share information</b>: if one board has great successors, they can take over the whole beam.',
            'That can cause a <b>lack of diversity</b>, with all k states coming from the same parent. The stochastic variant picks successors at random, weighted toward better ones, to keep more variety.',
          ], [
            'states ← k randomly generated states',
            'loop do',
            '   successors ← all successors of all k states',
            '   if any successor is a goal then return it',
            '   states ← the k best successors',
          ])}
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card"><header class="card-head"><h3>Progress</h3></header><div class="stats" data-ref="stats"></div></section>
          <section class="card"><header class="card-head"><h3>Best h per iteration</h3></header><div data-ref="chart"></div></section>
        </aside>
      </div>`;
    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const player = new ns.Player($('player'), { onRender: render, speed: 3 });
    let chart, boards = [];

    const setK = (v) => { k = Math.max(2, Math.min(8, v)); $('kv').textContent = k; run(); };
    $('km').addEventListener('click', () => setK(k - 1));
    $('kp').addEventListener('click', () => setK(k + 1));
    $('stoch').addEventListener('change', (e) => { stochastic = e.target.checked; run(); });
    $('random').addEventListener('click', () => { seed = ns.newSeed(); run(); });

    function run() {
      player.pause();
      steps = beam(k, stochastic, seed);
      $('boards').innerHTML = Array.from({ length: k }, (_, i) => `<div class="beam-item"><div class="beam-head"><b>#${i + 1}</b><span data-h></span><span class="beam-from" data-from></span></div><div data-b></div></div>`).join('');
      boards = [...$('boards').children].map((el) => ({ el, b: ns.QueenBoard(el.querySelector('[data-b]'), { mini: true }) }));
      chart = ns.LineChart($('chart'), [{ values: steps.map((s) => s.best), cls: 's-h', label: 'best h' }], { ref: 0 });
      player.load(steps.length, 0);
    }

    function render(i) {
      const st = steps[i];
      st.states.forEach((x, j) => {
        const B = boards[j];
        B.b.render({ s: x.s });
        B.el.querySelector('[data-h]').innerHTML = `h = <b>${x.h}</b>`;
        B.el.querySelector('[data-from]').textContent = x.parent ? `from #${x.parent}` : 'random';
        B.el.classList.toggle('is-goal', x.h === 0);
        B.el.classList.toggle('is-best', x.h === st.best && x.h > 0);
      });
      const parents = new Set(st.states.map((x) => x.parent));
      const hs = st.states.map((x) => x.h).join(', ');
      let kind = 'expand', badge = `Iteration ${st.iter}`, title, body;
      if (st.kind === 'init') { kind = 'init'; badge = 'Start'; title = `${k} random boards`; body = `Start with k = ${k} random states with h = ${hs}.`; }
      else {
        title = st.kind === 'done' ? 'Goal found!' : st.kind === 'stuck' ? `Stuck at h = ${st.best}` : `Keep the ${k} best of ${st.pool} successors`;
        body = `Generated ${st.pool} distinct successors from the ${k} boards and kept the ${k} ${stochastic ? 'chosen at random (weighted by quality)' : 'best'}: h = ${hs}. ` +
          (parents.size === 1 ? `<div class="note warn">All ${k} came from board <b>#${[...parents][0]}</b>: the beam has lost its diversity.</div>` :
            `They come from ${parents.size} different parent${parents.size === 1 ? '' : 's'}.`);
        if (st.kind === 'done') { kind = 'done'; badge = 'Solved'; body += ' One of them has <b>h = 0</b>: a solution.'; }
        if (st.kind === 'stuck') { kind = 'fail'; badge = 'Stuck'; body += ' The best h has not improved for several iterations, so we stop. Try the stochastic variant or a bigger k.'; }
      }
      $('step').innerHTML = ns.stepCard(kind, badge, i, steps.length, title, body);
      $('stats').innerHTML = stats([['Iteration', st.iter], ['Best h', st.best], ['Successors checked', st.pool || 0], ['Distinct parents', st.iter ? parents.size : '–']]);
      ns.setPseudo(host, st.kind === 'init' ? [0] : st.kind === 'done' ? [3] : [2, 4]);
      chart.update(i);
    }

    run();
    return () => player.destroy();
  }

  /* ================================================================
     Genetic algorithm
     ================================================================ */
  function genetic(initPop, pm, seed) {
    const rnd = ns.rng(seed);
    const steps = [];
    let pop = initPop.map((s) => s.slice());
    const history = [];
    for (let gen = 1; gen <= 400; gen++) {
      const fit = pop.map(Q.fitness);
      const total = fit.reduce((a, b) => a + b, 0) || 1;
      const pct = fit.map((f) => (f / total) * 100);
      history.push({ best: Math.max(...fit), avg: total / pop.length });
      const base = { gen, pop, fit, pct };
      steps.push({ ...base, phase: 'fitness' });
      if (fit.includes(28)) { steps.push({ ...base, phase: 'done', winner: fit.indexOf(28) }); break; }

      const pick = () => { let r = rnd() * total, i = 0; while (i < pop.length - 1 && r >= fit[i]) { r -= fit[i]; i++; } return i; };
      const sel = [];
      for (let i = 0; i < pop.length; i++) sel.push(pick());
      steps.push({ ...base, phase: 'select', sel });

      const kids = [];
      const cuts = [];
      for (let i = 0; i < sel.length; i += 2) {
        const x = pop[sel[i]], y = pop[sel[i + 1] != null ? sel[i + 1] : sel[i]];
        const cut = 1 + Math.floor(rnd() * 7);
        kids.push(x.slice(0, cut).concat(y.slice(cut)), y.slice(0, cut).concat(x.slice(cut)));
        cuts.push(cut, cut);
      }
      kids.length = pop.length;
      steps.push({ ...base, phase: 'cross', sel, kids, cuts });

      const mutated = kids.map((c) => {
        if (rnd() >= pm) return { s: c.slice(), at: -1 };
        const at = Math.floor(rnd() * 8);
        const s = c.slice();
        let d = 1 + Math.floor(rnd() * 7); if (d >= s[at]) d++;
        s[at] = d;
        return { s, at };
      });
      steps.push({ ...base, phase: 'mutate', sel, kids, cuts, mutated });
      pop = mutated.map((m) => m.s);
    }
    if (steps[steps.length - 1].phase !== 'done') steps[steps.length - 1].limit = true;
    steps.forEach((s) => { s.history = history.slice(0, s.gen); });
    return { steps, history };
  }

  function mountGenetic(container, cfg) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    let size = 4, pm = 0.3, useSlide = true, seed = ns.newSeed();
    let steps = [], history = [];

    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar">
            <label class="field"><span>Start</span><select class="select" data-ref="init">
              <option value="slide">Slide population (Fig 4.6)</option>
              <option value="random">Random population</option>
            </select></label>
            <label class="field"><span>Size</span><select class="select" data-ref="size">
              <option value="4">4</option><option value="8">8</option><option value="12">12</option>
            </select></label>
            <div class="field"><span>Mutation chance</span><div class="stepper"><button type="button" data-ref="mm">−</button><b data-ref="mv">${pm}</b><button type="button" data-ref="mp">+</button></div></div>
            <span class="sep"></span>
            <button class="btn" type="button" data-ref="rerun">Re-run</button>
          </div>
          <div class="card stage ga-stage">
            <div class="ga-table" data-ref="table"></div>
            <div class="legend"><span><i class="lg-p1"></i>From 1st parent</span><span><i class="lg-p2"></i>From 2nd parent</span><span><i class="lg-mut"></i>Mutated digit</span><span style="margin-left:auto">each digit = row of the queen in that column (1 = bottom)</span></div>
          </div>
          <div data-ref="player"></div>
          ${aboutCard([
            'Each individual is an 8-digit string: digit i is the row of the queen in column i.',
            '<b>(b) Fitness</b> = number of non-attacking pairs of queens (28 = solution). The chance of being picked is proportional to fitness.',
            '<b>(c) Selection</b>: pick parents at random using those probabilities, so one may be picked twice and another not at all.',
            '<b>(d) Crossover</b>: cut both parents at a random point and swap the tails, giving two children.',
            '<b>(e) Mutation</b>: with a small probability, change one random digit (move one queen).',
          ], [
            'repeat',
            '   new_population ← empty set',
            '   for i from 1 to SIZE(population) do',
            '      x ← RANDOM-SELECTION(population, FITNESS-FN)',
            '      y ← RANDOM-SELECTION(population, FITNESS-FN)',
            '      child ← REPRODUCE(x, y)',
            '      if (small random probability) then child ← MUTATE(child)',
            '      add child to new_population',
            '   population ← new_population',
            'until some individual is fit enough',
          ])}
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card"><header class="card-head"><h3>Fittest individual</h3><span class="count mono" data-ref="bestStr"></span></header><div class="board-small" data-ref="board"></div></section>
          <section class="card"><header class="card-head"><h3>Fitness per generation</h3></header><div data-ref="chart"></div></section>
        </aside>
      </div>`;
    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const board = ns.QueenBoard($('board'));
    const player = new ns.Player($('player'), { onRender: render, speed: 3 });
    let chart;

    $('init').addEventListener('change', (e) => { useSlide = e.target.value === 'slide'; if (useSlide) { size = 4; $('size').value = '4'; } run(); });
    $('size').addEventListener('change', (e) => { size = +e.target.value; if (size !== 4) { useSlide = false; $('init').value = 'random'; } run(); });
    const setM = (v) => { pm = Math.round(Math.max(0, Math.min(1, v)) * 10) / 10; $('mv').textContent = pm; run(); };
    $('mm').addEventListener('click', () => setM(pm - 0.1));
    $('mp').addEventListener('click', () => setM(pm + 0.1));
    $('rerun').addEventListener('click', () => { seed = ns.newSeed(); run(); });

    function run() {
      player.pause();
      const r = ns.rng(seed + 7);
      const init = useSlide ? SLIDE_GA.map(Q.parse) : Array.from({ length: size }, () => Q.random(r));
      ({ steps, history } = genetic(init, pm, seed));
      chart = ns.LineChart($('chart'), [
        { values: history.map((h) => h.best), cls: 's-h', label: 'best fitness' },
        { values: history.map((h) => h.avg), cls: 's-t', label: 'average' },
      ], { max: 28, ref: 28, maxLabel: 28 });
      player.load(steps.length, 0);
    }

    const digits = (s, color, mutAt) => `<span class="dna">${s.map((d, i) => `<i class="${color ? color(i) : ''}${i === mutAt ? ' mut' : ''}">${d}</i>`).join('')}</span>`;

    function render(i) {
      const st = steps[i];
      const P = ['fitness', 'select', 'cross', 'mutate'];
      const ph = st.phase === 'done' ? 0 : P.indexOf(st.phase);
      const show = (n) => n <= ph;
      const rows = st.pop.map((s, r) => {
        const pairStart = r % 2 === 0;
        const c = [];
        c.push(`<td>${digits(s)}</td>`);
        c.push(`<td class="fit"><b>${st.fit[r]}</b> <span>${st.pct[r].toFixed(0)}%</span><div class="bar"><span style="width:${st.pct[r] * (st.pop.length / 1.6)}%"></span></div></td>`);
        c.push(show(1) ? `<td class="${pairStart ? 'pair-top' : 'pair-bot'}">${digits(st.pop[st.sel[r]])}<span class="from">#${st.sel[r] + 1}</span></td>` : '<td class="blank"></td>');
        c.push(show(2) ? `<td class="${pairStart ? 'pair-top' : 'pair-bot'}">${digits(st.kids[r], (k) => ((k < st.cuts[r]) === pairStart ? 'p1' : 'p2'))}<span class="cut">cut ${st.cuts[r]}</span></td>` : '<td class="blank"></td>');
        c.push(show(3) ? `<td>${digits(st.mutated[r].s, null, st.mutated[r].at)}</td>` : '<td class="blank"></td>');
        return `<tr class="${st.phase === 'done' && r === st.winner ? 'is-winner' : ''}"><td class="pos">${r + 1}</td>${c.join('')}</tr>`;
      }).join('');
      const head = ['(a) Population', '(b) Fitness', '(c) Selection', '(d) Crossover', '(e) Mutation']
        .map((t, k) => `<th class="${k - 1 === ph || (k === 0 && ph === 0) ? 'is-active' : ''} ${k > 1 && !show(k - 1) ? 'dim' : ''}">${t}</th>`).join('');
      $('table').innerHTML = `<div class="ga-gen">Generation <b>${st.gen}</b></div><table><thead><tr><th class="pos"></th>${head}</tr></thead><tbody>${rows}</tbody></table>`;

      const bi = st.fit.indexOf(Math.max(...st.fit));
      board.render({ s: st.pop[bi] });
      $('bestStr').textContent = `${Q.str(st.pop[bi])} · ${st.fit[bi]}`;

      let kind = 'expand', badge, title, body, lines;
      const gen = `Generation ${st.gen}`;
      if (st.phase === 'fitness') {
        kind = 'init'; badge = '(b) Fitness'; lines = [0, 1];
        title = `${gen}: rate each individual`;
        body = `Fitness = non-attacking pairs (max 28). Values: <b>${st.fit.join(', ')}</b>. Each one's chance of being picked = fitness ÷ ${st.fit.reduce((a, b) => a + b, 0)}.`;
      } else if (st.phase === 'select') {
        badge = '(c) Selection'; lines = [3, 4]; kind = 'select';
        const counts = st.pop.map((_, r) => st.sel.filter((x) => x === r).length);
        title = 'Pick parents at random, weighted by fitness';
        body = `Picked: ${st.sel.map((x) => '#' + (x + 1)).join(', ')}. ` +
          (counts.some((c) => c === 0) ? `Individual ${counts.map((c, r) => (c === 0 ? '#' + (r + 1) : null)).filter(Boolean).join(', ')} was not chosen at all.` : 'Every individual was picked once.') +
          ' Consecutive picks form mating pairs.';
      } else if (st.phase === 'cross') {
        badge = '(d) Crossover'; lines = [5];
        title = 'Cross over each pair';
        body = `For each pair, a random cut point is chosen (${[...new Set(st.cuts.filter((_, k) => k % 2 === 0))].map((c) => 'after digit ' + c).join(', ')}). Children take the head of one parent and the tail of the other.`;
      } else if (st.phase === 'mutate') {
        badge = '(e) Mutation'; lines = [6, 7, 8];
        const m = st.mutated.filter((x) => x.at >= 0).length;
        title = m ? `Mutate ${m} child${m === 1 ? '' : 'ren'}` : 'No mutations this time';
        body = `Each child has a ${Math.round(pm * 100)}% chance to have one random digit changed (one queen moved). The result becomes generation ${st.gen + 1}.` +
          (st.limit ? '<div class="note warn">Stopped after 400 generations without a perfect solution. Try a larger population.</div>' : '');
      } else {
        kind = 'done'; badge = 'Solved'; lines = [9];
        title = `Solution in generation ${st.gen}`;
        body = `Individual <b>${Q.str(st.pop[st.winner])}</b> has fitness 28: no two queens attack each other.`;
      }
      $('step').innerHTML = ns.stepCard(kind, badge, i, steps.length, title, body);
      ns.setPseudo(host, lines);
      chart.update(st.gen - 1);
    }

    run();
    return () => player.destroy();
  }

  /* ---------- register ---------- */
  [
    { id: 'hill', name: 'Hill-Climbing Search', mount: mountHill, blurb: 'Always moves to the best neighbour; stops at a peak.',
      lede: 'Keep moving to the <b>best neighbouring state</b> until no neighbour is better. Shown on the 8-queens problem, where h = number of attacking pairs.' },
    { id: 'anneal', name: 'Simulated Annealing', mount: mountAnneal, blurb: 'Accepts some bad moves, less often as it cools.',
      lede: 'Pick a <b>random</b> move. Always accept improvements, and accept worse moves with probability <span class="mono">e^(ΔE/T)</span>, where T slowly cools down.' },
    { id: 'beam', name: 'Local Beam Search', mount: mountBeam, blurb: 'Keeps the k best states out of all successors.',
      lede: 'Track <b>k states</b> at once. At each step, generate all their successors and keep the k best.' },
    { id: 'genetic', name: 'Genetic Algorithm', mount: mountGenetic, blurb: 'Evolves a population with selection, crossover and mutation.',
      lede: 'Evolve a <b>population</b> of 8-queens strings using fitness-based selection, crossover and mutation (Figure 4.6 in the slides).' },
  ].forEach((a) => ns.register({ ...a, category: CAT, mount: (el) => a.mount(el, { ...a, category: CAT }) }));
})(window.AlgoSim);
