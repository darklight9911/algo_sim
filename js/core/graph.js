/*
 * Search problems from the lecture slides + an SVG view that draws them.
 */
(function (ns) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  ns.svgEl = svgEl;
  ns.edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  function makeProblem(def) {
    // adj = successors, rev = predecessors. Trees are directed (parent -> child).
    const adj = {};
    const rev = {};
    const cost = {};
    Object.keys(def.nodes).forEach((n) => { adj[n] = []; rev[n] = []; });
    def.edges.forEach(([a, b, d]) => {
      adj[a].push(b); rev[b].push(a);
      if (def.kind !== 'tree') { adj[b].push(a); rev[a].push(b); }
      cost[ns.edgeKey(a, b)] = d;
    });
    return {
      ...def,
      adj,
      rev,
      cost: (a, b) => cost[ns.edgeKey(a, b)],
      label: (n) => (def.labels && def.labels[n]) || n,
      names: Object.keys(def.nodes),
    };
  }

  /* ---------- Romania (AIMA) ---------- */
  const CITIES = {
    Arad: [91, 492, 'w'], Bucharest: [400, 327, 'se'], Craiova: [253, 288, 's'], Drobeta: [165, 299, 'w'],
    Eforie: [562, 293, 'e'], Fagaras: [305, 449, 'n'], Giurgiu: [375, 270, 's'], Hirsova: [534, 350, 'e'],
    Iasi: [473, 506, 'e'], Lugoj: [165, 379, 'e'], Mehadia: [168, 339, 'e'], Neamt: [406, 537, 'w'],
    Oradea: [131, 571, 'e'], Pitesti: [320, 368, 'sw'], Rimnicu: [233, 410, 'w'], Sibiu: [207, 457, 'ne'],
    Timisoara: [94, 410, 'w'], Urziceni: [456, 350, 's'], Vaslui: [509, 444, 'e'], Zerind: [108, 531, 'w'],
  };
  const SLD = {
    Arad: 366, Bucharest: 0, Craiova: 160, Drobeta: 242, Eforie: 161, Fagaras: 176, Giurgiu: 77,
    Hirsova: 151, Iasi: 226, Lugoj: 244, Mehadia: 241, Neamt: 234, Oradea: 380, Pitesti: 100,
    Rimnicu: 193, Sibiu: 253, Timisoara: 329, Urziceni: 80, Vaslui: 199, Zerind: 374,
  };
  // Neighbour order follows the slides (alphabetical successors of each city)
  const ROADS = [
    ['Arad', 'Sibiu', 140], ['Arad', 'Timisoara', 118], ['Arad', 'Zerind', 75],
    ['Bucharest', 'Fagaras', 211], ['Bucharest', 'Giurgiu', 90], ['Bucharest', 'Pitesti', 101],
    ['Bucharest', 'Urziceni', 85], ['Craiova', 'Drobeta', 120], ['Craiova', 'Pitesti', 138],
    ['Craiova', 'Rimnicu', 146], ['Drobeta', 'Mehadia', 75], ['Eforie', 'Hirsova', 86],
    ['Fagaras', 'Sibiu', 99], ['Hirsova', 'Urziceni', 98], ['Iasi', 'Neamt', 87], ['Iasi', 'Vaslui', 92],
    ['Lugoj', 'Mehadia', 70], ['Lugoj', 'Timisoara', 111], ['Oradea', 'Sibiu', 151], ['Oradea', 'Zerind', 71],
    ['Pitesti', 'Rimnicu', 97], ['Rimnicu', 'Sibiu', 80], ['Urziceni', 'Vaslui', 142],
  ];
  const romaniaNodes = {};
  Object.entries(CITIES).forEach(([c, [x, y, side]]) => { romaniaNodes[c] = { x: (x - 91) * 2, y: (571 - y) * 2, side }; });

  /* ---------- Binary tree A..O (DFS / DLS / IDS slides) ---------- */
  const treeNodes = {};
  const treeEdges = [];
  'ABCDEFGHIJKLMNO'.split('').forEach((n, i) => {
    const level = Math.floor(Math.log2(i + 1));
    const p = i - (2 ** level - 1);
    treeNodes[n] = { x: (p + 0.5) * (720 / 2 ** level), y: level * 125 };
    if (i > 0) treeEdges.push(['ABCDEFGHIJKLMNO'[(i - 1) >> 1], n, 1]);
  });

  const ucsNodes = {
    A: { x: 0, y: 0 }, B: { x: -170, y: 130 }, C: { x: 170, y: 130 },
    D: { x: -255, y: 260 }, E: { x: -85, y: 260 }, F: { x: 85, y: 260 }, G: { x: 255, y: 260 },
  };

  ns.problems = {
    tree: makeProblem({
      id: 'tree', name: 'Binary tree (slides)', style: 'tree', weighted: false, kind: 'tree',
      nodes: treeNodes, edges: treeEdges, start: 'A', goal: 'M', viewBox: '-20 -55 760 470',
    }),
    ucs1: makeProblem({
      id: 'ucs1', name: 'Weighted tree 1 (slide 33)', style: 'tree', weighted: true, kind: 'tree',
      nodes: ucsNodes, edges: [['A', 'B', 5], ['A', 'C', 3], ['B', 'D', 6], ['B', 'E', 7], ['C', 'F', 2], ['C', 'G', 3]],
      start: 'A', goal: 'G', viewBox: '-320 -60 640 390',
    }),
    ucs2: makeProblem({
      id: 'ucs2', name: 'Weighted tree 2 (slide 39)', style: 'tree', weighted: true, kind: 'tree',
      nodes: ucsNodes, edges: [['A', 'B', 5], ['A', 'C', 2], ['B', 'D', 5], ['B', 'E', 1], ['C', 'F', 5], ['C', 'G', 4]],
      start: 'A', goal: 'G', viewBox: '-320 -60 640 390',
    }),
    romania: makeProblem({
      id: 'romania', name: 'Romania road map', style: 'map', weighted: true, kind: 'graph',
      nodes: romaniaNodes, edges: ROADS, labels: { Rimnicu: 'Rimnicu Vilcea' },
      start: 'Arad', goal: 'Bucharest', h: SLD, hGoal: 'Bucharest', viewBox: '-160 -55 1250 725',
    }),
  };

  /* ---------- Graph view ---------- */

  const LABEL_POS = {
    n: [0, -32, -16, 'middle'], s: [0, 30, 46, 'middle'],
    e: [17, -4, 13, 'start'], w: [-17, -4, 13, 'end'],
    ne: [8, -32, -16, 'start'], se: [10, 30, 46, 'start'], sw: [-10, 30, 46, 'end'],
  };

  ns.GraphView = function GraphView(svg, P, opts = {}) {
    svg.innerHTML = '';
    svg.setAttribute('viewBox', P.viewBox);
    svg.setAttribute('class', `graph graph-${P.style}`);
    const edgeLayer = svgEl('g', {});
    const nodeLayer = svgEl('g', {});
    svg.append(edgeLayer, nodeLayer);
    const tree = P.style === 'tree';

    const edgeEls = {};
    P.edges.forEach(([a, b, d]) => {
      const A = P.nodes[a], B = P.nodes[b];
      const g = svgEl('g', { class: 'edge' });
      g.append(svgEl('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y }));
      if (P.weighted) {
        let mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
        if (tree) {
          const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, s = dx < 0 ? 1 : -1;
          mx += (s * -dy / len) * 16; my += (s * dx / len) * 16;
        }
        const t = svgEl('text', { x: mx, y: my, class: tree ? 'cost cost-tree' : 'cost' });
        t.textContent = d;
        g.append(t);
      }
      edgeLayer.append(g);
      edgeEls[ns.edgeKey(a, b)] = g;
    });

    const nodeEls = {};
    P.names.forEach((n) => {
      const { x, y, side } = P.nodes[n];
      const g = svgEl('g', { class: 'node', transform: `translate(${x} ${y})`, tabindex: 0, role: 'button', 'aria-label': P.label(n) });
      const r = tree ? 20 : 9;
      g.append(svgEl('circle', { class: 'halo', r }));
      g.append(svgEl('circle', { class: 'ring', r: r + 5 }));
      g.append(svgEl('circle', { class: 'dot', r }));
      let sub;
      if (tree) {
        const letter = svgEl('text', { class: 'letter', x: 0, y: 1 });
        letter.textContent = P.label(n);
        sub = svgEl('text', { class: 'sub', x: 0, y: 42, 'text-anchor': 'middle' });
        g.append(letter, sub);
      } else {
        const [dx, ny, sy, anchor] = LABEL_POS[side];
        const name = svgEl('text', { class: 'name', x: dx, y: ny, 'text-anchor': anchor });
        name.textContent = P.label(n);
        sub = svgEl('text', { class: 'sub', x: dx, y: sy, 'text-anchor': anchor });
        g.append(name, sub);
      }
      if (opts.onClick) {
        g.addEventListener('click', () => opts.onClick(n));
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter') opts.onClick(n); });
      } else g.classList.add('is-static');
      nodeLayer.append(g);
      nodeEls[n] = { g, sub, base: 'node' + (opts.onClick ? '' : ' is-static') };
    });

    return {
      /* view: { nodes: {n: 'cls cls'}, subs: {n: text}, edges: {key: 'cls'}, flash: Set } */
      render(view) {
        P.names.forEach((n) => {
          const el = nodeEls[n];
          const flash = view.flash && view.flash.has(n);
          el.g.setAttribute('class', `${el.base} ${view.nodes[n] || ''}`);
          if (flash) { void el.g.getBBox(); el.g.classList.add('is-flash'); }
          el.sub.textContent = view.subs[n] || '';
        });
        Object.entries(edgeEls).forEach(([k, g]) => g.setAttribute('class', 'edge ' + (view.edges[k] || '')));
      },
    };
  };
})(window.AlgoSim);
