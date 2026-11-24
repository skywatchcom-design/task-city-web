// The living street (stage 2 of the realistic city, sketches 20 and 42): cars and a bus on the roads, people on the
// sidewalks, more of them where tasks got done, none round a quiet neighbourhood, and "me" standing at the door
// of the next task's building and walking to the next one. Everything here moves, so nothing is merged.
/* global THREE */
(function () {
  'use strict';
  const T = THREE;
  const TILE = 10;
  const api = window.skyParts; // helpers shared with city.js
  const LANE = 1.25, WALK = 4.2;

  let live = null, roads = [], crossings = [], cars = [], walkers = [], me = null, state = null, night = false;
  let light = 0, lightT = 0; // 0: the roads along i may drive, 1: those along j
  const meTap = [];

  function roadLen(r) { return (r.to - r.from) * TILE; }
  // A point on a road at distance t from its start, laterally off its centre line by k (the lane or the sidewalk).
  function at(r, t, k) {
    if (r.alongI) return [r.from * TILE + t, (r.at + 0.5) * TILE + k];
    return [(r.at + 0.5) * TILE + k, r.from * TILE + t];
  }
  function heading(r, dir) { return r.alongI ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI); }

  function build(s, group, mats, parts) {
    state = s; live = group; night = !!s.night; cars = []; walkers = []; meTap.length = 0;
    roads = s.roads.slice();
    if (s.rows > s.baseRows) roads.push({ alongI: true, at: s.quarterRoad, from: 0, to: s.cols }, ...(s.quarterLinks || []));
    // Where roads cross: cars stop there on red.
    crossings = [];
    for (const a of roads) for (const b of roads) {
      if (!a.alongI || b.alongI) continue;
      const x = (b.at + 0.5) * TILE, z = (a.at + 0.5) * TILE;
      if (x > a.from * TILE && x < a.to * TILE && z > b.from * TILE && z < b.to * TILE) crossings.push([x, z]);
    }
    const life = s.districts.reduce((n, d) => n + (d.neglected ? 0 : (d.life || 0)), 0);
    const quiet = s.districts.filter(d => d.neglected).map(d => d.zone);
    const colors = [0xC94F3F, 0xE9E4D8, 0x2E5B8F, 0x3B3F47, 0xE0A63A, 0x6B7280, 0xF4F4EE];
    const nCars = Math.min(10, 3 + Math.floor(life / 4)) + (roads.length > 2 ? 1 : 0);
    for (let k = 0; k < nCars; k++) {
      const r = roads[k % roads.length], dir = k % 2 ? 1 : -1;
      const c = parts.car(group, colors[k % colors.length], 0, 0, 0);
      cars.push({ g: c, r, dir, k: LANE * dir * (r.alongI ? -1 : 1), t: Math.random() * roadLen(r), v: 3.4 + Math.random() * 1.6, hl: c.userData.hl });
    }
    { const r = roads[0]; const b = parts.bus(group); cars.push({ g: b, r, dir: 1, k: -LANE * (r.alongI ? -1 : 1), t: roadLen(r) * 0.3, v: 2.8, bus: true, hl: b.userData.hl }); }
    // People: a base crowd on every road, and more beside the neighbourhoods that got things done.
    const shirts = [0xC94F3F, 0x1D2B55, 0x5C9A48, 0xE0A63A, 0xF4F4EE, 0x7A4B2E];
    const addWalker = (r, range) => { const dir = Math.random() < 0.5 ? 1 : -1; const side = Math.random() < 0.5 ? 1 : -1; const p = parts.person(group, 0, 0, shirts[walkers.length % shirts.length]); walkers.push({ g: p, r, dir, k: WALK * side, t: range ? range[0] + Math.random() * (range[1] - range[0]) : Math.random() * roadLen(r), v: 0.7 + Math.random() * 0.5, range }); };
    for (const r of roads) { const n = Math.max(1, Math.round(roadLen(r) / 40)); for (let k = 0; k < n; k++) addWalker(r); }
    for (const d of s.districts) {
      if (d.neglected || d.park || !(d.life > 0)) continue;
      const z = d.zone; const cx = (z.i + z.wi / 2) * TILE, cz = (z.j + z.wj / 2) * TILE;
      let best = null, bd = 1e9;
      for (const r of roads) { const rc = r.alongI ? Math.abs(cz - (r.at + 0.5) * TILE) : Math.abs(cx - (r.at + 0.5) * TILE); if (rc < bd) { bd = rc; best = r; } }
      if (!best) continue;
      const lo = best.alongI ? z.i * TILE - best.from * TILE : z.j * TILE - best.from * TILE, hi = lo + (best.alongI ? z.wi : z.wj) * TILE;
      for (let k = 0; k < Math.min(4, Math.ceil(d.life / 2)); k++) addWalker(best, [Math.max(0, lo), Math.min(roadLen(best), hi)]);
    }
    // A quiet neighbourhood keeps the sidewalk beside it empty: walkers turn back at its edge.
    for (const w of walkers) w.avoid = quiet;
    buildMe(s, group, mats, parts);
    for (const c of cars) place(c); for (const w of walkers) place(w);
  }

  function blocked(w, x, z) { return (w.avoid || []).some(q => x > q.i * TILE - 1 && x < (q.i + q.wi) * TILE + 1 && z > q.j * TILE - 1 && z < (q.j + q.wj) * TILE + 1); }
  function place(e) { if (!e.g) { console.error('street: no body', JSON.stringify({ r: e.r, t: e.t, k: e.k, bus: !!e.bus, keys: Object.keys(e) })); return; } const [x, z] = at(e.r, e.t, e.k); e.g.position.set(x, 0.16, z); e.g.rotation.y = heading(e.r, e.dir); }

  function tickCars(dt) {
    lightT += dt; if (lightT > 8) { lightT = 0; light = 1 - light; }
    for (const c of cars) {
      const [x, z] = at(c.r, c.t, c.k);
      // Stop short of a crossing when our axis has red (cars along i go on light 0).
      let stop = false;
      const mine = c.r.alongI ? 0 : 1;
      if (mine !== light) for (const [cx, cz] of crossings) { const ahead = c.r.alongI ? (cx - x) * c.dir : (cz - z) * c.dir; if (ahead > 2.5 && ahead < 6.5) stop = true; }
      // Keep a gap from the car ahead on the same lane.
      for (const o of cars) { if (o === c || o.r !== c.r || o.k !== c.k) continue; const gap = (o.t - c.t) * c.dir; if (gap > 0 && gap < 3.2) stop = true; }
      if (!stop) c.t += c.v * dt * c.dir;
      const L = roadLen(c.r);
      if (c.t > L + 2 || c.t < -2) { const r = roads[Math.floor(Math.random() * roads.length)]; c.r = r; c.k = LANE * c.dir * (r.alongI ? -1 : 1); c.t = c.dir > 0 ? -1 : roadLen(r) + 1; }
      place(c);
      c.g.position.y = 0.16 + (c.bus ? 0 : Math.sin(c.t * 7) * 0.01);
    }
  }
  function tickWalkers(dt) {
    for (const w of walkers) {
      const nt = w.t + w.v * dt * w.dir;
      const [x, z] = at(w.r, nt, w.k);
      const lo = w.range ? w.range[0] : 0, hi = w.range ? w.range[1] : roadLen(w.r);
      if (nt < lo || nt > hi || blocked(w, x, z)) { w.dir = -w.dir; w.pause = 0.6; }
      else if (w.pause > 0) w.pause -= dt;
      else w.t = nt;
      place(w);
      w.g.children[2] && (w.g.children[2].position.y = 1.1 + Math.sin(w.t * 6) * 0.03);
    }
  }

  // ---------------- "me": at the door of the next task's building, walking between them ----------------
  function doorOf(s, district) {
    const d = s.districts.find(d => d.id === district) || s.districts.find(d => d.id === 'home') || s.districts[0];
    if (!d) return null;
    const b = d.buildings.find(b => b.landmark) || d.buildings[0];
    if (!b) return null;
    const lw = (b.kind === 'school' || b.kind === 'supermarket') ? 2 : 1;
    const cx = (b.i + lw / 2) * TILE, cz = (b.j + 0.5) * TILE;
    const yaw = api.front(cx, cz, roads);
    const off = TILE / 2 + 1.2; // a step out of the front edge, whichever way the building faces
    return { x: cx + Math.sin(yaw) * off, z: cz + Math.cos(yaw) * off, yaw, tile: [b.i, b.j], district: d.id };
  }
  function isRoad(i, j) { return roads.some(r => r.alongI ? (j === r.at && i >= r.from && i < r.to) : (i === r.at && j >= r.from && j < r.to)); }
  function nearestRoadTile(i, j) {
    let best = null, bd = 1e9;
    for (let a = 0; a < state.cols; a++) for (let b = 0; b < state.rows; b++) { if (!isRoad(a, b)) continue; const d = Math.abs(a - i) + Math.abs(b - j); if (d < bd) { bd = d; best = [a, b]; } }
    return best;
  }
  function route(from, to) {
    // Breadth-first over road tiles, then the walk is kept to the sidewalk nearest the destination.
    const a = nearestRoadTile(from[0], from[1]), b = nearestRoadTile(to[0], to[1]); if (!a || !b) return [];
    const key = (p) => p[0] + ',' + p[1]; const prev = new Map([[key(a), null]]); const q = [a];
    while (q.length) { const p = q.shift(); if (p[0] === b[0] && p[1] === b[1]) break; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = [p[0] + dx, p[1] + dz]; if (n[0] < 0 || n[1] < 0 || n[0] >= state.cols || n[1] >= state.rows || !isRoad(n[0], n[1]) || prev.has(key(n))) continue; prev.set(key(n), p); q.push(n); } }
    if (!prev.has(key(b))) return [];
    const tiles = []; for (let p = b; p; p = prev.get(key(p))) tiles.unshift(p);
    return tiles.map(([i, j]) => [(i + 0.5) * TILE, (j + 0.5) * TILE]);
  }
  function buildMe(s, group, mats, parts) {
    const g = new T.Group();
    parts.cyl(0.13, 0.15, 0.46, mats.pants, 0, 0, 0, g, 8); parts.cyl(0.18, 0.21, 0.52, mats.blue, 0, 0.46, 0, g, 10);
    const h = new T.Mesh(new T.SphereGeometry(0.18, 12, 10), mats.skin); h.position.y = 1.16; h.castShadow = true; g.add(h);
    const cap = parts.cyl(0.2, 0.2, 0.1, mats.sunY, 0, 1.22, 0, g, 12); parts.box(0.22, 0.03, 0.2, mats.sunY, 0, 1.24, 0.2, g);
    g.traverse(o => { if (o.isMesh) { o.userData.me = true; meTap.push(o); } });
    group.add(g);
    const door = doorOf(s, (s.me && s.me.district) || 'home');
    me = { g, path: [], district: door ? door.district : null, visible: true, bob: 0 };
    if (door) { g.position.set(door.x, 0.16, door.z); g.rotation.y = door.yaw + Math.PI; me.tile = door.tile; }
    g.visible = !(s.me && s.me.hidden);
  }
  function sendMe(district) {
    if (!me || !state) return; const door = doorOf(state, district || 'home'); if (!door) return;
    if (door.district === me.district && !me.path.length) return;
    const pts = route(me.tile || door.tile, door.tile); pts.push([door.x, door.z]);
    me.path = pts; me.district = door.district; me.tile = door.tile; me.endYaw = door.yaw + Math.PI;
  }
  function tickMe(dt) {
    if (!me) return;
    if (me.path.length) {
      const [tx, tz] = me.path[0]; const dx = tx - me.g.position.x, dz = tz - me.g.position.z; const d = Math.hypot(dx, dz), step = 2.2 * dt;
      if (d <= step) { me.g.position.set(tx, 0.16, tz); me.path.shift(); if (!me.path.length) me.g.rotation.y = me.endYaw; }
      else { me.g.position.x += dx / d * step; me.g.position.z += dz / d * step; me.g.rotation.y = Math.atan2(dx, dz); }
      me.bob += dt * 9; me.g.position.y = 0.16 + Math.abs(Math.sin(me.bob)) * 0.05;
    } else { me.bob += dt * 2; me.g.position.y = 0.16 + Math.sin(me.bob) * 0.01; }
  }

  function setNight(on) { night = on; for (const c of cars) if (c.hl) { c.hl.emissive.set(on ? 0xFFF4D6 : 0x000000); c.hl.emissiveIntensity = on ? 1.6 : 0; } }
  function tick(dt) { if (!live) return; tickCars(dt); tickWalkers(dt); tickMe(dt); }

  window.skyStreet = { build, tick, setNight, sendMe, get meTap() { return meTap; }, debug() { return { cars, walkers, me }; }, update(s) { if (me && s.me) { sendMe(s.me.district || 'home'); me.g.visible = !s.me.hidden; } } };
})();
