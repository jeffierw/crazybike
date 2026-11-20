// ---------------------------------------------------------------- 00b_variants: live A/B feel & visual tuning switches
const Variants = (() => {
  const V = { defs: [], val: {}, subs: [] };
  const K = n => 'cb.v.' + n;
  const fromUrl = n => {
    try {
      const m = new RegExp('[?&]v-' + n + '=([a-z0-9]+)').exec(location.search);
      return m ? m[1] : null;
    } catch (e) { return null; }
  };
  V.def = function (name, label, opts, def) {
    const has = id => opts.some(o => o[0] === id);
    if (!has(def)) def = opts[0][0];
    const old = V.defs.findIndex(d => d.name === name);
    const d = { name, label, opts, def };
    if (old >= 0) V.defs[old] = d; else V.defs.push(d);
    let v = def;
    try { const s = localStorage.getItem(K(name)); if (s && has(s)) v = s; } catch (e) {}
    const u = fromUrl(name); if (u && has(u)) v = u;
    V.val[name] = v;
    for (const f of V.subs) try { f(name, v, true); } catch (e) {}
    return v;
  };
  V.set = function (name, id) {
    const d = V.defs.find(x => x.name === name);
    if (!d || !d.opts.some(o => o[0] === id) || V.val[name] === id) return;
    V.val[name] = id;
    try { localStorage.setItem(K(name), id); } catch (e) {}
    for (const f of V.subs) try { f(name, id, false); } catch (e) {}
  };
  V.on = fn => { V.subs.push(fn); };
  return V;
})();
