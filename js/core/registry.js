/*
 * Algorithm registry.
 * Each algorithm file calls AlgoSim.register({ id, name, category, mount }).
 * mount(container) renders the simulation and returns an optional cleanup function.
 */
window.AlgoSim = window.AlgoSim || {};

(function (ns) {
  'use strict';

  const algorithms = [];

  ns.register = (def) => { algorithms.push(def); };
  ns.list = () => algorithms.slice();
  ns.get = (id) => algorithms.find((a) => a.id === id);

  // Small shared helpers
  ns.esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  ns.fmt = (v) => {
    if (!isFinite(v)) return '∞';
    return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1);
  };

  ns.cssVar = (el, name) => getComputedStyle(el).getPropertyValue(name).trim();
})(window.AlgoSim);
