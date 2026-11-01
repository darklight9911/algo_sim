/*
 * CPU scheduling (OS Chapter 6): simulate an algorithm one time unit at a time and record a
 * step at every scheduling event (arrival, dispatch, preemption, quantum expiry, completion).
 *   const run = AlgoSim.schedule(procs, 'srtf', { q: 4 });
 *   procs: [{ id: 'P1', at, bt, pr, q: 'fg' | 'bg' }]
 *   algos: fcfs, sjf, srtf, prio, prio-p, rr, mlq
 */
(function (ns) {
  'use strict';

  // Which field orders the ready queue (null = plain FIFO queue)
  const SORT = { fcfs: null, rr: null, mlq: null, sjf: 'rem', srtf: 'rem', prio: 'pr', 'prio-p': 'pr' };
  const KEY_LABEL = { sjf: 'burst', srtf: 'remaining', prio: 'priority', 'prio-p': 'priority' };
  ns.SCHED_SORT = SORT;

  ns.schedule = function schedule(input, algo, opts = {}) {
    const q = Math.max(1, opts.q || 4);
    const slice = algo === 'mlq' && opts.mlqMode === 'slice';
    const share = 8; // time-slice MLQ: 8 of every 10 units to the foreground queue (80% / 20%)
    const P = input.map((p, i) => ({ ...p, i, q: p.q || 'fg', rem: p.bt, first: null, ct: null }));
    const n = P.length;
    const key = SORT[algo];
    const cmp = key ? (a, b) => a[key] - b[key] || a.at - b.at || a.i - b.i : null;
    const usesQ = algo === 'rr' || algo === 'mlq';
    const fg = [], bg = []; // fg doubles as the single ready queue for every other algorithm
    const queueOf = (p) => (algo === 'mlq' && p.q === 'bg' ? bg : fg);
    const order = (arr) => (cmp ? arr.slice().sort(cmp) : arr.slice());
    const slotAt = (t) => (t % 10 < share ? 'fg' : 'bg');
    const segs = [];
    const steps = [];
    let running = null, qUsed = 0, t = 0, done = 0, seg = null, carry = [];

    const val = (p) => (key === 'rem' ? p.rem : p.pr);
    const b = (p) => `<b>${p.id}</b>`;

    function snap(kind, badge, title, notes, extra) {
      steps.push({
        t, kind, badge, title,
        body: notes.map((x) => `<p>${x}</p>`).join(''),
        running: running ? running.id : null,
        fg: order(fg).map((p) => p.id),
        bg: order(bg).map((p) => p.id),
        segs: segs.map((s) => ({ ...s })),
        rem: P.map((p) => p.rem),
        ct: P.map((p) => p.ct),
        first: P.map((p) => p.first),
        state: P.map((p) => (p.ct != null ? 'done' : p === running ? 'run' : p.at <= t ? 'ready' : 'new')),
        ...extra,
      });
    }

    function startSeg(p) {
      seg = { id: p ? p.id : null, i: p ? p.i : -1, s: t, e: t };
      segs.push(seg);
    }

    function pick() {
      if (algo === 'mlq') {
        if (slice) {
          const pref = slotAt(t) === 'fg' ? fg : bg;
          const other = pref === fg ? bg : fg;
          return pref[0] || other[0] || null;
        }
        return fg[0] || bg[0] || null;
      }
      if (!fg.length) return null;
      return cmp ? order(fg)[0] : fg[0];
    }

    function reason(p, cands) {
      switch (algo) {
        case 'fcfs':
          return `${b(p)} is at the <b>front</b> of the ready queue (it arrived first, at t = ${p.at}). FCFS runs it until it finishes: it needs <span class="eq">${p.rem}</span> units.`;
        case 'rr':
          return `${b(p)} is at the <b>front</b> of the ready queue. It may run for at most <span class="eq">q = ${q}</span> units; it still needs ${p.rem}.`;
        case 'mlq': {
          const fgName = 'foreground (RR)', bgName = 'background (FCFS)';
          if (slice) return `This is a <b>${slotAt(t) === 'fg' ? 'foreground' : 'background'}</b> time slot (80% / 20%). ${p.q === slotAt(t) ? '' : `That queue is empty, so the other queue uses the slot. `}${b(p)} is at the head of the ${p.q === 'fg' ? fgName : bgName} queue.`;
          return p.q === 'fg'
            ? `The ${fgName} queue has absolute priority. ${b(p)} is at its head and gets up to <span class="eq">q = ${q}</span> units.`
            : `The foreground queue is empty, so the ${bgName} queue may run. ${b(p)} is at its head.`;
        }
        default: {
          const list = cands.map((c) => (c === p ? `<b>${c.id} = ${val(c)}</b>` : `${c.id} = ${val(c)}`)).join(', ');
          const tie = cands.filter((c) => c !== p && val(c) === val(p));
          const what = key === 'rem' ? (algo === 'sjf' ? 'shortest burst' : 'shortest remaining time') : 'highest priority (smallest number)';
          return `Pick the ${what}: ${list}. ${b(p)} wins${tie.length ? ` (tie with ${tie.map((c) => c.id).join(', ')} broken by earlier arrival)` : ''}.` +
            (algo === 'sjf' || algo === 'prio' ? ' It is non-preemptive, so it runs to completion.' : '');
        }
      }
    }

    let guard = 0;
    while (done < n && guard++ < 100000) {
      const notes = carry;
      carry = [];

      // 1. arrivals
      const arr = P.filter((p) => p.at === t);
      arr.forEach((p) => queueOf(p).push(p));
      if (arr.length) {
        const where = (p) => (algo === 'mlq' ? ` the ${p.q === 'fg' ? 'foreground' : 'background'} queue` : ' the ready queue');
        notes.push(arr.map((p) => `${b(p)} arrives (burst ${p.bt}${key === 'pr' ? `, priority ${p.pr}` : ''}) and joins${where(p)}.`).join(' '));
      }

      // 2. preemption checks
      if (running && usesQ && (algo === 'rr' || running.q === 'fg') && qUsed >= q) {
        const own = queueOf(running);
        if (own.length || (algo === 'mlq' && slice && bg.length && slotAt(t) === 'bg')) {
          notes.push(`<b>Quantum expired.</b> ${b(running)} has run ${q} units (${running.rem} left), so the timer interrupt sends it to the <b>back</b> of the queue.`);
          own.push(running);
          running = null;
        } else {
          notes.push(`<b>Quantum expired</b>, but no other process is waiting, so ${b(running)} gets another quantum.`);
          qUsed = 0;
          startSeg(running);
        }
      }
      if (running && (algo === 'srtf' || algo === 'prio-p')) {
        const best = pick();
        if (best && val(best) < val(running)) {
          notes.push(`<b>Preemption!</b> ${b(best)} has ${KEY_LABEL[algo]} <span class="eq">${val(best)}</span> &lt; ${b(running)}'s <span class="eq">${val(running)}</span>, so ${b(running)} goes back to the ready queue.`);
          fg.push(running);
          running = null;
        }
      }
      if (running && algo === 'mlq') {
        if (!slice && running.q === 'bg' && fg.length) {
          notes.push(`<b>Preemption!</b> A foreground process is ready. Fixed priority: ${b(running)} (background) is stopped and returns to the head of the background queue.`);
          bg.unshift(running);
          running = null;
        } else if (slice && running.q !== slotAt(t) && (slotAt(t) === 'fg' ? fg : bg).length) {
          notes.push(`<b>Slot change.</b> The ${slotAt(t) === 'fg' ? 'foreground' : 'background'} queue's share of CPU time starts, so ${b(running)} is paused and returns to the head of its queue.`);
          queueOf(running).unshift(running);
          running = null;
        }
      }

      // 3. dispatch
      if (!running) {
        const cands = algo === 'mlq' ? [...fg, ...bg] : order(fg);
        const p = pick();
        if (p) {
          const ask = cands.length >= 2 ? { answer: p.id, cands: cands.map((c) => c.id), vals: key ? Object.fromEntries(cands.map((c) => [c.id, val(c)])) : null } : null;
          if (ask) {
            snap('expand', 'Decide', `t = ${t}: who runs next?`, [...notes, `${cands.length} processes are ready. Which one does the scheduler pick?`]);
            notes.length = 0;
          }
          queueOf(p).splice(queueOf(p).indexOf(p), 1);
          running = p;
          qUsed = 0;
          const firstRun = p.first == null;
          if (firstRun) p.first = t;
          startSeg(p);
          notes.push(reason(p, cands));
          if (firstRun) notes.push(`First time on the CPU: response time <span class="eq">RT = ${t} − ${p.at} = ${t - p.at}</span>.`);
          snap('select', 'Dispatch', `${p.id} gets the CPU at t = ${t}`, notes, { ask });
        }
      } else if (notes.length) {
        snap('expand', 'Event', `t = ${t}: ${running.id} keeps running`, [...notes, algo === 'srtf' || algo === 'prio-p' ? `No one beats ${b(running)}, so it is not preempted.` : `${b(running)} continues.`]);
      }

      // 4. idle until the next arrival
      if (!running) {
        const next = Math.min(...P.filter((p) => p.at > t).map((p) => p.at));
        startSeg(null);
        snap('init', 'Idle', `CPU idle until t = ${next}`, [...notes, `No process is ready, so the CPU sits idle until the next arrival at t = ${next}.`]);
        t = next;
        seg.e = t;
        continue;
      }

      // 5. run one time unit
      running.rem--;
      qUsed++;
      t++;
      seg.e = t;
      if (running.rem === 0) {
        const p = running;
        p.ct = t;
        done++;
        carry.push(`${b(p)} <b>finishes</b> at t = ${t}. <span class="eq">TAT = ${t} − ${p.at} = ${t - p.at}</span> <span class="eq">WT = ${t - p.at} − ${p.bt} = ${t - p.at - p.bt}</span>`);
        running = null;
      }
    }

    const results = P.map((p) => ({ id: p.id, i: p.i, at: p.at, bt: p.bt, pr: p.pr, ct: p.ct, tat: p.ct - p.at, wt: p.ct - p.at - p.bt, rt: p.first - p.at }));
    const avg = (f) => (n ? results.reduce((s, r) => s + r[f], 0) / n : 0);
    const busy = P.reduce((s, p) => s + p.bt, 0);
    const start = n ? Math.min(...P.map((p) => p.at)) : 0;
    const summary = { wt: avg('wt'), tat: avg('tat'), rt: avg('rt'), makespan: t, util: t ? busy / t : 0, throughput: t ? n / t : 0 };
    snap('done', 'Done', 'All processes finished', [...carry,
      `Average waiting time <span class="eq">(${results.map((r) => r.wt).join(' + ')}) / ${n} = ${ns.fmt2(summary.wt)}</span>`,
      `Average turnaround <span class="eq">${ns.fmt2(summary.tat)}</span>, average response <span class="eq">${ns.fmt2(summary.rt)}</span>.`]);
    return { steps, segs, results, summary, makespan: t, start };
  };

  ns.fmt2 = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, ''));

  /* ---------- example process sets (from the Chapter 6 slides and the additional resource) ---------- */
  ns.SCHED_PRESETS = [
    { id: 'fcfs1', name: 'Slide: P1, P2, P3 (24, 3, 3)', procs: [[0, 24], [0, 3], [0, 3]] },
    { id: 'fcfs2', name: 'Slide: order P2, P3, P1', procs: [[0, 3, 0, 'fg', 'P2'], [0, 3, 0, 'fg', 'P3'], [0, 24, 0, 'fg', 'P1']] },
    { id: 'sjf1', name: 'Slide: SJF without arrival times', procs: [[0, 6], [0, 8], [0, 7], [0, 3]] },
    { id: 'sjf2', name: 'Slide: SJF with arrival times', procs: [[0, 7], [2, 4], [4, 1], [5, 4]] },
    { id: 'sjf3', name: 'Additional resource: SJF (starts at t = 1)', procs: [[1, 7], [2, 5], [3, 1], [4, 2], [5, 8]] },
    { id: 'srtf', name: 'Slide: shortest remaining time first', procs: [[0, 8], [1, 4], [2, 9], [3, 5]] },
    { id: 'prio', name: 'Slide: priority scheduling', procs: [[0, 10, 3], [0, 1, 1], [0, 2, 4], [0, 1, 5], [0, 5, 2]] },
    { id: 'priop', name: 'Priority with arrival times', procs: [[0, 4, 3], [1, 3, 2], [2, 5, 4], [3, 2, 1], [6, 3, 2]] },
    { id: 'rr', name: 'Slide: Round Robin, q = 4', procs: [[0, 24], [0, 3], [0, 3]], q: 4 },
    { id: 'rr2', name: 'Round Robin with arrival times, q = 2', procs: [[0, 5], [1, 3], [2, 1], [3, 2], [4, 3]], q: 2 },
    { id: 'mlq', name: 'Foreground + background mix, q = 2', procs: [[0, 6, 0, 'bg'], [1, 3, 0, 'fg'], [2, 4, 0, 'fg'], [3, 3, 0, 'bg'], [9, 2, 0, 'fg']], q: 2 },
  ].map((p) => ({ ...p, procs: p.procs.map(([at, bt, pr = 0, q = 'fg', id], i) => ({ id: id || `P${i + 1}`, at, bt, pr, q })) }));

  ns.randomProcs = () => {
    const k = 4 + Math.floor(Math.random() * 2);
    return Array.from({ length: k }, (_, i) => ({
      id: `P${i + 1}`,
      at: i === 0 ? 0 : Math.floor(Math.random() * 8),
      bt: 1 + Math.floor(Math.random() * 8),
      pr: 1 + Math.floor(Math.random() * 5),
      q: Math.random() < 0.5 ? 'fg' : 'bg',
    }));
  };
})(window.AlgoSim);
