/* App shell: sidebar navigation, overview page, hash routing, theme toggle. */
(function (ns) {
  'use strict';

  const nav = document.getElementById('algo-nav');
  const view = document.getElementById('view');
  let cleanup = null;

  // Two-level navigation: parent subject (AI, OS) → category → algorithm
  const parentOf = (a) => a.parent || 'Artificial Intelligence';
  const tree = {};
  ns.list().forEach((a) => {
    const groups = (tree[parentOf(a)] = tree[parentOf(a)] || {});
    (groups[a.category] = groups[a.category] || []).push(a);
  });

  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem('algosim-nav') || '{}') || {}; } catch (e) {}
  const CHEVRON = '<svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  nav.innerHTML = `<a class="nav-item nav-home" href="#/" data-id="home"><span class="nav-dot"></span>Overview</a>` +
    Object.entries(tree).map(([parent, groups], k) => `
    <div class="nav-parent${collapsed[parent] ? ' is-collapsed' : ''}" data-parent="${ns.esc(parent)}">
      <button class="nav-parent-head" type="button" aria-expanded="${!collapsed[parent]}" aria-controls="navp-${k}">${ns.esc(parent)}${CHEVRON}</button>
      <div class="nav-parent-body" id="navp-${k}">
        ${Object.entries(groups).map(([cat, items]) => `
        <div class="nav-group">
          <div class="nav-label">${ns.esc(cat)}</div>
          ${items.map((a) => `<a class="nav-item" href="#/${a.id}" data-id="${a.id}"><span class="nav-dot"></span>${ns.esc(a.name)}</a>`).join('')}
        </div>`).join('')}
      </div>
    </div>`).join('');

  function setCollapsed(el, on) {
    el.classList.toggle('is-collapsed', on);
    el.querySelector('.nav-parent-head').setAttribute('aria-expanded', String(!on));
    collapsed[el.dataset.parent] = on;
    try { localStorage.setItem('algosim-nav', JSON.stringify(collapsed)); } catch (e) {}
  }
  nav.addEventListener('click', (e) => {
    const head = e.target.closest('.nav-parent-head');
    if (head) { const el = head.parentElement; setCollapsed(el, !el.classList.contains('is-collapsed')); }
  });

  const INTRO = {
    'Uninformed Search': 'Blind strategies: they only know the problem definition. They differ in the order nodes are expanded.',
    'Informed Search': 'Use a heuristic h(n), an estimate of the distance to the goal, to decide which node looks most promising.',
    'Local Search': 'Keep only the current state(s) and move to neighbours. The path does not matter, only the final state (e.g. 8-queens).',
    'CPU Scheduling': 'The short-term scheduler picks which ready process gets the CPU next. Watch the ready queue and the Gantt chart, and compare waiting times.',
    'Processes': 'How processes are created and terminated: fork(), exec(), wait(), zombies and orphans.',
  };
  const PARENT_INTRO = {
    'Artificial Intelligence': 'CSE 411 · Topics 3 &amp; 4: solving problems by searching, informed search and local search.',
    'Operating Systems': 'Chapters 3 &amp; 6: processes and CPU scheduling, with the examples from the slides.',
  };

  const AI_TABLE = `
        <section class="card home-table">
          <h3>Comparing uninformed search strategies</h3>
          <div class="table-scroll"><table class="ftable">
            <thead><tr><th>Criterion</th><th>Breadth-first</th><th>Uniform-cost</th><th>Depth-first</th><th>Depth-limited</th><th>Iterative deepening</th><th>Bidirectional</th></tr></thead>
            <tbody>
              <tr><td>Complete?</td><td>Yes<sup>a</sup></td><td>Yes<sup>a,b</sup></td><td>No</td><td>No</td><td>Yes<sup>a</sup></td><td>Yes<sup>a,d</sup></td></tr>
              <tr><td>Time</td><td>O(b<sup>d+1</sup>)</td><td>O(b<sup>1+⌊C*/ε⌋</sup>)</td><td>O(b<sup>m</sup>)</td><td>O(b<sup>l</sup>)</td><td>O(b<sup>d</sup>)</td><td>O(b<sup>d/2</sup>)</td></tr>
              <tr><td>Space</td><td>O(b<sup>d+1</sup>)</td><td>O(b<sup>1+⌊C*/ε⌋</sup>)</td><td>O(bm)</td><td>O(bl)</td><td>O(bd)</td><td>O(b<sup>d/2</sup>)</td></tr>
              <tr><td>Optimal?</td><td>Yes<sup>c</sup></td><td>Yes</td><td>No</td><td>No</td><td>Yes<sup>c</sup></td><td>Yes<sup>c,d</sup></td></tr>
            </tbody>
          </table></div>
          <p class="card-hint" style="margin:10px 0 0">b = branching factor, d = depth of shallowest solution, m = maximum depth, l = depth limit.
            <sup>a</sup> complete if b is finite; <sup>b</sup> if step costs ≥ ε &gt; 0; <sup>c</sup> optimal if step costs are all identical; <sup>d</sup> if both directions use breadth-first search.</p>
        </section>`;
  const OS_TABLE = `
        <section class="card home-table">
          <h3>Comparing CPU scheduling algorithms</h3>
          <div class="table-scroll"><table class="ftable">
            <thead><tr><th>Criterion</th><th>FCFS</th><th>SJF</th><th>SRTF</th><th>Priority</th><th>Round Robin</th><th>Multilevel queue</th></tr></thead>
            <tbody>
              <tr><td>Preemptive?</td><td>No</td><td>No</td><td>Yes</td><td>Either</td><td>Yes (timer)</td><td>Yes<sup>a</sup></td></tr>
              <tr><td>Picks</td><td>Earliest arrival</td><td>Shortest burst</td><td>Shortest remaining</td><td>Smallest priority no.</td><td>Queue front, q units</td><td>Foreground first</td></tr>
              <tr><td>Starvation?</td><td>No</td><td>Yes</td><td>Yes</td><td>Yes<sup>b</sup></td><td>No</td><td>Yes<sup>a</sup></td></tr>
              <tr><td>Known for</td><td>Convoy effect</td><td>Optimal avg wait</td><td>Optimal with arrivals</td><td>Aging</td><td>Good response time</td><td>fg RR / bg FCFS</td></tr>
            </tbody>
          </table></div>
          <p class="card-hint" style="margin:10px 0 0"><sup>a</sup> with fixed priority between the queues; <sup>b</sup> fixed by aging (raise the priority of processes that wait a long time).</p>
        </section>`;
  const TABLES = { 'Artificial Intelligence': AI_TABLE, 'Operating Systems': OS_TABLE };

  function home(container) {
    container.innerHTML = `
      <div class="sim home">
        <header class="home-hero">
          <div class="eyebrow">AlgoSim</div>
          <h1>Algorithms, step by step</h1>
          <p class="lede">Pick an algorithm, then press <kbd>Space</kbd> to play or use <kbd>←</kbd> <kbd>→</kbd> to step. Every step explains what the algorithm does and why.</p>
          <div class="home-jump">${Object.keys(tree).map((p, k) => `<a class="btn" href="#/" data-jump="hp-${k}">${p}</a>`).join('')}</div>
        </header>
        ${Object.entries(tree).map(([parent, groups], k) => `
        <section class="home-parent" id="hp-${k}">
          <div class="home-parent-head"><h2>${parent}</h2><p>${PARENT_INTRO[parent] || ''}</p></div>
          ${Object.entries(groups).map(([cat, items]) => `
          <section class="home-group">
            <div class="home-group-head"><h3>${cat}</h3><p>${INTRO[cat] || ''}</p></div>
            <div class="home-cards">
              ${items.map((a) => `<a class="home-card" href="#/${a.id}"><b>${a.name}</b><span>${a.blurb || ''}</span><i aria-hidden="true">→</i></a>`).join('')}
            </div>
          </section>`).join('')}
          ${TABLES[parent] || ''}
        </section>`).join('')}
      </div>`;
    container.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById(a.dataset.jump).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function route() {
    const id = location.hash.replace(/^#\/?/, '');
    const algo = ns.get(id);
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    view.innerHTML = '';
    window.scrollTo(0, 0);
    if (algo) cleanup = algo.mount(view);
    else home(view);
    const active = algo ? algo.id : 'home';
    nav.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('is-active', el.dataset.id === active));
    if (algo) { // make sure the active page's section is open
      const sec = nav.querySelector(`.nav-parent[data-parent="${CSS.escape(parentOf(algo))}"]`);
      if (sec && sec.classList.contains('is-collapsed')) setCollapsed(sec, false);
    }
    document.title = algo ? `${algo.name} · AlgoSim` : 'AlgoSim · Algorithms step by step';
  }

  window.addEventListener('hashchange', route);
  route();

  // Theme
  const root = document.documentElement;
  const isDark = () => root.dataset.theme === 'dark';
  const notify = () => window.dispatchEvent(new Event('algosim:theme'));
  document.getElementById('theme-toggle').addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('algosim-theme', root.dataset.theme); } catch (e) {}
    notify();
  });
})(window.AlgoSim);
