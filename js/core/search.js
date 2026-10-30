/*
 * Search algorithms recorded as a list of steps for the player.
 * Every step is a full snapshot: { kind, title, body, current, frontier, explored, info, changes, path, ... }
 */
(function (ns) {
  'use strict';

  const MAX_STEPS = 4000;
  const eq = (s) => `<span class="eq">${s}</span>`;
  const B = (P, n) => `<b>${P.label(n)}</b>`;
  const kids = (P) => (P.kind === 'tree' ? 'children' : 'neighbours');

  function pathCost(P, path) {
    let c = 0;
    for (let i = 1; i < path.length; i++) c += P.cost(path[i - 1], path[i]);
    return c;
  }

  function doneBody(P, path, extra) {
    const c = pathCost(P, path);
    return `Path found with ${path.length - 1} step${path.length === 2 ? '' : 's'}` +
      (P.weighted ? ` and a total cost of <b>${c}</b>` : '') + `. ${extra || ''}`;
  }

  /* ================================================================
     BFS, DFS, UCS, Greedy, A*: one loop, different frontier order
     ================================================================ */
  ns.frontierSearch = function frontierSearch(P, start, goal, mode) {
    const H = P.h || {};
    const hOf = (n) => (H[n] == null ? 0 : H[n]);
    const priority = { ucs: (e) => e.g, greedy: (e) => e.h, astar: (e) => e.f }[mode];
    const steps = [];
    let frontier = [];
    const explored = [];
    const nodeMap = new Map(); // n -> best entry seen
    const exploredSet = new Set();
    let order = 0;

    const mk = (n, par) => {
      const g = par ? par.g + P.cost(par.n, n) : 0;
      const h = hOf(n);
      return { n, g, h, f: g + h, d: par ? par.d + 1 : 0, parent: par ? par.n : null, order: order++ };
    };
    const sortF = () => { if (priority) frontier.sort((a, b) => priority(a) - priority(b) || a.h - b.h || a.order - b.order); };
    const snap = (x) => {
      const info = {};
      nodeMap.forEach((e, n) => { if (exploredSet.has(n)) info[n] = { ...e, state: 'closed' }; });
      frontier.forEach((e) => { info[e.n] = { ...e, state: 'open' }; });
      steps.push({ frontier: frontier.map((e) => ({ ...e })), explored: explored.slice(), info, ...x });
    };
    const pathTo = (n) => { const p = []; for (let c = n; c; c = nodeMap.get(c).parent) p.unshift(c); return p; };

    const s0 = mk(start, null);
    frontier.push(s0); nodeMap.set(start, s0);

    const what = {
      bfs: 'a <b>FIFO queue</b>: first in, first out',
      dfs: 'a <b>LIFO stack</b>: last in, first out',
      ucs: 'a <b>priority queue</b> ordered by path cost g',
      greedy: 'a <b>priority queue</b> ordered by h (estimated distance to goal)',
      astar: 'a <b>priority queue</b> ordered by f = g + h',
    }[mode];
    snap({
      kind: 'init', title: 'Put the start node in the frontier',
      body: `The frontier is ${what}. It starts with only ${B(P, start)}` +
        (mode === 'astar' ? ` (${eq(`f = 0 + ${s0.h} = ${s0.h}`)})` : mode === 'greedy' ? ` (${eq(`h = ${s0.h}`)})` : '') + '.',
    });

    if (start === goal) {
      snap({ kind: 'done', current: start, path: [start], title: 'Start is the goal', body: 'Nothing to search.' });
      return steps;
    }

    while (frontier.length && steps.length < MAX_STEPS) {
      const cur = frontier[0];
      const why = {
        bfs: `It is at the <b>front of the queue</b>: the shallowest node waiting (depth ${cur.d}).`,
        dfs: `It is on <b>top of the stack</b>: the deepest, most recently added node (depth ${cur.d}).`,
        ucs: `It has the <b>lowest path cost</b> in the frontier: ${eq(`g = ${cur.g}`)}.`,
        greedy: `It <b>looks closest to the goal</b>: lowest ${eq(`h = ${cur.h}`)}. Greedy ignores the cost so far.`,
        astar: `It has the <b>lowest</b> ${eq(`f = g + h = ${cur.g} + ${cur.h} = ${cur.f}`)}.`,
      }[mode];

      // Goal test on removal (all but BFS, which tests on generation)
      if (cur.n === goal) {
        frontier.shift();
        exploredSet.add(cur.n); explored.push(cur.n);
        const path = pathTo(cur.n);
        snap({
          kind: 'done', current: cur.n, path,
          title: `Goal reached: ${P.label(cur.n)}`,
          body: `${B(P, cur.n)} was removed from the frontier. ${why} It is the goal, so the search stops.<br>` +
            doneBody(P, path, mode === 'greedy' ? 'Greedy search is fast but <b>not guaranteed optimal</b>.' : ''),
        });
        return steps;
      }

      let note = '';
      if ((mode === 'ucs' || mode === 'astar') && frontier.some((e) => e.n === goal)) {
        note = `<div class="note warn">The goal ${B(P, goal)} is already in the frontier, but something cheaper may still reach it. ` +
          `We only stop when the goal is <i>removed</i> from the frontier.</div>`;
      }
      snap({ kind: 'select', current: cur.n, selected: cur.order, title: `Remove ${P.label(cur.n)} from the frontier`, body: why + note, removed: cur });
      frontier.shift();

      exploredSet.add(cur.n); explored.push(cur.n);
      const changes = [];
      const added = [];
      let found = null;
      for (const nb of P.adj[cur.n]) {
        const e = mk(nb, cur);
        const calc = {
          bfs: `depth ${cur.d} + 1 = ${e.d}`, dfs: `depth ${cur.d} + 1 = ${e.d}`,
          ucs: `g = ${cur.g} + ${P.cost(cur.n, nb)} = ${e.g}`,
          greedy: `h = ${e.h}`,
          astar: `g = ${cur.g} + ${P.cost(cur.n, nb)} = ${e.g}  ·  f = ${e.g} + ${e.h} = ${e.f}`,
        }[mode];
        if (exploredSet.has(nb)) { changes.push({ n: nb, action: 'explored', calc: 'already explored, skip' }); continue; }
        const inF = frontier.find((x) => x.n === nb);
        if (inF) {
          if ((mode === 'ucs' || mode === 'astar') && e.g < inF.g) {
            const old = inF.g;
            Object.assign(inF, { g: e.g, f: e.f, d: e.d, parent: cur.n });
            nodeMap.set(nb, inF);
            changes.push({ n: nb, action: 'updated', calc: `${calc}  (was g = ${old})` });
          } else changes.push({ n: nb, action: 'infrontier', calc: (mode === 'ucs' || mode === 'astar') ? `g = ${e.g} is not better than ${inF.g}, keep the old one` : 'already in the frontier, skip' });
          continue;
        }
        nodeMap.set(nb, e);
        added.push(e);
        changes.push({ n: nb, action: 'added', calc });
        if (mode === 'bfs' && nb === goal) { found = e; changes[changes.length - 1].action = 'goal'; break; }
      }
      if (mode === 'dfs') frontier = added.concat(frontier);
      else frontier = frontier.concat(added);
      sortF();

      if (found) {
        const path = pathTo(goal);
        snap({
          kind: 'done', current: cur.n, changes, path,
          title: `Goal found: ${P.label(goal)}`,
          body: `While expanding ${B(P, cur.n)} we generated the goal ${B(P, goal)}. ` +
            `BFS checks the goal as soon as a node is <b>generated</b>, so it stops right away.<br>` + doneBody(P, path),
        });
        return steps;
      }

      const n = changes.filter((c) => c.action === 'added' || c.action === 'updated').length;
      const where = { bfs: 'joined the <b>back</b> of the queue', dfs: 'were pushed on <b>top</b> of the stack', ucs: 'were placed by g', greedy: 'were placed by h', astar: 'were placed by f' }[mode];
      snap({
        kind: 'expand', current: cur.n, changes,
        title: `Expand ${P.label(cur.n)}`,
        body: P.adj[cur.n].length
          ? `Generate the ${kids(P)} of ${B(P, cur.n)}. ` + (n ? `${n} new node${n === 1 ? '' : 's'} ${where}.` : 'Nothing new to add.')
          : `${B(P, cur.n)} has no ${kids(P)}: a dead end.`,
      });
    }

    snap({ kind: 'fail', title: 'No solution', body: 'The frontier is empty: every reachable node was explored and the goal was not found.' });
    return steps;
  };

  /* ================================================================
     Depth-limited search (stack based, cycle check on current path)
     ================================================================ */
  function dls(P, start, goal, limit, steps, extra) {
    let stack = [{ n: start, d: 0, g: 0, parent: null, path: [start], order: 0 }];
    const visited = new Map(); // n -> { state, d, g, parent }
    const explored = [];
    let order = 1;
    let cutoff = false;

    const snap = (x) => {
      const info = {};
      visited.forEach((v, n) => { info[n] = { ...v }; });
      stack.forEach((e) => { info[e.n] = { ...e, state: 'open' }; });
      steps.push({ frontier: stack.map((e) => ({ n: e.n, d: e.d, g: e.g, parent: e.parent, order: e.order })), explored: explored.slice(), info, limit, ...extra, ...x });
    };

    snap({
      kind: 'init',
      title: extra.iteration != null ? `Iteration ${extra.iteration}: depth limit l = ${limit}` : `Start with depth limit l = ${limit}`,
      body: (extra.iteration != null ? 'Start over from scratch with a deeper limit. ' : '') +
        `Push ${B(P, start)} on the stack. Nodes at depth ${limit} are treated as if they have <b>no successors</b>.`,
    });

    while (stack.length && steps.length < MAX_STEPS) {
      const cur = stack.shift();
      if (cur.n === goal) {
        visited.set(cur.n, { state: 'closed', d: cur.d, g: cur.g, parent: cur.parent });
        explored.push(cur.n);
        snap({ kind: 'done', current: cur.n, path: cur.path, title: `Goal reached: ${P.label(cur.n)}`, body: `${B(P, cur.n)} is on top of the stack (depth ${cur.d} ≤ ${limit}) and it is the goal.<br>` + doneBody(P, cur.path) });
        return { result: 'found', path: cur.path };
      }
      if (cur.d >= limit) {
        cutoff = true;
        visited.set(cur.n, { state: 'cutoff', d: cur.d, g: cur.g, parent: cur.parent });
        snap({ kind: 'cutoff', current: cur.n, title: `Cut off at ${P.label(cur.n)}`, body: `${B(P, cur.n)} is at depth ${cur.d} = l, so we <b>do not expand it</b>. Its ${kids(P)} are never generated.` });
        continue;
      }
      visited.set(cur.n, { state: 'closed', d: cur.d, g: cur.g, parent: cur.parent });
      explored.push(cur.n);
      const changes = [];
      const added = [];
      for (const nb of P.adj[cur.n]) {
        if (cur.path.includes(nb)) { changes.push({ n: nb, action: 'onpath', calc: 'already on the current path (would loop), skip' }); continue; }
        const e = { n: nb, d: cur.d + 1, g: cur.g + P.cost(cur.n, nb), parent: cur.n, path: cur.path.concat(nb), order: order++ };
        added.push(e);
        changes.push({ n: nb, action: 'added', calc: `depth ${cur.d} + 1 = ${e.d}` });
      }
      stack = added.concat(stack);
      snap({
        kind: 'expand', current: cur.n, changes,
        title: `Expand ${P.label(cur.n)}`,
        body: `Pop ${B(P, cur.n)} from the top of the stack (depth ${cur.d} < ${limit}) and push its ${kids(P)}.`,
      });
    }
    return { result: cutoff ? 'cutoff' : 'failure' };
  }

  ns.depthLimited = function (P, start, goal, limit) {
    const steps = [];
    const r = dls(P, start, goal, limit, steps, {});
    if (r.result !== 'found') {
      const last = steps[steps.length - 1];
      steps.push({
        ...last, kind: 'fail', current: null, changes: null,
        title: r.result === 'cutoff' ? 'Cutoff: no solution within the limit' : 'No solution',
        body: r.result === 'cutoff'
          ? `The goal ${B(P, goal)} is deeper than l = ${limit}, so depth-limited search is <b>incomplete</b> here. Try a larger limit.`
          : 'The whole space was searched and the goal is not reachable.',
      });
    }
    return steps;
  };

  ns.iterativeDeepening = function (P, start, goal, maxDepth = 12) {
    const steps = [];
    for (let l = 0; l <= maxDepth; l++) {
      const r = dls(P, start, goal, l, steps, { iteration: l });
      if (r.result === 'found') {
        const last = steps[steps.length - 1];
        last.body += ` Found in iteration ${l}: the shallowest goal is at depth ${l}.`;
        return steps;
      }
      if (r.result === 'failure' || steps.length >= MAX_STEPS) break;
    }
    const last = steps[steps.length - 1];
    steps.push({ ...last, kind: 'fail', current: null, changes: null, title: 'No solution', body: 'No deeper nodes exist and the goal was not found.' });
    return steps;
  };

  /* ================================================================
     Bidirectional search (two BFS searches, layer by layer)
     ================================================================ */
  ns.bidirectional = function (P, start, goal) {
    const steps = [];
    const side = {
      f: { q: [{ n: start, d: 0, parent: null, order: 0 }], seen: new Map(), closed: new Set(), explored: [], name: 'forward', from: start },
      b: { q: [{ n: goal, d: 0, parent: null, order: 0 }], seen: new Map(), closed: new Set(), explored: [], name: 'backward', from: goal },
    };
    side.f.seen.set(start, side.f.q[0]);
    side.b.seen.set(goal, side.b.q[0]);
    let order = 1;

    const infoOf = (S) => {
      const o = {};
      S.seen.forEach((e, n) => { o[n] = { ...e, state: S.closed.has(n) ? 'closed' : 'open' }; });
      return o;
    };
    const snap = (x) => steps.push({
      frontier: side.f.q.map((e) => ({ ...e })), frontierB: side.b.q.map((e) => ({ ...e })),
      explored: side.f.explored.map((n) => ({ n, side: 'f' })).concat(side.b.explored.map((n) => ({ n, side: 'b' }))),
      info: infoOf(side.f), infoB: infoOf(side.b), ...x,
    });
    const chain = (S, n) => { const p = []; for (let c = n; c; c = S.seen.get(c).parent) p.push(c); return p; };

    snap({
      kind: 'init', title: 'Start two searches',
      body: `One breadth-first search goes <b>forward</b> from ${B(P, start)}, another goes <b>backward</b> from ${B(P, goal)}. They take turns, one layer at a time.`,
    });
    if (start === goal) { snap({ kind: 'done', path: [start], title: 'Start is the goal', body: '' }); return steps; }

    let turn = 'f';
    while ((side.f.q.length || side.b.q.length) && steps.length < MAX_STEPS) {
      const S = side[turn], O = side[turn === 'f' ? 'b' : 'f'];
      if (!S.q.length) { turn = turn === 'f' ? 'b' : 'f'; continue; }
      const layer = S.q[0].d;
      while (S.q.length && S.q[0].d === layer) {
        const cur = S.q.shift();
        S.closed.add(cur.n); S.explored.push(cur.n);
        const changes = [];
        let meet = null;
        for (const nb of (turn === 'f' ? P.adj : P.rev)[cur.n]) {
          if (S.seen.has(nb)) { changes.push({ n: nb, action: S.closed.has(nb) ? 'explored' : 'infrontier', calc: 'already seen by this search, skip' }); continue; }
          const e = { n: nb, d: cur.d + 1, parent: cur.n, order: order++ };
          S.seen.set(nb, e); S.q.push(e);
          if (O.seen.has(nb)) { meet = nb; changes.push({ n: nb, action: 'meet', calc: `also reached by the ${O.name} search!` }); break; }
          changes.push({ n: nb, action: 'added', calc: `depth ${cur.d} + 1 = ${e.d}` });
        }
        if (meet) {
          const fwd = chain(side.f, meet).reverse();
          const bwd = chain(side.b, meet).slice(1);
          const path = fwd.concat(bwd);
          snap({
            kind: 'done', current: cur.n, side: turn, changes, path, meet,
            title: `The searches meet at ${P.label(meet)}`,
            body: `The ${S.name} search generated ${B(P, meet)}, which the ${O.name} search has already reached. ` +
              `Join the two halves to get the path.<br>` + doneBody(P, path),
          });
          return steps;
        }
        snap({
          kind: 'expand', current: cur.n, side: turn, changes,
          title: `${turn === 'f' ? 'Forward' : 'Backward'}: expand ${P.label(cur.n)}`,
          body: `The <b>${S.name}</b> search (from ${B(P, S.from)}) expands ${B(P, cur.n)} at depth ${cur.d}. Before adding each ${kids(P).slice(0, -1)}, check whether the other search has already reached it.`,
        });
      }
      turn = turn === 'f' ? 'b' : 'f';
    }
    snap({ kind: 'fail', title: 'No solution', body: 'Both frontiers are empty and the searches never met.' });
    return steps;
  };
})(window.AlgoSim);
