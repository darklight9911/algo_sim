/*
 * Step player: shared playback controls for any simulation that can be
 * expressed as a list of precomputed steps.
 *   const p = new AlgoSim.Player(host, { onRender: (i) => {...}, speed: 4 });
 *   p.load(stepCount);
 */
(function (ns) {
  'use strict';

  const ICON = {
    first: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14M18 6l-8 6 8 6V6z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    last: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 5v14M6 6l8 6-8 6V6z"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
    replay: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  };

  // Delay between steps for speed 1..10
  const DELAYS = [1600, 1150, 800, 560, 380, 240, 140, 70, 30, 8];

  class Player {
    constructor(host, opts) {
      this.onRender = opts.onRender;
      this.speed = opts.speed || 4;
      this.total = 1;
      this.index = 0;
      this.playing = false;
      this.timer = null;

      host.innerHTML = `
        <div class="player card">
          <div class="player-buttons">
            <button class="icon-btn" data-act="first" title="Reset (Home)" aria-label="Reset">${ICON.first}</button>
            <button class="icon-btn" data-act="prev" title="Previous step (←)" aria-label="Previous step">${ICON.prev}</button>
            <button class="play-btn" data-act="toggle" title="Play / pause (Space)" aria-label="Play">${ICON.play}</button>
            <button class="icon-btn" data-act="next" title="Next step (→)" aria-label="Next step">${ICON.next}</button>
            <button class="icon-btn" data-act="last" title="Jump to end (End)" aria-label="Jump to end">${ICON.last}</button>
          </div>
          <div class="player-track">
            <input class="range scrub" type="range" min="0" max="0" value="0" aria-label="Step">
            <span class="step-count mono"><b>1</b> / 1</span>
          </div>
          <label class="player-speed" title="Playback speed">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 14l4-5"/><path d="M3.5 18a9 9 0 1 1 17 0"/></svg>
            <input class="range speed" type="range" min="1" max="10" value="${this.speed}" aria-label="Speed">
          </label>
        </div>`;

      this.el = host.firstElementChild;
      this.btnToggle = this.el.querySelector('[data-act="toggle"]');
      this.scrub = this.el.querySelector('.scrub');
      this.count = this.el.querySelector('.step-count');
      this.speedInput = this.el.querySelector('.speed');

      this.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const act = b.dataset.act;
        if (act === 'toggle') this.toggle();
        else { this.pause(); if (act === 'first') this.go(0); if (act === 'prev') this.go(this.index - 1); if (act === 'next') this.go(this.index + 1); if (act === 'last') this.go(this.total - 1); }
      });
      this.scrub.addEventListener('input', () => { this.pause(); this.go(+this.scrub.value); });
      this.speedInput.addEventListener('input', () => { this.speed = +this.speedInput.value; });

      this._onKey = (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key === ' ') { e.preventDefault(); this.toggle(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); this.pause(); this.go(this.index + 1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.pause(); this.go(this.index - 1); }
        else if (e.key === 'Home') { e.preventDefault(); this.pause(); this.go(0); }
        else if (e.key === 'End') { e.preventDefault(); this.pause(); this.go(this.total - 1); }
      };
      document.addEventListener('keydown', this._onKey);
    }

    get atEnd() { return this.index >= this.total - 1; }

    load(total, index = 0) {
      this.total = Math.max(1, total);
      this.scrub.max = String(this.total - 1);
      this.go(index);
    }

    go(i) {
      i = Math.max(0, Math.min(this.total - 1, i | 0));
      this.index = i;
      this.scrub.value = String(i);
      const pct = this.total > 1 ? (i / (this.total - 1)) * 100 : 0;
      this.scrub.style.setProperty('--fill', pct + '%');
      this.count.innerHTML = `<b>${i + 1}</b> / ${this.total}`;
      this._syncButton();
      this.onRender(i);
    }

    play() {
      if (this.playing) return;
      if (this.atEnd) this.go(0);
      this.playing = true;
      this._syncButton();
      const tick = () => {
        if (!this.playing) return;
        if (this.atEnd) { this.pause(); return; }
        this.go(this.index + 1);
        if (this.atEnd) { this.pause(); return; }
        this.timer = setTimeout(tick, DELAYS[this.speed - 1]);
      };
      this.timer = setTimeout(tick, Math.min(250, DELAYS[this.speed - 1]));
    }

    pause() {
      this.playing = false;
      clearTimeout(this.timer);
      this._syncButton();
    }

    toggle() { this.playing ? this.pause() : this.play(); }

    _syncButton() {
      const icon = this.playing ? ICON.pause : (this.atEnd && this.total > 1 ? ICON.replay : ICON.play);
      if (this.btnToggle.dataset.icon !== icon) { this.btnToggle.innerHTML = icon; this.btnToggle.dataset.icon = icon; }
      this.btnToggle.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
      this.btnToggle.classList.toggle('is-playing', this.playing);
    }

    destroy() {
      this.pause();
      document.removeEventListener('keydown', this._onKey);
    }
  }

  ns.Player = Player;
})(window.AlgoSim);
