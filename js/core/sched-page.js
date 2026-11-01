/*
 * Shared page for CPU scheduling algorithms: editable process table, CPU + ready queue,
 * growing Gantt chart, per-process results and quiz mode.
 *   AlgoSim.register({ ...cfg, mount: AlgoSim.schedPage(cfg) })
 */
(function (ns) {
  'use strict';

  const LIMITS = { at: [0, 60], bt: [1, 40], pr: [0, 20] };
  const MAX_PROCS = 8;
  const clamp = (v, [lo, hi]) => Math.max(lo, Math.min(hi, v));
  const pc = (i) => `pc-${i % 8}`;

  /* ---------- Gantt chart (blocks are reused so they can grow smoothly) ---------- */
  ns.Gantt = function Gantt(host, opts = {}) {
    host.innerHTML = `<div class="gantt${opts.compact ? ' compact' : ''}"><div class="gantt-track"><div class="g-now"></div></div><div class="gantt-axis"></div></div>`;
    const track = host.querySelector('.gantt-track');
    const axis = host.querySelector('.gantt-axis');
    const now = host.querySelector('.g-now');
    const blocks = [];
    return {
      // segs: [{ id, i, s, e }], T: total length of the axis, t: current time, live: index of the running segment
      render(segs, T, t, live = -1) {
        const x = (v) => (T ? (v / T) * 100 : 0);
        segs.forEach((g, k) => {
          let el = blocks[k];
          if (!el) { el = document.createElement('div'); el.innerHTML = '<span></span>'; track.append(el); blocks[k] = el; }
          el.className = 'g-blk ' + (g.id ? pc(g.i) : 'g-idle') + (k === live ? ' is-live' : '');
          el.style.left = x(g.s) + '%';
          el.style.width = x(g.e - g.s) + '%';
          el.firstChild.textContent = g.id || (g.e - g.s >= T * 0.04 ? 'idle' : '');
          el.title = `${g.id || 'idle'}: ${g.s} → ${g.e}`;
        });
        blocks.splice(segs.length).forEach((el) => el.remove());
        now.style.left = x(t) + '%';
        now.hidden = t == null;
        // Axis: every segment boundary, skipping labels that would collide
        const marks = [...new Set([0, ...segs.flatMap((g) => [g.s, g.e])])].sort((a, b) => a - b);
        const gap = T * (opts.compact ? 0.05 : 0.032);
        const kept = [];
        marks.forEach((m, k) => {
          const last = kept[kept.length - 1];
          if (last != null && m - last < gap) { if (k === marks.length - 1) kept[kept.length - 1] = m; return; }
          kept.push(m);
        });
        axis.innerHTML = kept.map((m) => `<span style="left:${x(m)}%">${m}</span>`).join('');
      },
    };
  };

  /* ---------- editable process table ---------- */
  ns.ProcTable = function ProcTable(host, opts) {
    let procs = [];
    const cols = opts.cols || {};
    host.innerHTML = `
      <section class="card ptable-card">
        <header class="card-head"><h3>Processes</h3><span class="count" data-r="n"></span></header>
        <div class="table-scroll"><table class="ftable ptable"><thead><tr>
          <th>Process</th><th title="Arrival time">Arrival</th><th title="CPU burst time">Burst</th>
          ${cols.pr ? '<th title="Smaller number = higher priority">Priority</th>' : ''}
          ${cols.q ? '<th>Queue</th>' : ''}
          ${cols.live ? '<th>Remaining</th><th>State</th>' : ''}<th><span class="sr-only">Remove</span></th>
        </tr></thead><tbody data-r="body"></tbody></table></div>
        <div class="ptable-foot"><button class="btn" type="button" data-r="add">+ Add process</button><span class="card-hint">Edit any number and the simulation reruns.</span></div>
      </section>`;
    const body = host.querySelector('[data-r="body"]');
    const addBtn = host.querySelector('[data-r="add"]');
    const num = (f, v, i) => `<input class="num" type="number" inputmode="numeric" min="${LIMITS[f][0]}" max="${LIMITS[f][1]}" value="${v}" data-f="${f}" data-i="${i}" aria-label="${f}">`;

    function build() {
      body.innerHTML = procs.map((p, i) => `
        <tr data-pid="${p.id}">
          <td><span class="pchip ${pc(i)}">${p.id}</span></td>
          <td>${num('at', p.at, i)}</td><td>${num('bt', p.bt, i)}</td>
          ${cols.pr ? `<td>${num('pr', p.pr, i)}</td>` : ''}
          ${cols.q ? `<td><select class="select sm" data-f="q" data-i="${i}" aria-label="queue"><option value="fg"${p.q === 'fg' ? ' selected' : ''}>foreground</option><option value="bg"${p.q === 'bg' ? ' selected' : ''}>background</option></select></td>` : ''}
          ${cols.live ? '<td class="rem-cell"><div class="rem"><span class="mono" data-c="rem"></span><div class="bar"><span data-c="bar"></span></div></div></td><td><span class="st" data-c="st"></span></td>' : ''}
          <td><button class="icon-btn sm" type="button" data-del="${i}" title="Remove ${p.id}" aria-label="Remove ${p.id}"${procs.length <= 1 ? ' disabled' : ''}>×</button></td>
        </tr>`).join('');
      host.querySelector('[data-r="n"]').textContent = procs.length;
      addBtn.disabled = procs.length >= MAX_PROCS;
    }

    body.addEventListener('input', (e) => {
      const el = e.target.closest('[data-f]');
      if (!el) return;
      const p = procs[+el.dataset.i];
      const f = el.dataset.f;
      if (f === 'q') p.q = el.value;
      else {
        if (el.value === '' || isNaN(+el.value)) return;
        p[f] = clamp(Math.round(+el.value), LIMITS[f]);
      }
      opts.onChange(procs);
    });
    body.addEventListener('change', (e) => { // show the clamped value once editing is done
      const el = e.target.closest('input[data-f]');
      if (el) el.value = procs[+el.dataset.i][el.dataset.f];
    });
    body.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { procs.splice(+del.dataset.del, 1); renumber(); build(); opts.onChange(procs); return; }
      const row = e.target.closest('tr[data-pid]');
      if (row && opts.onPick && !e.target.closest('input, select, button')) opts.onPick(row.dataset.pid);
    });
    addBtn.addEventListener('click', () => {
      if (procs.length >= MAX_PROCS) return;
      const last = procs[procs.length - 1];
      procs.push({ id: '', at: last ? last.at + 1 : 0, bt: 3, pr: 2, q: 'fg' });
      renumber(); build(); opts.onChange(procs);
    });
    // Keep labels P1..Pn in table order
    function renumber() { procs.forEach((p, i) => { p.id = `P${i + 1}`; }); }

    return {
      set(list) { procs = list.map((p) => ({ ...p })); build(); },
      get: () => procs,
      // step: a recorded scheduler step (live columns), or null
      render(step) {
        if (!cols.live) return;
        [...body.children].forEach((tr, i) => {
          const p = procs[i];
          if (!p || !step) return;
          const st = step.state[i];
          tr.className = st === 'run' ? 'is-run' : st === 'done' ? 'is-done' : '';
          tr.querySelector('[data-c="rem"]').textContent = `${step.rem[i]} / ${p.bt}`;
          tr.querySelector('[data-c="bar"]').style.width = (step.rem[i] / p.bt) * 100 + '%';
          const label = { new: 'not arrived', ready: 'ready', run: 'running', done: 'terminated' }[st];
          const el = tr.querySelector('[data-c="st"]');
          el.className = `st st-${st}`;
          el.textContent = label;
        });
      },
    };
  };

  /* ---------- the page ---------- */
  ns.schedPage = (cfg) => function mount(container) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    const mlq = cfg.algo === 'mlq';
    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar" data-ref="toolbar"></div>
          <div class="card stage sched-stage">
            <div class="cpu-row">
              <div class="cpu-box" data-ref="cpu"></div>
              <div class="cpu-queues${mlq ? ' two' : ''}"><div data-ref="dsA"></div>${mlq ? '<div data-ref="dsB"></div>' : ''}</div>
            </div>
            <div class="gantt-wrap"><div class="gantt-title">Gantt chart</div><div data-ref="gantt"></div></div>
          </div>
          <div data-ref="player"></div>
          <div data-ref="ptable"></div>
          <section class="card about">
            <div class="about-idea"><h3>How it works</h3><ul>${cfg.idea.map((x) => `<li>${x}</li>`).join('')}</ul></div>
            <div class="about-props"><h3>Properties</h3><div class="props">${cfg.props.map(([k, v, n]) => `<div class="prop"><div class="k">${k}</div><div class="v">${v}</div>${n ? `<div class="n">${n}</div>` : ''}</div>`).join('')}</div>
              <div class="props-foot">CT = completion time · TAT = CT − arrival · WT = TAT − burst · RT = first run − arrival</div></div>
          </section>
        </div>
        <aside class="inspector">
          <section class="card quiz-card" data-ref="quiz" aria-live="polite" hidden></section>
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card"><header class="card-head"><h3>Results</h3><span class="count" data-ref="rcount"></span></header><div data-ref="results"></div></section>
        </aside>
      </div>`;

    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    const sorted = ns.SCHED_SORT[cfg.algo];
    const presets = cfg.presets.map((id) => ns.SCHED_PRESETS.find((p) => p.id === id));
    let preset = presets[0].id;
    let q = presets[0].q || cfg.q || 4;
    let mlqMode = 'fixed';
    let run = null;

    const player = new ns.Player($('player'), { onRender: render, speed: 3, guard: (from, to) => quizGuard(to) });
    const gantt = ns.Gantt($('gantt'));
    const kind = sorted ? 'pq' : 'queue';
    const dsA = ns.DSView($('dsA'), { kind, title: mlq ? 'Foreground queue · RR' : sorted ? `Ready queue · ordered by ${sorted === 'rem' ? (cfg.algo === 'sjf' ? 'burst' : 'remaining time') : 'priority'}` : 'Ready queue · FIFO' });
    const dsB = mlq ? ns.DSView($('dsB'), { kind: 'queue', title: 'Background queue · FCFS' }) : null;
    const table = ns.ProcTable($('ptable'), { cols: { pr: !!cfg.priority, q: mlq, live: true }, onChange: edited, onPick: (id) => pending && answer(id) });

    /* ---------- quiz: predict which process is dispatched ---------- */
    let quiz = false;
    try { quiz = localStorage.getItem('algosim-quiz') === '1'; } catch (e) {}
    let pending = null, feedback = null;
    const answered = new Set();
    const score = { right: 0, total: 0 };

    function quizGuard(to) {
      if (!quiz || answered.has(to)) return true;
      const st = run && run.steps[to];
      if (!st || !st.ask) return true;
      pending = { idx: to, ...st.ask, tried: false };
      feedback = null;
      renderQuiz();
      return false;
    }

    function answer(id) {
      const qz = pending;
      if (!qz) return;
      const inQueue = qz.cands.includes(id);
      const tie = inQueue && qz.vals && qz.vals[id] === qz.vals[qz.answer] && id !== qz.answer;
      const ok = id === qz.answer || tie;
      if (!qz.tried) { score.total++; if (ok) score.right++; qz.tried = true; }
      if (ok) {
        feedback = { ok: true, text: tie ? `Good thinking: <b>${id}</b> ties with <b>${qz.answer}</b>. The tie is broken by arrival time, so <b>${qz.answer}</b> runs.` : `Correct! ${cfg.rule}` };
        reveal(true);
      } else {
        feedback = { ok: false, text: inQueue ? `Not quite. ${cfg.rule} Try again.` : `<b>${id}</b> is not waiting in the ready queue. Pick one of the processes in the queue.` };
        renderQuiz();
      }
    }

    function reveal(keep) {
      const qz = pending;
      if (!qz) return;
      if (!keep) { if (!qz.tried) { score.total++; qz.tried = true; } feedback = { ok: null, text: `It was <b>${qz.answer}</b>. ${cfg.rule}` }; }
      answered.add(qz.idx);
      pending = null;
      player.go(qz.idx);
      renderQuiz();
    }

    function renderQuiz() {
      const box = $('quiz');
      box.hidden = !quiz;
      host.classList.toggle('quiz-asking', !!pending);
      if (!quiz) return;
      let html = `<div class="quiz-head"><span class="quiz-title">Quiz mode</span><span class="quiz-score">${score.right} / ${score.total} correct</span></div>`;
      if (pending) {
        html += `<p class="quiz-q">Your turn: which process gets the CPU next?</p><p class="quiz-sub">Click it in the ready queue or the process table.</p>
          ${feedback ? `<div class="quiz-fb ${feedback.ok === false ? 'bad' : 'ok'}">${feedback.text}</div>` : ''}
          <button class="btn quiz-reveal" type="button" data-ref="reveal">Show me the answer</button>`;
      } else if (feedback) html += `<div class="quiz-fb ${feedback.ok ? 'ok' : 'info'}">${feedback.text}</div>`;
      else html += '<p class="quiz-sub">Press <kbd>→</kbd> or play. Whenever the scheduler has a real choice, the simulation stops and asks you to predict it.</p>';
      box.innerHTML = html;
      if ($('reveal')) $('reveal').addEventListener('click', () => reveal(false));
    }

    host.querySelector('.cpu-queues').addEventListener('click', (e) => {
      const it = e.target.closest('.ds-item');
      if (it && pending && it.dataset.node) answer(it.dataset.node);
    });

    /* ---------- toolbar ---------- */
    function buildToolbar() {
      $('toolbar').innerHTML = `
        <label class="field"><span>Example</span><select class="select" data-ref="preset">
          ${presets.map((p) => `<option value="${p.id}"${p.id === preset ? ' selected' : ''}>${p.name}</option>`).join('')}
          <option value="custom"${preset === 'custom' ? ' selected' : ''}>Custom / random</option></select></label>
        <button class="btn" type="button" data-ref="random">Randomize</button>
        ${cfg.quantum ? `<span class="sep"></span><div class="field"><span>Quantum q</span>
          <div class="stepper"><button type="button" data-ref="qminus" aria-label="Decrease quantum">−</button><b data-ref="qval">${q}</b><button type="button" data-ref="qplus" aria-label="Increase quantum">+</button></div></div>` : ''}
        ${mlq ? `<label class="field"><span>Between queues</span><select class="select" data-ref="mode">
          <option value="fixed"${mlqMode === 'fixed' ? ' selected' : ''}>Fixed priority</option><option value="slice"${mlqMode === 'slice' ? ' selected' : ''}>Time slice 80% / 20%</option></select></label>` : ''}
        <label class="switch quiz-switch" title="Predict each scheduling decision before it is revealed"><input type="checkbox" data-ref="quizOn"${quiz ? ' checked' : ''}><span class="switch-track"></span>Quiz me</label>`;
      $('preset').addEventListener('change', (e) => { if (e.target.value === 'custom') return; loadPreset(e.target.value); });
      $('random').addEventListener('click', () => { preset = 'custom'; $('preset').value = 'custom'; table.set(ns.randomProcs()); rerun(); });
      if (cfg.quantum) {
        const set = (v) => { q = Math.max(1, Math.min(20, v)); $('qval').textContent = q; rerun(); };
        $('qminus').addEventListener('click', () => set(q - 1));
        $('qplus').addEventListener('click', () => set(q + 1));
      }
      if (mlq) $('mode').addEventListener('change', (e) => { mlqMode = e.target.value; rerun(); });
      $('quizOn').addEventListener('change', (e) => {
        quiz = e.target.checked;
        try { localStorage.setItem('algosim-quiz', quiz ? '1' : '0'); } catch (err) {}
        pending = null; feedback = null;
        renderQuiz();
      });
    }

    function loadPreset(id) {
      const p = presets.find((x) => x.id === id);
      preset = id;
      if (p.q && cfg.quantum) { q = p.q; if ($('qval')) $('qval').textContent = q; }
      table.set(p.procs);
      rerun();
    }

    function edited() {
      preset = 'custom';
      $('preset').value = 'custom';
      rerun();
    }

    function rerun() {
      player.pause();
      pending = null; feedback = null;
      answered.clear();
      score.right = 0; score.total = 0;
      renderQuiz();
      run = ns.schedule(table.get(), cfg.algo, { q, mlqMode });
      player.load(run.steps.length, 0);
    }

    /* ---------- render one step ---------- */
    function render(i) {
      const st = run.steps[i];
      const procs = table.get();
      const byId = Object.fromEntries(procs.map((p, k) => [p.id, k]));
      const next = run.steps[i + 1];

      // CPU
      const r = st.running != null ? byId[st.running] : -1;
      $('cpu').innerHTML = `
        <div class="cpu-label">CPU</div>
        <div class="cpu-core${r >= 0 ? ' busy ' + pc(r) : ''}">${r >= 0 ? `<b>${st.running}</b><small>${st.rem[r]} left</small>` : `<span>${st.kind === 'expand' && !st.running ? 'deciding…' : 'idle'}</span>`}</div>
        <div class="clock mono">t = <b>${st.t}</b></div>`;

      // Ready queue(s)
      const nextId = !pending && next && next.ask ? next.running : null;
      const items = (ids) => ids.map((id) => {
        const k = byId[id];
        const sub = sorted === 'pr' ? `pri ${procs[k].pr}` : sorted === 'rem' ? `${cfg.algo === 'sjf' ? 'burst' : 'rem'} ${st.rem[k]}` : `rem ${st.rem[k]}`;
        return { key: id, node: id, label: id, sub, cls: pc(k) + (id === nextId ? ' is-next' : '') };
      });
      const animate = Math.abs(i - (render.last ?? -9)) === 1;
      render.last = i;
      dsA.render(items(st.fg), { animate, op: mlq ? '' : queueOp(st) });
      if (dsB) dsB.render(items(st.bg), { animate });

      // Gantt: the running block stretches to the next event so you can see how long it will run
      const segs = st.segs.map((g) => ({ ...g }));
      let live = -1;
      if (st.running && next) { live = segs.length - 1; segs[live].e = next.t; }
      gantt.render(segs, run.makespan, st.t, live);

      table.render(st);
      $('step').innerHTML = ns.stepCard(st.kind, st.badge, i, run.steps.length, st.title, st.body);

      // Results so far
      const done = st.ct.filter((c) => c != null).length;
      $('rcount').textContent = `${done} / ${procs.length} done`;
      const rows = run.results.map((res, k) => {
        const fin = st.ct[k] != null, started = st.first[k] != null;
        const c = (v, show) => `<td>${show ? v : '<span class="muted">·</span>'}</td>`;
        return `<tr class="${fin ? '' : 'is-pending'}"><td><span class="pchip ${pc(k)}">${res.id}</span></td>${c(res.ct, fin)}${c(res.tat, fin)}${c(res.wt, fin)}${c(res.rt, started)}</tr>`;
      }).join('');
      const end = i === run.steps.length - 1;
      const S = run.summary;
      $('results').innerHTML = `
        <div class="table-scroll"><table class="ftable rtable"><thead><tr><th>Proc</th><th title="Completion time">CT</th><th title="Turnaround = CT − AT">TAT</th><th title="Waiting = TAT − BT">WT</th><th title="Response = first run − AT">RT</th></tr></thead><tbody>${rows}</tbody>
        ${end ? `<tfoot><tr><td>Average</td><td></td><td>${ns.fmt2(S.tat)}</td><td>${ns.fmt2(S.wt)}</td><td>${ns.fmt2(S.rt)}</td></tr></tfoot>` : ''}</table></div>
        <div class="stats sched-stats">
          <div class="stat"><div class="k">Avg waiting</div><div class="v">${end ? ns.fmt2(S.wt) : '–'}</div></div>
          <div class="stat"><div class="k">Avg turnaround</div><div class="v">${end ? ns.fmt2(S.tat) : '–'}</div></div>
          <div class="stat"><div class="k">CPU utilization</div><div class="v">${end ? Math.round(S.util * 100) + '<small>%</small>' : '–'}</div></div>
          <div class="stat"><div class="k">Throughput</div><div class="v">${end ? `${procs.length}<small> / ${S.makespan} units</small>` : '–'}</div></div>
        </div>`;
    }

    function queueOp(st) {
      if (st.badge === 'Dispatch') return `dispatch <b>${st.running}</b> →`;
      return '';
    }

    buildToolbar();
    renderQuiz();
    loadPreset(preset);
    return () => player.destroy();
  };
})(window.AlgoSim);
