# AlgoSim

Step-by-step simulations of every search algorithm in CSE 411 Topic 3 (Solving Problems by Searching) and Topic 4 (Informed Search and Exploration). Plain HTML/CSS/JS, no build step.

## Run

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173 (opening `index.html` directly also works).

Controls: `Space` play/pause, `←` `→` step, `Home` / `End` jump. Every step explains what happened and why.

## Algorithms

| Group | Algorithm | Example used |
|---|---|---|
| Uninformed | Breadth-first, Uniform-cost, Depth-first, Depth-limited, Iterative deepening, Bidirectional | Slide trees (A–O binary tree, UCS trees from slides 33 & 39) and the Romania map |
| Informed | Greedy best-first, A* | Romania map with straight-line distance to Bucharest |
| Informed | Heuristic functions | 8-puzzle: h₁ misplaced tiles vs h₂ Manhattan, with an A* comparison |
| Local | Hill climbing (steepest, stochastic, first-choice, random-restart), Simulated annealing, Local beam search, Genetic algorithm | 8-queens (slide board h = 17, GA population from Figure 4.6) |

BFS, UCS, DFS, Greedy and A* also have a **grid playground** where you draw walls.

## Project layout

```
js/core/registry.js      algorithm registry + helpers
js/core/player.js        play / pause / step controls (shared)
js/core/graph.js         slide problems (trees, Romania) + SVG graph view
js/core/search.js        search algorithms recorded as steps
js/core/search-page.js   shared page for tree/graph search
js/core/grid.js          grid playground
js/core/local.js         8-queens helpers, board, chart, pseudocode
js/algorithms/*.js       registers each algorithm page
```

## Adding an algorithm

Create a file in `js/algorithms/` that calls `AlgoSim.register({ id, name, category, blurb, mount })`, and add a `<script>` tag for it in `index.html` before `js/app.js`. `mount(container)` renders the page and returns a cleanup function; use `new AlgoSim.Player(host, { onRender })` for the playback controls. It shows up in the sidebar and on the overview page automatically.
