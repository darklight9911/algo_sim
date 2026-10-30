/* App shell: sidebar navigation, overview page, hash routing, theme toggle. */
(function (ns) {
  'use strict';

  const nav = document.getElementById('algo-nav');
  const view = document.getElementById('view');
  let cleanup = null;

  const groups = {};
  ns.list().forEach((a) => { (groups[a.category] = groups[a.category] || []).push(a); });

  nav.innerHTML = `<a class="nav-item nav-home" href="#/" data-id="home"><span class="nav-dot"></span>Overview</a>` +
    Object.entries(groups).map(([cat, items]) => `
    <div class="nav-group">
      <div class="nav-label">${ns.esc(cat)}</div>
      ${items.map((a) => `<a class="nav-item" href="#/${a.id}" data-id="${a.id}"><span class="nav-dot"></span>${ns.esc(a.name)}</a>`).join('')}
    </div>`).join('');

  const INTRO = {
    'Uninformed Search': 'Blind strategies: they only know the problem definition. They differ in the order nodes are expanded.',
    'Informed Search': 'Use a heuristic h(n), an estimate of the distance to the goal, to decide which node looks most promising.',
    'Local Search': 'Keep only the current state(s) and move to neighbours. The path does not matter, only the final state (e.g. 8-queens).',
  };

  function home(container) {
    container.innerHTML = `
      <div class="sim home">
        <header class="home-hero">
          <div class="eyebrow">CSE 411 · Topics 3 &amp; 4</div>
          <h1>Search algorithms, step by step</h1>
          <p class="lede">Pick an algorithm, then press <kbd>Space</kbd> to play or use <kbd>←</kbd> <kbd>→</kbd> to step. Every step explains what the algorithm does and why.</p>
        </header>
        ${Object.entries(groups).map(([cat, items]) => `
          <section class="home-group">
            <div class="home-group-head"><h2>${cat}</h2><p>${INTRO[cat] || ''}</p></div>
            <div class="home-cards">
              ${items.map((a) => `<a class="home-card" href="#/${a.id}"><b>${a.name}</b><span>${a.blurb || ''}</span><i aria-hidden="true">→</i></a>`).join('')}
            </div>
          </section>`).join('')}
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
        </section>
      </div>`;
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
    document.title = algo ? `${algo.name} · AlgoSim` : 'AlgoSim · Search algorithms';
  }

  window.addEventListener('hashchange', route);
  route();

  // Theme
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : media.matches);
  const notify = () => window.dispatchEvent(new Event('algosim:theme'));
  document.getElementById('theme-toggle').addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('algosim-theme', root.dataset.theme); } catch (e) {}
    notify();
  });
  media.addEventListener('change', notify);
})(window.AlgoSim);
