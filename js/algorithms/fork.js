/*
 * Process creation (OS Chapter 3): fork(), exec(), wait(), exit(), zombies and orphans.
 * Every step, each runnable process executes one line of the program (lockstep), so the
 * process tree grows one "generation" at a time.
 */
(function (ns) {
  'use strict';

  const INIT = 1, SHELL = 50, MAIN = 100;

  // Line helpers. Zero-cost lines (braces, else, loop increment) are skipped automatically.
  const L = (src, op = { op: 'nop' }) => ({ src, ...op });

  const PROGRAMS = [
    {
      id: 'slide', name: 'Slide: fork() + execlp() + wait()',
      note: 'The Chapter 3 example: the child runs <span class="mono">ls</span>, the parent waits for it and then prints "Child Complete".',
      lines: () => [
        L('pid_t pid = fork();', { op: 'fork', v: 'pid' }),
        L('if (pid < 0) {', { op: 'if', cond: (v) => v.pid < 0, else: 3 }),
        L('    fprintf(stderr, "Fork Failed");', { op: 'print', text: 'Fork Failed' }),
        L('} else if (pid == 0) {', { op: 'elif', cond: (v) => v.pid === 0, else: 5, end: 8 }),
        L('    execlp("/bin/ls", "ls", NULL);', { op: 'exec', prog: 'ls' }),
        L('} else {', { op: 'else', end: 8 }),
        L('    wait(NULL);', { op: 'wait' }),
        L('    printf("Child Complete");', { op: 'print', text: 'Child Complete' }),
        L('}'),
        L('return 0;', { op: 'exit' }),
      ],
    },
    {
      id: 'three', name: 'fork(); fork(); fork();',
      note: 'Every fork() doubles the number of processes: n forks in a row give <b>2<sup>n</sup></b> processes, so "hello" prints 8 times.',
      lines: () => [
        L('fork();', { op: 'fork' }),
        L('fork();', { op: 'fork' }),
        L('fork();', { op: 'fork' }),
        L('printf("hello\\n");', { op: 'print', text: 'hello' }),
        L('return 0;', { op: 'exit' }),
      ],
    },
    {
      id: 'loop', name: 'fork() inside a for loop', loop: true,
      note: 'Each child inherits the loop counter i and continues the loop. With N iterations there are <b>2<sup>N</sup></b> processes and the printf runs 2 + 4 + … + 2<sup>N</sup> = <b>2<sup>N+1</sup> − 2</b> times.',
      lines: (n) => [
        L(`for (int i = 0; i < ${n}; i++) {`, { op: 'for', v: 'i', n, end: 4 }),
        L('    fork();', { op: 'fork' }),
        L('    printf("i = %d\\n", i);', { op: 'print', text: (v) => `i = ${v.i}` }),
        L('}', { op: 'next', v: 'i', to: 0 }),
        L('return 0;', { op: 'exit' }),
      ],
    },
    {
      id: 'zombie', name: 'Zombie: parent never calls wait()',
      note: 'The child exits at once, but the parent is asleep and never calls wait(). The child\'s entry stays in the process table as a <b>zombie</b> until someone collects its exit status.',
      lines: () => [
        L('pid_t pid = fork();', { op: 'fork', v: 'pid' }),
        L('if (pid == 0) {', { op: 'if', cond: (v) => v.pid === 0, else: 4 }),
        L('    printf("Child created\\n");', { op: 'print', text: 'Child created' }),
        L('    exit(0);          // child terminates', { op: 'exit' }),
        L('} else {', { op: 'else', end: 6 }),
        L('    sleep(10);        // no wait(): zombie!', { op: 'sleep', n: 10 }),
        L('}'),
        L('return 0;', { op: 'exit' }),
      ],
    },
    {
      id: 'orphan', name: 'Orphan: parent exits first',
      note: 'The parent exits while the child is still asleep. The child becomes an <b>orphan</b> and is adopted by <span class="mono">init</span> (PID 1), which reaps it when it finishes.',
      lines: () => [
        L('pid_t pid = fork();', { op: 'fork', v: 'pid' }),
        L('if (pid == 0) {', { op: 'if', cond: (v) => v.pid === 0, else: 4 }),
        L('    sleep(5);         // child sleeps', { op: 'sleep', n: 5 }),
        L('    printf("Orphan process running\\n");', { op: 'print', text: 'Orphan process running' }),
        L('} else {', { op: 'else', end: 6 }),
        L('    exit(0);          // parent exits immediately', { op: 'exit' }),
        L('}'),
        L('return 0;', { op: 'exit' }),
      ],
    },
  ];

  const LS = [L('ls', { op: 'print', text: 'a.out  fork.c  notes.txt' }), L('exit', { op: 'exit' })];
  const STATE_LABEL = { run: 'running', wait: 'waiting', sleep: 'sleeping', zombie: 'zombie', gone: 'terminated', sys: 'system' };

  /* ---------- interpreter: returns a list of snapshots ---------- */
  function simulate(prog, n) {
    const code = prog.lines(n);
    const procs = [
      { pid: INIT, ppid: 0, parent0: 0, label: 'init', state: 'sys', born: 0, vars: {} },
      { pid: SHELL, ppid: INIT, parent0: INIT, label: 'sh', state: 'sys', born: 0, vars: {} },
      { pid: MAIN, ppid: SHELL, parent0: SHELL, label: 'a.out', state: 'run', born: 0, prog: 'main', pc: 0, vars: {}, sleep: 0 },
    ];
    const by = (pid) => procs.find((p) => p.pid === pid);
    const out = [];
    const steps = [];
    let nextPid = MAIN + 1, time = 0;
    const codeOf = (p) => (p.prog === 'ls' ? LS : code);
    const B = (pid) => `<b>${pid}</b>`;

    function snap(kind, badge, title, events, exec) {
      steps.push({
        kind, badge, title, time, exec: exec || {},
        body: events.map((e) => `<p>${e}</p>`).join(''),
        procs: procs.map((p) => ({ pid: p.pid, ppid: p.ppid, parent0: p.parent0, label: p.label, state: p.state, orphan: !!p.orphan, born: p.born, vars: { ...p.vars }, line: p.prog === 'main' && p.state !== 'gone' && p.state !== 'zombie' ? p.pc : null })),
        out: out.slice(),
      });
    }

    function reap(c) { c.state = 'gone'; }

    function exit(p, ev) {
      p.state = 'zombie';
      procs.filter((c) => c.ppid === p.pid && c.state !== 'gone').forEach((c) => {
        c.ppid = INIT;
        if (c.state === 'zombie') { reap(c); ev.push(`Zombie ${B(c.pid)} loses its parent too: <span class="mono">init</span> adopts it and reaps it.`); }
        else { c.orphan = true; ev.push(`${B(c.pid)} is now an <b>orphan</b>: its parent ${p.pid} exited, so <span class="mono">init</span> (PID 1) adopts it.`); }
      });
      const par = by(p.ppid);
      if (par.pid === INIT) { reap(p); ev.push(`${B(p.pid)} exits. Its parent is <span class="mono">init</span>, which reaps it right away.`); }
      else if (par.pid === SHELL) { reap(p); ev.push(`${B(p.pid)} exits. The shell was waiting for it and collects its exit status.`); }
      else if (par.state === 'wait') {
        reap(p);
        par.state = 'run';
        par.pc++;
        ev.push(`${B(p.pid)} exits. Its parent ${B(par.pid)} is blocked in <span class="mono">wait()</span>, so wait() returns, the exit status is collected and ${B(par.pid)} continues.`);
      } else ev.push(`${B(p.pid)} exits, but its parent ${B(par.pid)} has not called wait(), so ${B(p.pid)} becomes a <b>zombie</b>: terminated, but its process-table entry remains.`);
    }

    // Skip lines that cost nothing (braces, else reached by falling through, loop increment)
    function settle(p) {
      for (let guard = 0; guard < 50; guard++) {
        const c = codeOf(p)[p.pc];
        if (!c) return;
        if (c.op === 'nop') { p.pc++; p.jumped = false; }
        else if (c.op === 'else') { p.pc = p.jumped ? p.pc + 1 : c.end; p.jumped = false; }
        else if (c.op === 'elif' && !p.jumped) p.pc = c.end;
        else if (c.op === 'next') { p.vars[c.v]++; p.pc = c.to; }
        else return;
      }
    }

    function exec(p, ev, newProcs) {
      settle(p);
      const c = codeOf(p)[p.pc];
      if (!c) { exit(p, ev); return null; }
      const line = p.prog === 'main' ? p.pc : null;
      p.jumped = false;
      switch (c.op) {
        case 'fork': {
          const child = { pid: nextPid++, ppid: p.pid, parent0: p.pid, label: p.label, state: 'run', born: steps.length, prog: p.prog, pc: p.pc + 1, vars: { ...p.vars }, sleep: 0 };
          if (c.v) { p.vars[c.v] = child.pid; child.vars[c.v] = 0; }
          newProcs.push(child);
          p.pc++;
          ev.push(`${B(p.pid)} calls <span class="mono">fork()</span> → child ${B(child.pid)}, an exact copy${Object.keys(p.vars).length ? ' (same variables)' : ''}. fork() returns <span class="eq">${child.pid}</span> in the parent and <span class="eq">0</span> in the child.`);
          break;
        }
        case 'if':
        case 'elif': {
          const ok = c.cond(p.vars);
          ev.push(`${B(p.pid)} tests <span class="mono">${c.src.replace(/^[}\s]*(else )?/, '').replace(/\s*\{$/, '')}</span> with pid = ${p.vars.pid}: <b>${ok ? 'true' : 'false'}</b>.`);
          if (ok) p.pc++; else { p.pc = c.else; p.jumped = true; }
          break;
        }
        case 'for': {
          if (p.vars[c.v] === undefined) p.vars[c.v] = 0;
          if (p.vars[c.v] < c.n) { p.pc++; ev.push(`${B(p.pid)}: i = ${p.vars[c.v]} &lt; ${c.n}, enter the loop body.`); }
          else { p.pc = c.end; ev.push(`${B(p.pid)}: i = ${p.vars[c.v]}, loop ends.`); }
          break;
        }
        case 'print': {
          const text = typeof c.text === 'function' ? c.text(p.vars) : c.text;
          out.push({ pid: p.pid, text });
          p.pc++;
          ev.push(`${B(p.pid)} prints <span class="mono">${ns.esc(text)}</span>.`);
          break;
        }
        case 'exec':
          p.prog = c.prog; p.label = c.prog; p.pc = 0;
          ev.push(`${B(p.pid)} calls <span class="mono">execlp()</span>: its memory image is <b>replaced</b> by the <span class="mono">${c.prog}</span> program. Same PID, new code; exec never returns.`);
          break;
        case 'wait': {
          const kids = procs.filter((k) => k.ppid === p.pid && k.state !== 'gone');
          const z = kids.find((k) => k.state === 'zombie');
          if (z) { reap(z); p.pc++; ev.push(`${B(p.pid)} calls <span class="mono">wait()</span> and collects the exit status of zombie ${B(z.pid)}.`); }
          else if (!kids.length) { p.pc++; ev.push(`${B(p.pid)} calls <span class="mono">wait()</span>, but it has no children, so wait() returns −1 at once.`); }
          else { p.state = 'wait'; ev.push(`${B(p.pid)} calls <span class="mono">wait()</span> and <b>blocks</b> until its child ${kids.map((k) => k.pid).join(', ')} terminates.`); }
          break;
        }
        case 'sleep':
          p.state = 'sleep'; p.sleep = c.n; p.pc++;
          ev.push(`${B(p.pid)} calls <span class="mono">sleep(${c.n})</span> and is blocked for ${c.n} time units.`);
          break;
        case 'exit':
          exit(p, ev);
          break;
        default:
          p.pc++;
      }
      return line;
    }

    snap('init', 'Start', 'The shell starts a.out', [`The shell (<span class="mono">sh</span>, PID ${SHELL}) has created process ${B(MAIN)} to run the program and waits for it. <span class="mono">init</span> (PID 1) is the ancestor of every process.`]);

    for (let guard = 0; guard < 120; guard++) {
      const live = procs.filter((p) => p.prog && p.state !== 'gone' && p.state !== 'zombie');
      if (!live.length) break;
      const ev = [];
      const runnable = live.filter((p) => p.state === 'run').sort((a, b) => a.pid - b.pid);
      if (!runnable.length) {
        const sleepers = live.filter((p) => p.state === 'sleep');
        if (!sleepers.length) break; // everyone blocked (cannot happen with these programs)
        const dt = Math.min(...sleepers.map((p) => p.sleep));
        time += dt;
        sleepers.forEach((p) => { p.sleep -= dt; if (!p.sleep) { p.state = 'run'; ev.push(`${B(p.pid)} wakes up.`); } });
        const zs = procs.filter((p) => p.state === 'zombie');
        if (zs.length) ev.push(`Meanwhile ${zs.map((z) => B(z.pid)).join(', ')} ${zs.length > 1 ? 'are' : 'is a'} still a zombie.`);
        snap('init', 'Time passes', `${dt} time unit${dt > 1 ? 's' : ''} pass (t = ${time})`, [`Every process is asleep or blocked, so nothing runs for ${dt} unit${dt > 1 ? 's' : ''}.`, ...ev]);
        continue;
      }
      time++;
      live.filter((p) => p.state === 'sleep').forEach((p) => { if (--p.sleep <= 0) { p.state = 'run'; p.woke = true; } });
      const newProcs = [];
      const execd = {};
      runnable.forEach((p) => {
        if (p.state !== 'run') return;
        const line = exec(p, ev, newProcs);
        if (line != null) (execd[line] = execd[line] || []).push(p.pid);
      });
      procs.push(...newProcs);
      live.filter((p) => p.woke).forEach((p) => { p.woke = false; ev.push(`${B(p.pid)} wakes up from sleep.`); });
      const forks = newProcs.length;
      const title = forks ? `${forks} new process${forks > 1 ? 'es' : ''} created (${procs.filter((p) => p.prog).length} so far)`
        : ev.some((e) => e.includes('zombie')) ? 'A zombie appears'
          : ev.some((e) => e.includes('orphan')) ? 'An orphan is adopted by init'
            : ev.some((e) => e.includes('exits')) ? 'Processes exit'
              : `t = ${time}`;
      snap(forks ? 'select' : 'expand', `t = ${time}`, title, ev, execd);
    }

    const users = procs.filter((p) => p.prog);
    const last = steps[steps.length - 1];
    last.kind = 'done';
    last.badge = 'Done';
    last.body += `<p>In total <b>${users.length}</b> process${users.length > 1 ? 'es' : ''} ran the program and <b>${out.length}</b> line${out.length === 1 ? ' was' : 's were'} printed.</p>`;
    return { steps, code, total: users.length };
  }

  /* ---------- tree layout (stable across steps: computed from the final tree) ---------- */
  function layout(procs) {
    const kids = (pid) => procs.filter((p) => p.parent0 === pid).sort((a, b) => a.pid - b.pid);
    const pos = {};
    let leaf = 0, depthMax = 0;
    (function walk(p, d) {
      depthMax = Math.max(depthMax, d);
      const ch = kids(p.pid);
      if (!ch.length) { pos[p.pid] = { x: leaf++, d }; return; }
      ch.forEach((c) => walk(c, d + 1));
      pos[p.pid] = { x: (pos[ch[0].pid].x + pos[ch[ch.length - 1].pid].x) / 2, d };
    })(procs[0], 0);
    return { pos, width: Math.max(1, leaf), depth: depthMax };
  }

  function mount(container, cfg) {
    container.innerHTML = ns.localFrame(cfg);
    const host = container.querySelector('[data-ref="body"]');
    host.innerHTML = `
      <div class="sim-grid">
        <div class="stage-col">
          <div class="toolbar" data-ref="toolbar"></div>
          <div class="card stage fork-stage">
            <svg data-ref="svg" role="img" aria-label="Process tree"></svg>
            <div class="legend">
              <span><i class="lg-run"></i>running</span><span><i class="lg-wait"></i>waiting / sleeping</span>
              <span><i class="lg-zombie"></i>zombie</span><span><i class="lg-gone"></i>terminated</span><span><i class="lg-adopt"></i>adopted by init</span>
            </div>
          </div>
          <div data-ref="player"></div>
          <div class="fork-pair">
            <section class="card fork-code"><header class="card-head"><h3>Program</h3><span class="count">badges = PIDs that ran the line this step</span></header><div data-ref="code"></div></section>
            <section class="card fork-out"><header class="card-head"><h3>Output</h3><span class="count" data-ref="ocount"></span></header><div class="console" data-ref="out"></div></section>
          </div>
          <section class="card about">
            <div class="about-idea"><h3>How it works</h3><ul>
              <li><b>fork()</b> creates a child that is an exact copy of the parent and both continue from the next line. It returns <b>0</b> in the child, the child's <b>PID</b> in the parent, and <b>&lt; 0</b> on failure.</li>
              <li><b>exec()</b> (e.g. execlp) replaces the process's memory image with a new program. The PID stays the same and exec never returns on success.</li>
              <li><b>wait()</b> blocks the parent until a child terminates, then collects its exit status.</li>
              <li><b>Zombie:</b> a terminated child whose parent has not called wait(). <b>Orphan:</b> a child whose parent terminated first; init (PID 1) adopts and reaps it.</li>
            </ul></div>
            <div class="about-props"><h3>Process states</h3><div class="props">
              <div class="prop"><div class="k">new</div><div class="n">being created</div></div>
              <div class="prop"><div class="k">running</div><div class="n">instructions are being executed</div></div>
              <div class="prop"><div class="k">waiting</div><div class="n">waiting for some event (child exit, sleep, I/O)</div></div>
              <div class="prop"><div class="k">ready</div><div class="n">waiting to be assigned to a processor</div></div>
              <div class="prop"><div class="k">terminated</div><div class="n">finished execution</div></div>
              <div class="prop"><div class="k">zombie</div><div class="n">terminated, exit status not yet collected</div></div>
            </div><div class="props-foot">Here every runnable process runs one line per step. Real systems interleave them in any order the CPU scheduler picks.</div></div>
          </section>
        </div>
        <aside class="inspector">
          <section class="card step-card" data-ref="step" aria-live="polite"></section>
          <section class="card"><header class="card-head"><h3>Process table</h3><span class="count" data-ref="pcount"></span></header><div data-ref="ptable"></div></section>
          <section class="card"><header class="card-head"><h3>About this program</h3></header><p class="step-body" data-ref="note" style="margin:0"></p></section>
        </aside>
      </div>`;

    const $ = (r) => host.querySelector(`[data-ref="${r}"]`);
    let prog = PROGRAMS[0], loopN = 3, run = null, lay = null;
    const player = new ns.Player($('player'), { onRender: render, speed: 3 });

    function buildToolbar() {
      $('toolbar').innerHTML = `
        <label class="field"><span>Program</span><select class="select" data-ref="prog">
          ${PROGRAMS.map((p) => `<option value="${p.id}"${p.id === prog.id ? ' selected' : ''}>${p.name}</option>`).join('')}</select></label>
        ${prog.loop ? `<div class="field"><span>Iterations N</span><div class="stepper"><button type="button" data-ref="nminus" aria-label="Fewer iterations">−</button><b data-ref="nval">${loopN}</b><button type="button" data-ref="nplus" aria-label="More iterations">+</button></div></div>` : ''}`;
      $('prog').addEventListener('change', (e) => { prog = PROGRAMS.find((p) => p.id === e.target.value); buildToolbar(); rerun(); });
      if (prog.loop) {
        const set = (v) => { loopN = Math.max(1, Math.min(4, v)); $('nval').textContent = loopN; rerun(); };
        $('nminus').addEventListener('click', () => set(loopN - 1));
        $('nplus').addEventListener('click', () => set(loopN + 1));
      }
    }

    function rerun() {
      player.pause();
      run = simulate(prog, loopN);
      lay = layout(run.steps[run.steps.length - 1].procs);
      $('note').innerHTML = prog.note;
      $('code').innerHTML = `<pre class="pseudo fork-pre">${run.code.map((c, i) => `<span data-line="${i}"><i class="gut" data-gut="${i}"></i>${ns.esc(c.src)}</span>`).join('')}</pre>`;
      player.load(run.steps.length, 0);
    }

    function render(i) {
      const st = run.steps[i];
      const prev = run.steps[i - 1];
      const procs = st.procs.filter((p) => p.born <= i);
      const prevState = prev ? Object.fromEntries(prev.procs.map((p) => [p.pid, p.state])) : {};

      // Tree
      const DX = 74, DY = 86, PAD = 44;
      const W = Math.max(lay.width * DX + PAD * 2 - DX, 420), H = lay.depth * DY + PAD * 2;
      const off = (W - (lay.width - 1) * DX) / 2;
      const X = (pid) => off + lay.pos[pid].x * DX, Y = (pid) => PAD + lay.pos[pid].d * DY;
      const svg = $('svg');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.style.maxWidth = W + 'px'; // never scale the tree above its natural size
      const edges = procs.filter((p) => p.parent0).map((p) => `<line class="tedge${p.state === 'gone' ? ' is-gone' : ''}" x1="${X(p.parent0)}" y1="${Y(p.parent0)}" x2="${X(p.pid)}" y2="${Y(p.pid)}"/>`).join('');
      const adopt = procs.filter((p) => p.orphan && p.ppid === INIT && p.parent0 !== INIT).map((p) => {
        const x1 = X(INIT), y1 = Y(INIT), x2 = X(p.pid), y2 = Y(p.pid);
        const cx = Math.max(x1, x2) + 120;
        return `<path class="tadopt" d="M${x1} ${y1} Q ${cx} ${(y1 + y2) / 2} ${x2} ${y2}"/>`;
      }).join('');
      const nodes = procs.map((p) => {
        const cls = p.state === 'sleep' ? 'wait' : p.state;
        const isNew = p.born === i && i > 0;
        const changed = prev && prevState[p.pid] !== p.state;
        return `<g class="pnode st-${cls}${isNew ? ' is-new' : ''}${changed && !isNew ? ' is-changed' : ''}" transform="translate(${X(p.pid)} ${Y(p.pid)})">
          <circle r="22"/><text class="pid" dy="1">${p.pid}</text>
          <text class="plabel" y="38">${p.label}${p.state === 'zombie' ? ' · Z' : p.state === 'sleep' ? ' · zZ' : ''}</text>
          <title>PID ${p.pid} (${p.label}), parent ${p.ppid}: ${STATE_LABEL[p.state]}</title></g>`;
      }).join('');
      svg.innerHTML = `<g>${edges}${adopt}</g><g>${nodes}</g>`;

      // Code: which processes executed each line this step
      host.querySelectorAll('.fork-pre [data-line]').forEach((el) => {
        const pids = st.exec[el.dataset.line] || [];
        el.classList.toggle('is-active', pids.length > 0);
        el.querySelector('.gut').innerHTML = pids.length > 4 ? `<b>${pids.length}×</b>` : pids.map((p) => `<b>${p}</b>`).join('');
      });

      // Output
      $('out').innerHTML = st.out.length ? st.out.map((o, k) => `<div class="${prev && k >= prev.out.length ? 'is-new' : ''}"><span class="who">[${o.pid}]</span> ${ns.esc(o.text)}</div>`).join('') : '<div class="muted">no output yet</div>';
      $('out').scrollTop = $('out').scrollHeight;
      $('ocount').textContent = `${st.out.length} line${st.out.length === 1 ? '' : 's'}`;

      // Process table
      const users = procs.filter((p) => p.pid >= MAIN);
      $('pcount').textContent = `${users.filter((p) => p.state !== 'gone').length} alive`;
      const hasPid = run.code.some((c) => c.v === 'pid'), hasI = prog.loop;
      $('ptable').innerHTML = `<div class="table-scroll"><table class="ftable"><thead><tr><th>PID</th><th>PPID</th>${hasPid ? '<th>pid var</th>' : ''}${hasI ? '<th>i</th>' : ''}<th>State</th></tr></thead><tbody>
        ${users.map((p) => `<tr><td><span class="name">${p.pid}</span>${p.label !== 'a.out' ? ` <span class="muted">${p.label}</span>` : ''}</td><td>${p.ppid}${p.orphan ? ' <span class="tag tag-adopt">adopted</span>' : ''}</td>${hasPid ? `<td>${p.vars.pid ?? '–'}</td>` : ''}${hasI ? `<td>${p.vars.i ?? '–'}</td>` : ''}<td><span class="st st-${p.state}">${STATE_LABEL[p.state]}</span></td></tr>`).join('')}
        </tbody></table></div>`;

      $('step').innerHTML = ns.stepCard(st.kind, st.badge, i, run.steps.length, st.title, st.body);
    }

    buildToolbar();
    rerun();
    return () => player.destroy();
  }

  const cfg = {
    id: 'fork', name: 'fork(), exec() and wait()', parent: 'Operating Systems', category: 'Processes',
    blurb: 'Watch the process tree grow; spot zombies and orphans.',
    lede: 'Step through C programs that create processes. Each <b>fork()</b> copies the calling process, <b>exec()</b> replaces its program and <b>wait()</b> collects a child\'s exit status.',
  };
  ns.register({ ...cfg, mount: (el) => mount(el, cfg) });
})(window.AlgoSim);
