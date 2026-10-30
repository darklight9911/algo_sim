/* Uninformed + informed search algorithms (Topic 3 & 4), built on AlgoSim.searchPage. */
(function (ns) {
  'use strict';

  const depthCols = (P) => (P.weighted ? ['d', 'g'] : ['d']);
  const sup = (b, e) => `O(${b}<sup>${e}</sup>)`;

  const ALGOS = [
    {
      id: 'bfs', name: 'Breadth-First Search', short: 'BFS', category: 'Uninformed Search', mode: 'bfs', grid: true,
      blurb: 'Expands the shallowest node first, level by level.',
      lede: 'Expand the <b>shallowest</b> unexpanded node first. The frontier is a <b>FIFO queue</b>.',
      problems: ['tree', 'romania'],
      frontier: { title: 'Frontier · FIFO queue', hint: 'First in, first out. The node at the top leaves next.' },
      columns: depthCols,
      learn: [
        'Take the node at the <b>front</b> of the queue and generate its children.',
        'New children join the <b>back</b> of the queue, so the whole of depth 1 is explored before depth 2, and so on.',
        'The goal test happens when a node is <b>generated</b>, so BFS can stop early.',
        'It finds the path with the <b>fewest steps</b>, which is the cheapest only if every step costs the same.',
      ],
      props: { complete: ['Yes', 'if b is finite'], optimal: ['Yes', 'if all step costs are equal'], time: [sup('b', 'd+1')], space: [sup('b', 'd+1'), 'keeps every node in memory'] },
      gridTips: ['BFS spreads out evenly in every direction like a ripple.', 'Turn on diagonal moves: BFS still minimises the number of moves, not the cost.'],
    },
    {
      id: 'ucs', name: 'Uniform-Cost Search', short: 'UCS', category: 'Uninformed Search', mode: 'ucs', grid: true,
      blurb: 'Expands the cheapest node so far (lowest g).',
      lede: 'Expand the node with the <b>lowest path cost g(n)</b>. The frontier is a <b>priority queue ordered by g</b>.',
      problems: ['ucs1', 'ucs2', 'romania'],
      frontier: { title: 'Frontier · priority queue', hint: 'Sorted by path cost g. The cheapest node is at the top.' },
      columns: () => ['g'],
      learn: [
        'Always remove the node with the smallest <b>g(n)</b>, the total cost from the start.',
        'Child cost: <span class="eq">g(child) = g(parent) + step cost</span>.',
        'If a node is already in the frontier and we find a <b>cheaper</b> way to it, update it.',
        'The goal test happens when a node is <b>removed</b> (not when generated). That is what makes UCS optimal.',
        'With equal step costs UCS behaves exactly like BFS.',
      ],
      props: { complete: ['Yes', 'if every step cost ≥ ε > 0'], optimal: ['Yes'], time: [sup('b', '1+⌊C*/ε⌋')], space: [sup('b', '1+⌊C*/ε⌋')], extra: 'C* = cost of optimal solution' },
      gridTips: ['With diagonals on, UCS takes the true cheapest path.', 'Compare how many cells it expands with A*: UCS has no sense of direction.'],
    },
    {
      id: 'dfs', name: 'Depth-First Search', short: 'DFS', category: 'Uninformed Search', mode: 'dfs', grid: true,
      blurb: 'Goes as deep as possible before backtracking.',
      lede: 'Expand the <b>deepest</b> unexpanded node first. The frontier is a <b>LIFO stack</b>.',
      problems: ['tree', 'romania'],
      frontier: { title: 'Frontier · LIFO stack', hint: 'Last in, first out. The top of the stack is popped next.' },
      columns: depthCols,
      learn: [
        'Pop the node on <b>top</b> of the stack and push its children on top.',
        'The newest (deepest) node is always explored next, so the search dives down one branch.',
        'When a branch ends with no goal, it <b>backtracks</b> to the next node on the stack.',
        'It uses very little memory, but may find a long path, or run forever in an infinite space.',
      ],
      props: { complete: ['No', 'unless the space is finite and has no loops'], optimal: ['No'], time: [sup('b', 'm')], space: ['O(bm)', 'only the current path + siblings'] },
      gridTips: ['Watch DFS snake through the grid in one direction first.', 'Its path is usually much longer than BFS or A*.'],
    },
    {
      id: 'dls', name: 'Depth-Limited Search', short: 'DLS', category: 'Uninformed Search', mode: 'dls', limit: 2,
      blurb: 'DFS that never goes deeper than a limit l.',
      lede: 'Depth-first search with a <b>depth limit l</b>: nodes at depth l are treated as if they have no successors.',
      problems: ['tree', 'romania'],
      frontier: { title: 'Frontier · LIFO stack', hint: 'Same stack as DFS, but nodes at depth l are not expanded.' },
      columns: depthCols,
      learn: [
        'Works like DFS, but never expands a node at depth <b>l</b>. Those nodes are <b>cut off</b>.',
        'Solves the infinite-path problem of DFS.',
        'If the goal is deeper than l (<span class="eq">l &lt; d</span>), it will not be found: the search is incomplete.',
        'Change <b>l</b> in the toolbar: on the tree, goal M is at depth 3, so l = 2 fails and l = 3 succeeds.',
        'On the Romania map any city is reachable within 9 steps (the diameter), so l = 9 always works there.',
      ],
      props: { complete: ['No', 'fails if l < d'], optimal: ['No'], time: [sup('b', 'l')], space: ['O(bl)'], extra: 'l = depth limit' },
    },
    {
      id: 'ids', name: 'Iterative Deepening Search', short: 'IDS', category: 'Uninformed Search', mode: 'ids', speed: 5,
      blurb: 'Runs DLS with l = 0, 1, 2, … until the goal is found.',
      lede: 'Run depth-limited search with <b>l = 0, 1, 2, …</b> until a goal is found. It combines the benefits of DFS and BFS.',
      problems: ['tree', 'romania'],
      frontier: { title: 'Frontier · LIFO stack', hint: 'Each iteration starts a fresh depth-limited DFS.' },
      columns: depthCols,
      learn: [
        'Each <b>iteration</b> is a complete depth-limited search with a larger limit.',
        'The top levels are regenerated many times, but most nodes are in the bottom level, so the waste is small.',
        'Memory like DFS: <span class="eq">O(bd)</span>. Completeness and optimality like BFS.',
        'Watch the <b>l = …</b> badge in the step panel to see which iteration you are in.',
      ],
      props: { complete: ['Yes', 'if b is finite'], optimal: ['Yes', 'if all step costs are equal'], time: [sup('b', 'd')], space: ['O(bd)'] },
    },
    {
      id: 'bidi', name: 'Bidirectional Search', short: 'Bidirectional', category: 'Uninformed Search', mode: 'bidi',
      blurb: 'Searches forward from the start and backward from the goal.',
      lede: 'Run <b>two</b> breadth-first searches at once: forward from the start and backward from the goal. Stop when they <b>meet in the middle</b>.',
      problems: ['romania', 'tree'],
      frontier: {},
      columns: () => ['d'],
      learn: [
        'The forward and backward searches take turns, one layer at a time.',
        'Before adding a node, check whether it is already in the <b>other</b> search\'s frontier or explored set.',
        'Two searches of depth d/2 are far cheaper than one of depth d: <span class="eq">2·b<sup>d/2</sup> ≪ b<sup>d</sup></span>.',
        'Needs actions that are easy to reverse, so the predecessors of a node can be computed.',
      ],
      props: { complete: ['Yes', 'if b is finite, both BFS'], optimal: ['Yes', 'if step costs are uniform'], time: [sup('b', 'd/2')], space: [sup('b', 'd/2'), 'its biggest weakness'] },
    },
    {
      id: 'greedy', name: 'Greedy Best-First Search', short: 'Greedy', category: 'Informed Search', mode: 'greedy', grid: true, needsH: true,
      blurb: 'Expands the node that looks closest to the goal: f(n) = h(n).',
      lede: 'Expand the node that <b>appears closest to the goal</b>: <span class="mono">f(n) = h(n)</span>. Here h is the straight-line distance to Bucharest.',
      problems: ['romania'],
      frontier: { title: 'Frontier · priority queue', hint: 'Sorted by h (straight-line distance). Smallest h at the top.' },
      columns: () => ['h'],
      learn: [
        'Only the heuristic <b>h(n)</b> matters. The cost so far, g(n), is ignored.',
        'From Arad it goes Sibiu → Fagaras → Bucharest (450 km): fast, but <b>not optimal</b>. The best route via Rimnicu Vilcea and Pitesti costs 418 km.',
        'Without checking for repeated states it can loop forever (e.g. Iasi → Neamt → Iasi …).',
        'A good heuristic can make it dramatically faster.',
      ],
      props: { complete: ['No', 'can get stuck in loops'], optimal: ['No'], time: [sup('b', 'm'), 'a good h helps a lot'], space: [sup('b', 'm')] },
      gridTips: ['Greedy rushes straight at the goal. Put a wall in the way and watch it get trapped.', 'Compare its path cost with A* on the same walls.'],
    },
    {
      id: 'astar', name: 'A* Search', short: 'A*', category: 'Informed Search', mode: 'astar', grid: true, needsH: true,
      blurb: 'Expands the lowest f(n) = g(n) + h(n): cost so far plus estimate.',
      lede: 'Expand the node with the lowest <span class="mono">f(n) = g(n) + h(n)</span>: the cost so far plus an estimate of the cost to the goal.',
      problems: ['romania'],
      frontier: { title: 'Frontier · priority queue', hint: 'Sorted by f = g + h. Smallest f at the top.' },
      columns: () => ['g', 'h', 'f'],
      learn: [
        '<span class="eq">g(n)</span> is the cost so far to reach n. <span class="eq">h(n)</span> is the estimated cost from n to the goal.',
        '<span class="eq">f(n)</span> is the estimated total cost of the best path through n. A* always expands the lowest f.',
        'If h is <b>admissible</b> (never overestimates), A* is optimal. Straight-line distance is never longer than the road, so it is admissible.',
        'Notice that Bucharest enters the frontier with f = 450, but A* continues because Pitesti has f = 417.',
      ],
      props: { complete: ['Yes', 'unless infinitely many nodes have f < f(G)'], optimal: ['Yes', 'if h is admissible'], time: ['Exponential', 'in the solution length'], space: ['All nodes', 'kept in memory: runs out of space first'] },
      gridTips: ['Switch the heuristic. Octile is exact for 8-way moves, so it expands the fewest cells.', 'Manhattan with diagonals overestimates: A* becomes faster but may not be optimal.'],
    },
  ];

  ALGOS.forEach((cfg) => ns.register({ ...cfg, mount: ns.searchPage(cfg) }));
})(window.AlgoSim);
