/*
 * Shared page for tree / graph search algorithms.
 *   AlgoSim.searchPage(cfg) -> mount(container)
 */
(function (ns) {
  'use strict';

  const { esc } = ns;

  const BADGE = { init: 'Start', select: 'Select', expand: 'Expand', done: 'Done', fail: 'Failed', cutoff: 'Cutoff' };
  const TAG = {
    added: 'added', updated: 'cheaper path', infrontier: 'skip', explored: 'skip', onpath: 'skip',
    goal: 'goal!', meet: 'meeting point',
  };
  const COL = { d: 'depth', g: 'g', h: 'h', f: 'f' };

  function legendHTML(mode) {
    const items = [['lg-start', 'Start'], ['lg-goal', 'Goal']];
    if (mode === 'bidi') items.push(['lg-open', 'Forward frontier'], ['lg-closed', 'Forward explored'], ['lg-open-b', 'Backward frontier'], ['lg-closed-b', 'Backward explored']);
    else items.push(['lg-open', 'Frontier'], ['lg-closed', 'Explored']);
    if (mode === 'dls' || mode === 'ids') items.push(['lg-cutoff', 'Cut off']);
    items.push(['lg-current', 'Current'], ['lg-path', 'Solution path']);
    return items.map(([c, t]) => `<span><i class="${c}"></i>${t}</span>`).join('');
  }

  function aboutHTML(cfg) {
    const p = cfg.props;
    const cell = (k, v) => `<div class="prop"><div class="k">${k}</div><div class="v">${v[0]}</div>${v[1] ? `<div class="n">${v[1]}</div>` : ''}</div>`;
    return `
      <section class="card about">
        <div class="about-idea">
          <h3>How it works</h3>
          <ul>${cfg.learn.map((l) => `<li>${l}</li>`).join('')}</ul>
        </div>
        <div class="about-props">
          <h3>Properties</h3>
          <div class="props">
            ${cell('Complete?', p.complete)}${cell('Optimal?', p.optimal)}${cell('Time', p.time)}${cell('Space', p.space)}
          </div>
          <div class="props-foot">b = branching factor · d = depth of shallowest goal · m = max depth${p.extra ? ' · ' + p.extra : ''}</div>
        </div>
      </section>`;
  }

  function mountGraph(host, cfg) {
    const mode = cfg.mode;
    let P = ns.problems[cfg.problems[0]];
    let start = P.start;
    let goal = P.goal;
    let limit = cfg.limit != null ? cfg.limit : 2;
    let steps = [];
    let view = null;
    const goalFixed = !!cfg.needsH;

    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar" data-ref="toolbar"></div>
          <div class="card stage">
            <svg data-ref="svg" role="img"></svg>
            <div class="legend">${legendHTML(mode)}</div>
          </div>
          <div data-ref="player"></div>
          ${aboutHTML(cfg)}
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          ${mode === 'bidi' ? `
            <section class="card"><header class="card-head"><h3>Forward queue</h3><span class="count" data-ref="fcount"></span></header><p class="card-hint" data-ref="fhint"></p><div data-ref="frontier"></div></section>
            <section class="card"><header class="card-head"><h3>Backward queue</h3><span class="count" data-ref="bcount"></span></header><p class="card-hint" data-ref="bhint"></p><div data-ref="frontierB"></div></section>`
          : `<section class="card"><header class="card-head"><h3>${cfg.frontier.title}</h3><span class="count" data-ref="fcount"></span></header><p class="card-hint">${cfg.frontier.hint}</p><div data-ref="frontier"></div></section>`}
          <section class="card">
            <header class="card-head"><h3>Explored</h3><span class="count" data-ref="ccount"></span></header>
            <div class="chips" data-ref="closed"></div>
          </section>
        </aside>
      </div>`;

    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const player = new ns.Player($('player'), { onRender: render, speed: cfg.speed || 3 });

    function buildToolbar() {
      const opts = (sel, skip) => P.names.filter((n) => n !== skip).slice().sort()
        .map((n) => `<option value="${n}"${n === sel ? ' selected' : ''}>${P.label(n)}</option>`).join('');
      const tb = $('toolbar');
      tb.innerHTML = `
        ${cfg.problems.length > 1 ? `<label class="field"><span>Example</span><select class="select" data-ref="prob">
          ${cfg.problems.map((id) => `<option value="${id}"${id === P.id ? ' selected' : ''}>${ns.problems[id].name}</option>`).join('')}</select></label><span class="sep"></span>` : ''}
        <label class="field"><span>Start</span><select class="select" data-ref="start">${opts(start)}</select></label>
        ${goalFixed ? `<div class="field"><span>Goal</span><span class="goal-pill">${P.label(goal)}</span></div>`
          : `<label class="field"><span>Goal</span><select class="select" data-ref="goal">${opts(goal)}</select></label>`}
        ${mode === 'dls' ? `<span class="sep"></span><div class="field"><span>Depth limit l</span>
          <div class="stepper"><button type="button" data-ref="lminus" aria-label="Decrease">−</button><b data-ref="lval">${limit}</b><button type="button" data-ref="lplus" aria-label="Increase">+</button></div></div>` : ''}
        <span class="toolbar-hint">${goalFixed ? 'Click a city to start from it' : 'Click a node to make it the goal'}</span>`;

      if ($('prob')) $('prob').addEventListener('change', (e) => { P = ns.problems[e.target.value]; start = P.start; goal = goalFixed ? P.hGoal : P.goal; setup(); });
      $('start').addEventListener('change', (e) => { start = e.target.value; run(); });
      if ($('goal')) $('goal').addEventListener('change', (e) => { goal = e.target.value; run(); });
      if (mode === 'dls') {
        const set = (v) => { limit = Math.max(0, Math.min(12, v)); $('lval').textContent = limit; run(); };
        $('lminus').addEventListener('click', () => set(limit - 1));
        $('lplus').addEventListener('click', () => set(limit + 1));
      }
    }

    function onNodeClick(n) {
      if (goalFixed) { if (n !== goal && n !== start) { start = n; $('start').value = n; run(); } }
      else if (n !== goal) { goal = n; $('goal').value = n; run(); }
    }

    function setup() {
      if (goalFixed) goal = P.hGoal;
      buildToolbar();
      view = ns.GraphView($('svg'), P, { onClick: onNodeClick });
      run();
    }

    function run() {
      player.pause();
      if ($('start')) $('start').value = start;
      if (mode === 'dls') steps = ns.depthLimited(P, start, goal, limit);
      else if (mode === 'ids') steps = ns.iterativeDeepening(P, start, goal);
      else if (mode === 'bidi') steps = ns.bidirectional(P, start, goal);
      else steps = ns.frontierSearch(P, start, goal, mode);
      player.load(steps.length, 0);
    }

    function sub(i) {
      if (mode === 'ucs') return `g ${i.g}`;
      if (mode === 'greedy') return `h ${i.h}`;
      if (mode === 'astar') return `f ${i.f} = ${i.g}+${i.h}`;
      return P.weighted && mode !== 'bidi' ? `d ${i.d} · g ${i.g}` : `d ${i.d}`;
    }

    function render(idx) {
      const st = steps[idx];
      if (!st) return;
      const path = st.path || [];
      const pathEdges = new Set();
      for (let k = 1; k < path.length; k++) pathEdges.add(ns.edgeKey(path[k - 1], path[k]));
      const changed = new Map((st.changes || []).map((c) => [c.n, c.action]));
      const live = st.kind !== 'done' && st.kind !== 'fail';

      const v = { nodes: {}, subs: {}, edges: {}, flash: new Set() };
      P.names.forEach((n) => {
        const i = st.info[n], ib = st.infoB && st.infoB[n];
        const c = [];
        if (i) c.push(i.state === 'open' ? 'is-open' : i.state === 'cutoff' ? 'is-cutoff' : 'is-closed');
        if (ib) c.push(ib.state === 'open' ? 'is-open-b' : 'is-closed-b');
        if (n === st.current && live) c.push(st.side === 'b' ? 'is-current is-current-b' : 'is-current');
        if (path.includes(n)) c.push('is-path');
        if (n === start) c.push('is-start');
        if (n === goal) c.push('is-goal');
        v.nodes[n] = c.join(' ');
        const shown = i || ib;
        v.subs[n] = shown ? sub(shown) : (P.h && (mode === 'astar' || mode === 'greedy') ? `h ${P.h[n]}` : '');
        const a = changed.get(n);
        if (a === 'added' || a === 'updated' || a === 'goal' || a === 'meet') v.flash.add(n);
      });
      const treeE = (info, cls) => {
        if (!info) return;
        Object.entries(info).forEach(([n, e]) => { if (e.parent) { const k = ns.edgeKey(n, e.parent); v.edges[k] = (v.edges[k] || '') + ' ' + cls; } });
      };
      treeE(st.info, 'is-tree');
      treeE(st.infoB, 'is-tree-b');
      if (st.current && st.changes && live) {
        st.changes.forEach((c) => { const k = ns.edgeKey(st.current, c.n); v.edges[k] = (v.edges[k] || '') + ` is-probe is-${c.action}`; });
      }
      pathEdges.forEach((k) => { v.edges[k] = (v.edges[k] || '') + ' is-path'; });
      view.render(v);

      renderStep(st, idx);
      if (mode === 'bidi') {
        renderFrontier(st, st.frontier, 'frontier', 'fcount', st.side === 'f');
        renderFrontier(st, st.frontierB, 'frontierB', 'bcount', st.side === 'b');
        $('fhint').innerHTML = `From <b>${P.label(start)}</b> · front of the queue at the top`;
        $('bhint').innerHTML = `From <b>${P.label(goal)}</b> · front of the queue at the top`;
      } else renderFrontier(st, st.frontier, 'frontier', 'fcount', true);
      renderExplored(st);
    }

    function renderStep(st, idx) {
      let extra = '';
      if (st.changes && st.changes.length) {
        extra = '<ul class="changes">' + st.changes.map((c) => {
          const skip = c.action === 'infrontier' || c.action === 'explored' || c.action === 'onpath';
          return `<li class="${skip ? 'is-skip' : ''}"><b>${P.label(c.n)}</b><span class="tag tag-${c.action}">${TAG[c.action]}</span><span class="calc">${c.calc}</span></li>`;
        }).join('') + '</ul>';
      }
      if (st.kind === 'done' && path(st).length) {
        extra += '<div class="path-line">' + path(st).map((c) => `<span class="city">${P.label(c)}</span>`).join('<span class="arrow">→</span>') + '</div>';
      }
      $('step').innerHTML = `
        <div class="step-kicker">
          <span class="kicker-left"><span class="badge badge-${st.kind}">${BADGE[st.kind]}</span>${st.limit != null ? `<span class="chip-limit">l = ${st.limit}</span>` : ''}</span>
          <span class="step-no">step ${idx + 1} / ${steps.length}</span>
        </div>
        <h2 class="step-title">${esc(st.title)}</h2>
        <div class="step-body">${st.body}</div>
        ${extra}`;
    }
    const path = (st) => st.path || [];

    function renderFrontier(st, list, ref, countRef, active) {
      $(countRef).textContent = list.length;
      if (!list.length) { $(ref).innerHTML = '<div class="empty">Empty</div>'; return; }
      const changed = new Map((st.changes || []).map((c) => [c.n, c.action]));
      const cols = cfg.columns(P);
      const rows = list.map((r, k) => {
        const a = changed.get(r.n);
        const cls = [
          k === 0 && active && st.kind === 'select' ? 'is-next' : '',
          k === 0 && active && st.kind !== 'select' && st.kind !== 'init' && st.kind !== 'done' ? 'is-top' : '',
          a === 'added' && active ? 'is-new' : '',
          a === 'updated' ? 'is-updated' : '',
        ].join(' ');
        return `<tr class="${cls}"><td class="pos">${k + 1}</td>
          <td><span class="name">${P.label(r.n)}</span><span class="via">${r.parent ? 'via ' + P.label(r.parent) : 'start'}</span></td>
          ${cols.map((c) => `<td class="${c === cols[cols.length - 1] && cols.length > 1 ? 'f' : ''}">${r[c]}</td>`).join('')}</tr>`;
      }).join('');
      $(ref).innerHTML = `<table class="ftable"><thead><tr><th class="pos">#</th><th>Node</th>${cols.map((c) => `<th>${COL[c]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
    }

    function renderExplored(st) {
      const list = st.explored;
      $('ccount').textContent = list.length;
      $('closed').innerHTML = list.length
        ? list.map((e, k) => {
          const n = typeof e === 'string' ? e : e.n;
          const b = typeof e === 'object' && e.side === 'b';
          return `<span class="chip${b ? ' chip-b' : ''}${k === list.length - 1 ? ' is-last' : ''}"><i>${k + 1}</i>${P.label(n)}</span>`;
        }).join('')
        : '<div class="hover-empty">Nothing explored yet.</div>';
    }

    setup();
    return () => player.destroy();
  }

  ns.searchPage = (cfg) => function mount(container) {
    const key = `algosim-${cfg.id}-tab`;
    let tab = 'graph';
    if (cfg.grid) { try { tab = localStorage.getItem(key) || tab; } catch (e) {} }
    container.innerHTML = `
      <div class="sim">
        <header class="sim-head">
          <div>
            <div class="eyebrow">${cfg.category}</div>
            <h1>${cfg.name}</h1>
            <p class="lede">${cfg.lede}</p>
          </div>
          ${cfg.grid ? `<div class="seg" role="tablist">
            <button type="button" role="tab" data-tab="graph">Slide example</button>
            <button type="button" role="tab" data-tab="grid">Grid playground</button>
          </div>` : ''}
        </header>
        <div data-ref="body"></div>
      </div>`;
    const body = container.querySelector('[data-ref="body"]');
    const tabs = container.querySelectorAll('[data-tab]');
    let cleanup = null;
    function show(t) {
      tab = t;
      try { if (cfg.grid) localStorage.setItem(key, t); } catch (e) {}
      tabs.forEach((b) => { b.classList.toggle('is-active', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t); });
      if (cleanup) cleanup();
      cleanup = t === 'grid' ? ns.mountGrid(body, cfg) : mountGraph(body, cfg);
    }
    tabs.forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab !== tab) show(b.dataset.tab); }));
    show(cfg.grid && tab === 'grid' ? 'grid' : 'graph');
    return () => { if (cleanup) cleanup(); };
  };
})(window.AlgoSim);
