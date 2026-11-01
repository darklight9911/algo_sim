# AlgoSim

Step-by-step simulations of the algorithms from two courses, grouped in the sidebar by subject:

- **Artificial Intelligence**: every search algorithm in CSE 411 Topic 3 (Solving Problems by Searching) and Topic 4 (Informed Search and Exploration).
- **Operating Systems**: CPU scheduling (Chapter 6 + the CPU Scheduling additional resource) and process creation (Chapter 3).

Plain HTML/CSS/JS, no build step.

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

### Operating Systems

| Group | Algorithm | Example used |
|---|---|---|
| CPU Scheduling | First-Come First-Served, Shortest-Job-First, Shortest Remaining Time First, Priority (non-preemptive and preemptive), Round Robin, Multilevel Queue (fixed priority or 80/20 time slice) | Slide process sets (FCFS 24/3/3, SJF 6/8/7/3, SRTF 8/4/9/5, priority 10/1/2/1/5, RR q = 4), all editable |
| CPU Scheduling | Compare Schedulers | The same processes through six algorithms, with Gantt charts and averages |
| Processes | fork(), exec() and wait() | Chapter 3 fork + execlp + wait program, fork() ×3, fork in a loop, zombie and orphan examples |

Each scheduling page shows the CPU, the ready queue, a growing Gantt chart and CT / TAT / WT / RT per process, and supports quiz mode (predict the next process).

## Project layout

```
js/core/registry.js      algorithm registry + helpers
js/core/player.js        play / pause / step controls (shared)
js/core/graph.js         slide problems (trees, Romania) + SVG graph view
js/core/search.js        search algorithms recorded as steps
js/core/search-page.js   shared page for tree/graph search
js/core/grid.js          grid playground
js/core/local.js         8-queens helpers, board, chart, pseudocode
js/core/sched.js         CPU scheduling engine (recorded as steps) + example process sets
js/core/sched-page.js    shared scheduling page: Gantt chart, process table, quiz
js/algorithms/*.js       registers each algorithm page
```

## Adding an algorithm

Create a file in `js/algorithms/` that calls `AlgoSim.register({ id, name, parent, category, blurb, mount })` (`parent` is the sidebar subject, defaulting to Artificial Intelligence), and add a `<script>` tag for it in `index.html` before `js/app.js`. `mount(container)` renders the page and returns a cleanup function; use `new AlgoSim.Player(host, { onRender })` for the playback controls. It shows up in the sidebar and on the overview page automatically.
