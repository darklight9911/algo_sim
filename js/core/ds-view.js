/*
 * Animated frontier: shows the queue / stack / priority queue as boxes that slide in and out.
 *   const v = AlgoSim.DSView(host, { kind: 'queue' | 'stack' | 'pq', title });
 *   v.render(items, { op, animate })   items: [{ key, label, sub, cls }] in left-to-right order
 */
(function (ns) {
  'use strict';

  const ENDS = {
    queue: { left: ['front', 'dequeue ←'], right: ['back', '← enqueue'], hint: 'First in, first out: new nodes join at the back, the front node leaves first.' },
    stack: { left: ['bottom', ''], right: ['top', 'push ⇄ pop'], hint: 'Last in, first out: nodes are pushed on top and popped from the top.' },
    pq: { left: ['lowest', 'remove ←'], right: ['highest', ''], hint: 'Always sorted: new nodes drop into place, the lowest value leaves first.' },
  };
  const DUR = 360;

  ns.DSView = function DSView(host, opts) {
    const kind = opts.kind;
    const E = ENDS[kind];
    host.innerHTML = `
      <section class="card ds-card" title="${E.hint}">
        <div class="ds-head">
          <h3>${opts.title}</h3>
          <span class="ds-op" aria-live="polite"></span>
        </div>
        <div class="ds-track ds-${kind}">
          <div class="ds-end ds-left"><b>${E.left[0]}</b><span>${E.left[1]}</span></div>
          <div class="ds-items"><span class="ds-empty">empty</span></div>
          <div class="ds-end ds-right"><b>${E.right[0]}</b><span>${E.right[1]}</span></div>
        </div>
      </section>`;
    const box = host.querySelector('.ds-items');
    const opEl = host.querySelector('.ds-op');
    const empty = host.querySelector('.ds-empty');
    const els = new Map();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function make(it) {
      const el = document.createElement('div');
      el.className = 'ds-item';
      el.innerHTML = '<span class="l"></span><span class="s"></span>';
      return el;
    }

    return {
      render(items, { op = '', animate = true } = {}) {
        const anim = animate && !reduced;
        opEl.innerHTML = op;
        const boxRect = box.getBoundingClientRect();
        const first = new Map();
        if (anim) els.forEach((el, k) => first.set(k, el.getBoundingClientRect()));

        // Leaving items: pin them where they are, then slide out of the exit end
        const keep = new Set(items.map((it) => it.key));
        els.forEach((el, k) => {
          if (keep.has(k)) return;
          els.delete(k);
          if (!anim) { el.remove(); return; }
          const r = first.get(k);
          el.style.position = 'absolute';
          el.style.left = (r.left - boxRect.left + box.scrollLeft) + 'px';
          el.style.top = (r.top - boxRect.top) + 'px';
          el.style.transition = 'none';
          el.classList.add('is-leaving'); // absolutely positioned, so it never affects layout
          void el.offsetWidth;
          el.style.transition = `transform ${DUR}ms cubic-bezier(.4,0,.2,1), opacity ${DUR}ms`;
          el.style.transform = kind === 'stack' ? 'translate(28px, -26px)' : 'translate(-46px, 0)';
          el.style.opacity = '0';
          setTimeout(() => el.remove(), DUR + 20);
        });

        // Place items in order (reuse elements so they can glide)
        const entering = [];
        items.forEach((it) => {
          let el = els.get(it.key);
          if (!el) { el = make(it); els.set(it.key, el); if (anim) entering.push(el); }
          if (it.node) el.dataset.node = it.node;
          el.querySelector('.l').textContent = it.label;
          el.querySelector('.s').textContent = it.sub || '';
          el.className = 'ds-item ' + (it.cls || '');
          el.style.transform = ''; el.style.opacity = ''; el.style.transition = '';
          box.append(el); // re-appending in order sorts the DOM
        });
        empty.style.display = items.length ? 'none' : '';

        if (!anim) return;
        // FLIP for items that moved
        els.forEach((el, k) => {
          const a = first.get(k);
          if (!a) return;
          const b = el.getBoundingClientRect();
          const dx = a.left - b.left, dy = a.top - b.top;
          if (!dx && !dy) return;
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          void el.offsetWidth;
          el.style.transition = `transform ${DUR}ms cubic-bezier(.2,.7,.2,1)`;
          el.style.transform = '';
        });
        // Entering items: slide in from the entry end
        entering.forEach((el, n) => {
          el.style.transition = 'none';
          el.style.opacity = '0';
          el.style.transform = kind === 'pq' ? 'translateY(-30px)' : kind === 'stack' ? 'translate(28px, -26px)' : 'translateX(46px)';
          void el.offsetWidth;
          el.style.transition = `transform ${DUR}ms cubic-bezier(.2,.7,.2,1) ${n * 70}ms, opacity ${DUR}ms ${n * 70}ms`;
          el.style.transform = '';
          el.style.opacity = '1';
        });
      },
    };
  };
})(window.AlgoSim);
