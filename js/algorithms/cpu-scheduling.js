/* CPU scheduling algorithms (OS Chapter 6 + CPU Scheduling additional resource). */
(function (ns) {
  'use strict';

  const PARENT = 'Operating Systems';
  const CAT = 'CPU Scheduling';
  const ALL = ['fcfs1', 'fcfs2', 'sjf1', 'sjf2', 'sjf3', 'srtf', 'prio', 'priop', 'rr', 'rr2'];
  const first = (ids) => [...ids, ...ALL.filter((id) => !ids.includes(id))];

  const ALGOS = [
    {
      id: 'fcfs', algo: 'fcfs', name: 'First-Come, First-Served',
      blurb: 'The simplest scheduler: a FIFO queue, no preemption.',
      lede: 'The process that requests the CPU <b>first</b> gets it first. The ready queue is a plain FIFO queue and a running process keeps the CPU until it finishes.',
      presets: first(['fcfs1', 'fcfs2', 'sjf2']),
      rule: 'FCFS always takes the process at the <b>front of the queue</b>: the one that arrived first.',
      idea: [
        'When a process arrives, its PCB is linked onto the <b>tail</b> of the ready queue.',
        'When the CPU is free it is given to the process at the <b>head</b> of the queue, which runs until it finishes.',
        'Order matters a lot: P1, P2, P3 (24, 3, 3) gives an average wait of <b>17</b>, but P2, P3, P1 gives only <b>3</b>.',
        '<b>Convoy effect:</b> short processes stuck behind one long process all wait. Compare the two slide examples.',
      ],
      props: [['Preemptive?', 'No'], ['Ready queue', 'FIFO'], ['Starvation?', 'No', 'everyone eventually reaches the front'], ['Weakness', 'Convoy effect', 'average waiting time often long']],
    },
    {
      id: 'sjf', algo: 'sjf', name: 'Shortest-Job-First', priority: false,
      blurb: 'Run the shortest next CPU burst first. Optimal average wait.',
      lede: 'Associate each process with the length of its next CPU burst and run the <b>shortest</b> one. This version is <b>non-preemptive</b>: once a job starts, it finishes.',
      presets: first(['sjf1', 'sjf2', 'sjf3']),
      rule: 'Non-preemptive SJF picks the ready process with the <b>smallest burst time</b> (ties go to the earlier arrival).',
      idea: [
        'Whenever the CPU becomes free, choose the ready process with the shortest burst.',
        'Processes that arrive while a job runs must wait: non-preemptive SJF never interrupts.',
        'SJF is <b>optimal</b>: it gives the minimum average waiting time for a given set of processes.',
        'The difficulty is knowing the length of the next CPU request; in practice it is predicted from past bursts.',
      ],
      props: [['Preemptive?', 'No', 'see SRTF for the preemptive version'], ['Ready queue', 'Min burst'], ['Starvation?', 'Yes', 'long jobs can wait forever'], ['Optimal?', 'Yes', 'minimum average waiting time']],
    },
    {
      id: 'srtf', algo: 'srtf', name: 'Shortest Remaining Time First',
      blurb: 'Preemptive SJF: a shorter arrival takes the CPU.',
      lede: '<b>Preemptive SJF.</b> When a new process arrives with a shorter burst than what the running process has <b>left</b>, the running process is preempted.',
      presets: first(['srtf', 'sjf2', 'sjf3']),
      rule: 'SRTF picks the ready process with the <b>least remaining time</b>, including any process that was just preempted.',
      idea: [
        'At every arrival, compare the newcomer\'s burst with the <b>remaining</b> time of the running process.',
        'If the newcomer is shorter, the running process is preempted and goes back to the ready queue.',
        'The slide example (8, 4, 9, 5 arriving at 0, 1, 2, 3) gives an average wait of <b>6.5</b>.',
        'Equal remaining times do not cause a preemption.',
      ],
      props: [['Preemptive?', 'Yes'], ['Ready queue', 'Min remaining'], ['Starvation?', 'Yes', 'long jobs keep getting pushed back'], ['Optimal?', 'Yes', 'for average waiting time with arrivals']],
    },
    {
      id: 'priority', algo: 'prio', name: 'Priority (non-preemptive)', priority: true,
      blurb: 'Smallest priority number runs first, without interruption.',
      lede: 'Each process has a priority number and the CPU goes to the <b>highest priority</b> (smallest integer). Non-preemptive: a running process is never interrupted.',
      presets: first(['prio', 'priop']),
      rule: 'Priority scheduling picks the ready process with the <b>smallest priority number</b> (= highest priority).',
      idea: [
        'A priority number (integer) is associated with each process. Smallest integer = highest priority.',
        'SJF is a special case of priority scheduling where priority is the predicted next CPU burst.',
        '<b>Problem:</b> starvation, low priority processes may never execute.',
        '<b>Solution:</b> aging, gradually increase the priority of processes that wait a long time.',
      ],
      props: [['Preemptive?', 'No'], ['Ready queue', 'Min priority no.'], ['Starvation?', 'Yes', 'fixed by aging'], ['Slide example', 'avg WT 8.2']],
    },
    {
      id: 'priority-p', algo: 'prio-p', name: 'Priority (preemptive)', priority: true,
      blurb: 'A higher priority arrival preempts the running process.',
      lede: 'Like priority scheduling, but when a process with a <b>higher priority</b> (smaller number) arrives, it takes the CPU from the running process immediately.',
      presets: first(['priop', 'prio']),
      rule: 'Preemptive priority picks the ready process with the <b>smallest priority number</b>, including a process that was just preempted.',
      idea: [
        'At every arrival, compare the newcomer\'s priority with the running process\'s priority.',
        'If the newcomer has a smaller number (higher priority) the running process is preempted.',
        'Equal priority does not preempt.',
        'Low priority processes can starve; aging raises their priority as they wait.',
      ],
      props: [['Preemptive?', 'Yes'], ['Ready queue', 'Min priority no.'], ['Starvation?', 'Yes', 'fixed by aging'], ['Good for', 'Urgent work', 'e.g. real-time tasks']],
    },
    {
      id: 'round-robin', algo: 'rr', name: 'Round Robin', quantum: true,
      blurb: 'Each process gets a time quantum q, then goes to the back.',
      lede: 'Each process gets a small unit of CPU time, the <b>time quantum q</b>. When it is used up, the timer interrupt preempts the process and puts it at the <b>back</b> of the ready queue.',
      presets: first(['rr', 'rr2', 'fcfs1']), q: 4,
      rule: 'Round Robin always takes the process at the <b>front of the queue</b>. A preempted process re-joins at the back (after any process that arrived at the same moment).',
      idea: [
        'The ready queue is a FIFO queue; each turn lasts at most <b>q</b> time units.',
        'With n processes, each gets 1/n of the CPU and no process waits more than <b>(n − 1)·q</b> units.',
        '<b>q large</b> → behaves like FCFS. <b>q small</b> → many context switches; q should be large compared to the context switch time.',
        'Rule of thumb: 80% of CPU bursts should be shorter than q. Try changing q with the stepper.',
      ],
      props: [['Preemptive?', 'Yes', 'by the timer'], ['Ready queue', 'FIFO'], ['Starvation?', 'No'], ['Trade-off', 'Better response', 'higher average turnaround than SJF']],
    },
    {
      id: 'multilevel-queue', algo: 'mlq', name: 'Multilevel Queue', quantum: true,
      blurb: 'Foreground (RR) and background (FCFS) queues with priorities.',
      lede: 'The ready queue is split into a <b>foreground</b> (interactive) queue scheduled with RR and a <b>background</b> (batch) queue scheduled with FCFS. A process stays in its queue forever.',
      presets: ['mlq', 'rr2', 'sjf2'], q: 2,
      rule: 'With fixed priority the <b>foreground queue</b> is served first (RR); the background queue (FCFS) only runs when the foreground queue is empty.',
      idea: [
        'Each queue has its own algorithm: foreground → <b>RR</b>, background → <b>FCFS</b>.',
        '<b>Fixed priority:</b> serve all foreground processes first, then background. A foreground arrival preempts a background process. Possible starvation.',
        '<b>Time slice:</b> each queue gets a share of CPU time, e.g. 80% to foreground (RR) and 20% to background (FCFS). Here: 8 of every 10 time units.',
        'Set each process\'s queue in the table below, and switch the policy in the toolbar.',
      ],
      props: [['Queues', 'fg RR · bg FCFS'], ['Between queues', 'Fixed / slice'], ['Starvation?', 'Yes', 'with fixed priority'], ['Process moves?', 'Never', 'it stays in its queue']],
    },
  ];

  ALGOS.forEach((cfg) => {
    const full = { ...cfg, parent: PARENT, category: CAT };
    ns.register({ ...full, mount: ns.schedPage(full) });
  });

  /* ---------- compare page: same processes, every algorithm ---------- */
  const CMP = [
    { algo: 'fcfs', name: 'FCFS' },
    { algo: 'sjf', name: 'SJF' },
    { algo: 'srtf', name: 'SRTF' },
    { algo: 'prio', name: 'Priority' },
    { algo: 'prio-p', name: 'Priority (pre.)' },
    { algo: 'rr', name: 'Round Robin' },
  ];

  function mountCompare(container, cfg) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar" data-ref="toolbar"></div>
          <div class="card stage cmp-stage" data-ref="rows"></div>
          <div data-ref="player"></div>
          <div data-ref="ptable"></div>
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card"><header class="card-head"><h3>Averages</h3></header><div data-ref="avg"></div></section>
        </aside>
      </div>`;
    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const presets = ALL.map((id) => ns.SCHED_PRESETS.find((p) => p.id === id));
    let q = 4, preset = 'priop', runs = [], gantts = [], T = 1, metric = 'wt';

    $('toolbar').innerHTML = `
      <label class="field"><span>Example</span><select class="select" data-ref="preset">
        ${presets.map((p) => `<option value="${p.id}"${p.id === preset ? ' selected' : ''}>${p.name}</option>`).join('')}<option value="custom">Custom / random</option></select></label>
      <button class="btn" type="button" data-ref="random">Randomize</button><span class="sep"></span>
      <div class="field"><span>RR quantum q</span><div class="stepper"><button type="button" data-ref="qminus" aria-label="Decrease quantum">−</button><b data-ref="qval">${q}</b><button type="button" data-ref="qplus" aria-label="Increase quantum">+</button></div></div>
      <div class="seg" role="group" aria-label="Metric" data-ref="metric">
        <button type="button" data-m="wt" class="is-active">Waiting</button><button type="button" data-m="tat">Turnaround</button><button type="button" data-m="rt">Response</button></div>`;

    $('rows').innerHTML = CMP.map((c, k) => `
      <div class="cmp-row"><div class="cmp-name"><b>${c.name}</b><span class="mono" data-ref="m${k}"></span></div><div data-ref="g${k}"></div></div>`).join('');
    gantts = CMP.map((_, k) => ns.Gantt($(`g${k}`), { compact: true }));

    const player = new ns.Player($('player'), { onRender: render, speed: 6 });
    const table = ns.ProcTable($('ptable'), { cols: { pr: true }, onChange: () => { $('preset').value = 'custom'; rerun(); } });

    $('preset').addEventListener('change', (e) => {
      if (e.target.value === 'custom') return;
      const p = presets.find((x) => x.id === e.target.value);
      if (p.q) { q = p.q; $('qval').textContent = q; }
      table.set(p.procs); rerun();
    });
    $('random').addEventListener('click', () => { $('preset').value = 'custom'; table.set(ns.randomProcs()); rerun(); });
    const setQ = (v) => { q = Math.max(1, Math.min(20, v)); $('qval').textContent = q; rerun(); };
    $('qminus').addEventListener('click', () => setQ(q - 1));
    $('qplus').addEventListener('click', () => setQ(q + 1));
    $('metric').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      metric = b.dataset.m;
      $('metric').querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
      render(player.index);
    });

    function rerun() {
      runs = CMP.map((c) => ns.schedule(table.get(), c.algo, { q }));
      T = Math.max(...runs.map((r) => r.makespan));
      player.load(T + 1, T);
    }

    function render(t) {
      const name = { wt: 'waiting', tat: 'turnaround', rt: 'response' }[metric];
      runs.forEach((r, k) => {
        const segs = r.segs.filter((g) => g.s < t).map((g) => ({ ...g, e: Math.min(g.e, t) }));
        gantts[k].render(segs, T, t);
        $(`m${k}`).textContent = `avg ${metric.toUpperCase()} ${ns.fmt2(r.summary[metric])}`;
      });
      const vals = runs.map((r) => r.summary[metric]);
      const best = Math.min(...vals), max = Math.max(...vals, 1e-9);
      $('avg').innerHTML = `<table class="ftable cmp"><thead><tr><th>Algorithm</th><th>WT</th><th>TAT</th><th>RT</th></tr></thead><tbody>
        ${runs.map((r, k) => `<tr class="${r.summary[metric] === best ? 'is-top' : ''}"><td><span class="name">${CMP[k].name}</span><div class="bar"><span style="width:${Math.max(2, (r.summary[metric] / max) * 100)}%"></span></div></td>
          <td class="${metric === 'wt' ? 'f' : ''}">${ns.fmt2(r.summary.wt)}</td><td class="${metric === 'tat' ? 'f' : ''}">${ns.fmt2(r.summary.tat)}</td><td class="${metric === 'rt' ? 'f' : ''}">${ns.fmt2(r.summary.rt)}</td></tr>`).join('')}
        </tbody></table>
        <p class="card-hint" style="margin:10px 0 0">Bars show average ${name} time (shorter is better). RR uses q = ${q}.</p>`;
      const winners = CMP.filter((_, k) => vals[k] === best).map((c) => c.name).join(', ');
      $('step').innerHTML = ns.stepCard(t === T ? 'done' : 'select', t === T ? 'Finished' : 'Time', t, T + 1,
        t === T ? `Lowest average ${name} time: ${winners}` : `t = ${t}`,
        `<p>All six schedulers run the same processes side by side. Drag the slider or press play to replay them over time.</p>
         <p>SJF / SRTF minimise average <b>waiting</b> time, Round Robin usually gives the best <b>response</b> time, and FCFS suffers from the convoy effect.</p>`);
    }

    table.set(ns.SCHED_PRESETS.find((p) => p.id === preset).procs);
    rerun();
    return () => player.destroy();
  }

  const cmpCfg = {
    id: 'scheduling-compare', name: 'Compare Schedulers', parent: PARENT, category: CAT,
    blurb: 'Same processes, six algorithms: Gantt charts and averages side by side.',
    lede: 'Run FCFS, SJF, SRTF, both priority variants and Round Robin on the <b>same processes</b> and compare their Gantt charts and average waiting, turnaround and response times.',
  };
  ns.register({ ...cmpCfg, mount: (el) => mountCompare(el, cmpCfg) });
})(window.AlgoSim);
