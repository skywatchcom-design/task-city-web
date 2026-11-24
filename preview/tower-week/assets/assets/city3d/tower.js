// SkyTasks: the glass tower (sketch 67, owner 22.11 "מושלם") in the realistic city. One floor a day, a coloured fin
// for every neighbourhood that had a finished task that day, a glowing cube for every task; today's floor on top,
// tomorrow as an outline, a crane on the roof and the logo's window in front. Past weeks stand round it as small
// towers, open projects as annexes, the shared home as a slimmer tower. Built in the sketch's own units (a side of
// 3.4, a floor of 1.0) and scaled to the map, so the city shows exactly the tower the owner approved.
/* global THREE */
(function () {
  'use strict';
  const T = THREE;
  const TILE = 10;
  const GLOW = 0xF2C14E;
  const SIDE = 3.4, R = 0.5, H = 1.0;

  let kit = null;          // from city.js: { reflective, send }
  let group = null;        // the tower and everything round it
  let night = false;
  let model = null, spot = null, scale = 1;
  const lit = [];          // glowing cubes and windows, for the night and the end of the day
  const halos = [];
  const hits = [];         // invisible boxes, one per floor, for taps
  const floorLights = [];  // a warm light inside each built floor, on at night
  let beam = null, groundHalo = null, logo = null, hook = null, cable = null, craneTop = 0;
  let reveal = null;       // { list, i, t } while the end of the day lights the tower
  let prevCounts = {};     // floor:area -> cubes, to pop the new ones

  // ---------------- materials ----------------
  const mats = {};
  function makeMats() {
    if (mats.glass) return;
    const reg = (m) => { if (kit && kit.reflective) kit.reflective.push(m); return m; };
    const tex = (name, rep) => { if (!kit || !kit.tx) return null; const t = kit.tx(name).clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); return t; };
    mats.slab = new T.MeshStandardMaterial({ color: dim(0xD9D8D3), roughness: .78, metalness: 0 });
    mats.ceil = new T.MeshStandardMaterial({ color: lin(0xDCDAD2), roughness: .95 });
    mats.core = new T.MeshStandardMaterial({ color: dim(0x9EA3B3), roughness: .8 });
    mats.under = new T.MeshStandardMaterial({ color: lin(0x2A3045), roughness: 1 });
    mats.glass = reg(new T.MeshPhysicalMaterial({ color: lin(0x7FA6CF), roughness: .04, metalness: .1, transparent: true, opacity: .2, depthWrite: false,
      clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.0, side: T.DoubleSide }));
    mats.mullion = reg(new T.MeshStandardMaterial({ color: lin(0x1C2742), roughness: .35, metalness: .6, envMapIntensity: .8 }));
    mats.desk = new T.MeshStandardMaterial({ color: dim(0xC9B99A), roughness: .7 });
    mats.pot = new T.MeshStandardMaterial({ color: lin(0x9C8B75) });
    mats.leaf = new T.MeshStandardMaterial({ color: lin(0x5E9B6A), roughness: .9 });
    mats.stone = new T.MeshStandardMaterial({ color: dim(0xDAD6CC), roughness: .85 });
    mats.gold = new T.MeshStandardMaterial({ color: dim(0xE0A63A), roughness: .45, metalness: .2 });
    mats.wire = new T.MeshBasicMaterial({ color: lin(0x6E8FD8), wireframe: true, transparent: true, opacity: .5 });
    mats.hit = new T.MeshBasicMaterial({ visible: false });
    mats.warm = new T.MeshBasicMaterial({ color: lin(0xFFD7A0), transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false });
    mats.strip = new T.MeshStandardMaterial({ color: lin(0xFFFFFF), emissive: lin(0xFFF4DC), emissiveIntensity: .5 });
    mats.pastGlass = reg(new T.MeshStandardMaterial({ color: dim(0xBFD4EC), roughness: .12, metalness: .55, envMapIntensity: 1.2 }));
  }
  const lin = (hex) => new T.Color(hex).convertSRGBToLinear();
  const dim = (hex, k = 1) => lin(hex).multiplyScalar(k);
  const glowMat = () => new T.MeshStandardMaterial({ color: dim(0xE0A63A, .35), emissive: lin(GLOW), emissiveIntensity: .95, roughness: .4 });
  const finMat = (hex) => {
    const c = lin(hex), base = c.clone();
    return new T.MeshPhysicalMaterial({ color: base, roughness: .45, metalness: .05, emissive: c, emissiveIntensity: .12, clearcoat: .4 });
  };
  function softTex(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }
  let haloTex = null;
  function addHalo(mesh, s) {
    if (!haloTex) haloTex = softTex('rgba(255,215,120,.9)', 'rgba(255,200,90,0)');
    const sp = new T.Sprite(new T.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
    sp.scale.set(s, s, 1); mesh.add(sp); mesh.userData.halo = sp; halos.push(sp); return sp;
  }

  // ---------------- shapes ----------------
  function plan(s, r) {
    const sh = new T.Shape(); const h = s / 2;
    sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h);
    sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h); return sh;
  }
  function slabGeo(s, r, d) { const g = new T.ExtrudeGeometry(plan(s, r), { depth: d, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2, curveSegments: 10 }); g.rotateX(-Math.PI / 2); return g; }
  function bandGeo(s, r, h) { const g = new T.ExtrudeGeometry(plan(s, r), { depth: h, bevelEnabled: false, curveSegments: 10 }); g.rotateX(-Math.PI / 2); return g; }
  function mesh(geo, mat, x, y, z, g, cast = true) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; }
  function label(text, bold, today) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.font = (bold ? '700 ' : '600 ') + '30px Assistant, Rubik, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl';
    if (today) { x.fillStyle = 'rgba(242,193,78,.95)'; x.beginPath(); x.roundRect ? x.roundRect(40, 10, 176, 44, 12) : x.rect(40, 10, 176, 44); x.fill(); x.fillStyle = '#1D2B55'; }
    else { x.fillStyle = 'rgba(15,22,38,.72)'; x.beginPath(); x.roundRect ? x.roundRect(40, 10, 176, 44, 12) : x.rect(40, 10, 176, 44); x.fill(); x.fillStyle = '#fff'; }
    x.fillText(text, 128, 32);
    const t = new T.CanvasTexture(c); t.minFilter = T.LinearFilter;
    const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(2.2, .55, 1); s.renderOrder = 5; return s;
  }

  // ---------------- one floor ----------------
  function fin(g, area, y, count, f, isToday) {
    const ang = area.k / Math.max(area.of, 3) * Math.PI * 2 + Math.PI / 5;
    const fg = new T.Group();
    const finMesh = new T.Mesh(new T.BoxGeometry(.9, H - .2, .07), finMat(area.color)); finMesh.castShadow = true; fg.add(finMesh);
    const shown = Math.min(count, 6);
    for (let k = 0; k < shown; k++) {
      const cb = new T.Mesh(new T.BoxGeometry(.2, .2, .2), glowMat());
      cb.position.set((k % 3 - 1) * .22, -.22 + Math.floor(k / 3) * .3, .13); addHalo(cb, .7); fg.add(cb); lit.push(cb);
      const key = f + ':' + area.id;
      if (isToday && prevCounts[key] != null && k >= prevCounts[key]) cb.userData.pop = 1;
    }
    fg.position.set(Math.cos(ang) * 1.22, y + H / 2, Math.sin(ang) * 1.22); fg.rotation.y = -ang + Math.PI / 2; g.add(fg);
  }
  function furnish(g, y, seed) {
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * Math.PI * 2 + .5 + seed * .3, r = 1.12;
      const d = mesh(new T.BoxGeometry(.38, .05, .22), mats.desk, Math.cos(ang) * r, y + .33, Math.sin(ang) * r, g); d.rotation.y = -ang;
      const mon = mesh(new T.BoxGeometry(.16, .1, .012), mats.mullion, Math.cos(ang) * r, y + .42, Math.sin(ang) * r, g, false); mon.rotation.y = -ang;
    }
    for (let i = 0; i < 3; i++) {
      const ang = i / 3 * Math.PI * 2 + 1.6, x = Math.cos(ang) * 1.35, z = Math.sin(ang) * 1.35;
      mesh(new T.CylinderGeometry(.06, .05, .1, 8), mats.pot, x, y + .13, z, g, false);
      mesh(new T.SphereGeometry(.11, 8, 6), mats.leaf, x, y + .27, z, g, false);
    }
    const strip = new T.Mesh(new T.TorusGeometry(1.0, .015, 6, 48), mats.strip); strip.rotation.x = Math.PI / 2; strip.position.y = y + H - .12; g.add(strip);
  }
  function floor(g, f, fl, y) {
    mesh(slabGeo(SIDE + .16, R + .04, .06), mats.slab, 0, y, 0, g);
    mesh(new T.BoxGeometry(SIDE - .1, .03, SIDE - .1), mats.under, 0, y - .02, 0, g, false);
    const hit = mesh(new T.BoxGeometry(SIDE + .4, H, SIDE + .4), mats.hit, 0, y + H / 2, 0, g, false); hit.userData.floor = f; hits.push(hit);
    const band = mesh(bandGeo(SIDE, R, H - .1), mats.glass, 0, y + H - .05, 0, g, false); band.renderOrder = 2;
    mesh(new T.CylinderGeometry(.6, .6, H - .1, 28), mats.core, 0, y + H / 2, 0, g);
    mesh(new T.BoxGeometry(.3, .5, .02), mats.mullion, 0, y + .3, .61, g, false);
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) mesh(new T.BoxGeometry(.05, H - .1, .05), mats.mullion, sx * (SIDE / 2 - R * .52), y + H / 2, sz * (SIDE / 2 - R * .52), g, false);
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const off of [-.55, 0, .55]) mesh(new T.BoxGeometry(.035, H - .1, .035), mats.mullion, sx ? sx * SIDE / 2 : off, y + H / 2, sz ? sz * SIDE / 2 : off, g, false);
    mesh(bandGeo(SIDE + .03, R, .04), mats.mullion, 0, y + H / 2 + .02, 0, g, false);
    furnish(g, y, f);
    const pl = new T.Mesh(new T.CircleGeometry(1.45, 32), mats.warm); pl.rotation.x = Math.PI / 2; pl.position.y = y + H - .13; g.add(pl); floorLights.push(pl);
    fl.areas.forEach((a, k) => fin(g, { id: a.id, color: a.color, k, of: fl.areas.length }, y, a.n, f, fl.today));
    const lb = label(fl.label, fl.today, fl.today); lb.position.set(SIDE / 2 + 1.35, y + H / 2, 0); g.add(lb);
  }

  // ---------------- around the tower ----------------
  function weekTower(g, total, x, z) {
    const floors = Math.max(1, Math.min(9, Math.ceil(total / 3))), w = .2, h = .14;
    mesh(new T.BoxGeometry(w + .1, .05, w + .1), mats.stone, x, .025, z, g);
    for (let k = 0; k < floors; k++) {
      mesh(new T.BoxGeometry(w, h - .03, w), mats.pastGlass, x, .05 + k * h + h / 2, z, g);
      mesh(new T.BoxGeometry(w + .04, .03, w + .04), mats.slab, x, .05 + (k + 1) * h - .015, z, g, false);
      if (k * 3 < total) { const wl = mesh(new T.BoxGeometry(.1, .05, .02), glowMat(), x, .05 + k * h + h / 2, z + w / 2 + .01, g, false); wl.material.emissiveIntensity = .35; lit.push(wl); }
    }
  }
  function annex(g, a, x, z, top) {
    const w = .28, d = 1.0, full = top, built = Math.max(.05, full * Math.max(0, Math.min(1, a.p)));
    mesh(new T.BoxGeometry(w, built, d), finMat(a.color), x, built / 2, z, g);
    if (built < full - .05) {
      const wire = new T.Mesh(new T.BoxGeometry(w, full - built, d), mats.wire); wire.position.set(x, built + (full - built) / 2, z); g.add(wire);
    }
    const lb = label(a.name, false, false); lb.position.set(x, full + .45, z); lb.scale.set(1.8, .45, 1); g.add(lb);
  }
  function homeTower(g, floors, today, x, z) {
    const s = .55;
    for (let f = 0; f <= today && f < floors.length; f++) {
      const y = f * H;
      mesh(new T.BoxGeometry(s + .1, .07, s + .1), mats.slab, x, y + .035, z, g);
      const band = mesh(new T.BoxGeometry(s, H - .1, s), mats.glass, x, y + H / 2 + .02, z, g, false); band.renderOrder = 2;
      mesh(new T.CylinderGeometry(.09, .09, H - .1, 16), mats.core, x, y + H / 2, z, g);
      floors[f].forEach((p, k) => {
        const ang = k / Math.max(floors[f].length, 2) * Math.PI * 2 + .7;
        const fm = mesh(new T.BoxGeometry(.06, H - .25, .3), finMat(p.color), x + Math.cos(ang) * .17, y + H / 2, z + Math.sin(ang) * .17, g); fm.rotation.y = -ang;
      });
    }
    mesh(new T.BoxGeometry(s + .1, .07, s + .1), mats.slab, x, (today + 1) * H, z, g);
  }

  // ---------------- build ----------------
  function clear() {
    if (!group) return;
    group.parent && group.parent.remove(group);
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    group = null; lit.length = 0; halos.length = 0; hits.length = 0; floorLights.length = 0;
  }
  function build(parent, t, k) {
    makeMats();
    clear();
    model = t; group = new T.Group();
    const inner = new T.Group(); group.add(inner);
    const n = t.floors.length, today = t.today;
    // the plinth and its steps
    mesh(slabGeo(SIDE + .7, R + .3, .32), mats.stone, 0, 0, 0, inner);
    if (kit && kit.aoMat) { const ao = new T.Mesh(new T.PlaneGeometry(SIDE * 1.9, SIDE * 1.9), kit.aoMat); ao.rotation.x = -Math.PI / 2; ao.position.y = .012; inner.add(ao); }
    const base = .33;
    for (let f = 0; f <= today; f++) floor(inner, f, t.floors[f], base + f * H);
    const top = base + (today + 1) * H;
    // tomorrow: the next floor as an outline, with yellow posts
    if (today + 1 < n) {
      mesh(slabGeo(SIDE + .22, R + .06, .09), mats.slab, 0, top, 0, inner);
      const w = new T.Mesh(bandGeo(SIDE, R, H - .1), mats.wire); w.position.y = top + H - .05; inner.add(w);
      for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) mesh(new T.BoxGeometry(.08, H - .1, .08), mats.gold, a * (SIDE / 2 + .2), top + H / 2, b * (SIDE / 2 + .2), inner, false);
      const lb = label(t.floors[today + 1].label, false, false); lb.position.set(SIDE / 2 + 1.35, top + H / 2, 0); lb.material.opacity = .6; inner.add(lb);
    }
    // the roof slab and the crane
    const roofY = top + (today + 1 < n ? H - .02 : 0);
    mesh(slabGeo(SIDE + .22, R + .06, .1), mats.slab, 0, roofY, 0, inner);
    const mast = mesh(new T.BoxGeometry(.11, 3.4, .11), mats.gold, 1.2, roofY + 1.7, -1.2, inner);
    for (let i = 0; i < 8; i++) { const b = mesh(new T.BoxGeometry(.015, .015, .28), mats.mullion, 1.2, roofY + .3 + i * .4, -1.2, inner, false); b.rotation.y = i % 2 ? .8 : -.8; }
    mesh(new T.BoxGeometry(3.8, .1, .1), mats.gold, -.3, roofY + 3.3, -1.2, inner);
    mesh(new T.BoxGeometry(.55, .32, .32), mats.mullion, 2.0, roofY + 3.15, -1.2, inner);
    craneTop = roofY + 3.3;
    cable = mesh(new T.CylinderGeometry(.012, .012, 1, 6), mats.mullion, 0, 0, 0, inner, false);
    hook = mesh(new T.BoxGeometry(.36, .36, .36), finMat('#2FA397'), 0, 0, 0, inner);
    void mast;
    // the logo's window on the front of today's floor
    logo = mesh(new T.BoxGeometry(.6, .6, .08), glowMat(), 0, base + today * H + H / 2, SIDE / 2 + .03, inner, false); addHalo(logo, 1.2); lit.push(logo);
    // the light under the tower at night
    beam = new T.Mesh(new T.CylinderGeometry(1.4, 3.0, 3.4, 24, 1, true), new T.MeshBasicMaterial({ color: lin(GLOW), transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    beam.position.y = -1.7; inner.add(beam);
    groundHalo = new T.Mesh(new T.CircleGeometry(3.2, 32), new T.MeshBasicMaterial({ map: softTex('rgba(255,215,120,.9)', 'rgba(255,200,90,0)'), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    groundHalo.rotation.x = -Math.PI / 2; groundHalo.position.y = .34; inner.add(groundHalo);

    // past weeks: a row behind and a row in front, the latest nearest the tower's corner
    const past = (t.past || []).slice().reverse();
    const e = SIDE / 2 + .22, xs = [-1.62, -1.32, -1.02, 1.02, 1.32, 1.62];
    const spots = [...xs.map(x => [x, e]), ...xs.map(x => [x, -e])].filter(p => !(t.home && p[0] > 1 && p[1] > 0));
    past.forEach((total, i) => { if (i < spots.length) weekTower(inner, total, spots[i][0], spots[i][1]); });
    if (t.older > 0) { const lb = label('+' + t.older, true, false); lb.position.set(-1.62, 1.3, -e); lb.scale.set(1.0, .25, 1); inner.add(lb); }
    // open projects at the sides
    (t.annexes || []).slice(0, 2).forEach((a, i) => annex(inner, a, i === 0 ? -(SIDE / 2 + .25) : SIDE / 2 + .25, i === 0 ? .3 : -.3, top));
    // the shared home's tower at the front corner
    if (t.home && t.home.length) homeTower(inner, t.home, today, SIDE / 2 + .05, SIDE / 2 + .05);

    // scale the sketch to the map and stand it on the ground
    scale = k * TILE / SIDE * .72;
    group.scale.setScalar(scale);
    spot = t.at;
    group.position.set(t.at[0] * TILE, .16, t.at[1] * TILE);
    parent.add(group);

    prevCounts = {};
    t.floors.forEach((fl, f) => fl.areas.forEach(a => { prevCounts[f + ':' + a.id] = Math.min(a.n, 6); }));
    setNight(night);
    if (reveal) startReveal();
  }

  // ---------------- night, the end of the day, motion ----------------
  function setNight(on) {
    night = on;
    if (!mats.glass) return;
    mats.glass.color.copy(lin(on ? 0x2E4878 : 0x7FA6CF)); mats.glass.opacity = on ? .14 : .2;
    mats.core.emissive.copy(lin(on ? 0x5A3E12 : 0x000000)); mats.core.emissiveIntensity = on ? .9 : 0;
    mats.slab.color.copy(on ? dim(0xC9CBD6, .7) : dim(0xD9D8D3)); mats.core.color.copy(on ? dim(0xAEB2C4, .6) : dim(0x9EA3B3));
    mats.strip.emissiveIntensity = on ? 1.2 : .5;
    for (const c of lit) { c.material.emissiveIntensity = on ? 3.4 : .95; }
    for (const h of halos) h.material.opacity = on ? .85 : 0;
    if (beam) beam.material.opacity = on ? .16 : 0;
    if (groundHalo) groundHalo.material.opacity = on ? .5 : 0;
    mats.warm.opacity = on ? .85 : 0;
  }
  function startReveal() {
    const list = lit.slice().sort((a, b) => { const pa = new T.Vector3(), pb = new T.Vector3(); a.getWorldPosition(pa); b.getWorldPosition(pb); return pa.y - pb.y; });
    for (const c of list) { c.material.emissiveIntensity = 0; if (c.userData.halo) c.userData.halo.material.opacity = 0; }
    if (beam) beam.material.opacity = 0; if (groundHalo) groundHalo.material.opacity = 0;
    reveal = { list, i: 0, t: 0 };
  }
  let clock = 0;
  function tick(dt) {
    clock += dt;
    if (hook && cable) {
      hook.position.set(Math.cos(clock * .5) * 1.3 - .3, craneTop - 1.0 + Math.sin(clock * 1.1) * .3, -1.2); hook.rotation.y = clock * .6;
      const len = Math.max(.05, craneTop - hook.position.y - .18); cable.scale.y = len; cable.position.set(hook.position.x, hook.position.y + .18 + len / 2, hook.position.z);
    }
    for (const c of lit) if (c.userData.pop) { c.userData.pop = Math.max(0, c.userData.pop - dt * 1.6); c.scale.setScalar(1 + c.userData.pop * 1.6); }
    if (logo && night) logo.material.emissiveIntensity = 3.0 + Math.sin(clock * 2) * .4;
    if (reveal) {
      reveal.t += dt;
      const per = Math.max(.02, 2.2 / Math.max(1, reveal.list.length));
      while (reveal.i < reveal.list.length && reveal.t > per * reveal.i) {
        const c = reveal.list[reveal.i++]; c.material.emissiveIntensity = 3.4; c.userData.pop = .8; if (c.userData.halo) c.userData.halo.material.opacity = .85;
      }
      if (reveal.i >= reveal.list.length) { reveal = null; if (beam) beam.material.opacity = .16; if (groundHalo) groundHalo.material.opacity = .5; }
    }
  }

  // ---------------- the camera's view of it ----------------
  function view() {
    if (!spot) return null;
    const top = (.33 + (model.today + 2) * H + 3.4) * scale;
    return { tx: spot[0] * TILE, ty: top * .45, tz: spot[1] * TILE, dist: top * 1.75 + 14, pitch: 13, yaw: 28 };
  }
  function floorView(f) {
    if (!spot) return null;
    const y = (.33 + (f + .5) * H) * scale;
    return { tx: spot[0] * TILE, ty: y, tz: spot[1] * TILE, dist: SIDE * scale * 2.4 + 8, pitch: 8 };
  }
  function floorAt(raycaster) {
    if (!hits.length) return null;
    const h = raycaster.intersectObjects(hits, false)[0];
    return h ? h.object.userData.floor : null;
  }
  // everything of the tower that should stop a tap from reaching the buildings behind it
  function blocks(raycaster) { return group ? raycaster.intersectObject(group, true).filter(h => h.object.material && h.object.material.visible !== false && !h.object.isSprite)[0] || null : null; }

  window.skyTower = {
    init(k) { kit = k; },
    build(parent, t, k) { if (t) build(parent, t, k || 1); else clear(); },
    has() { return !!group; },
    setNight, tick, view, floorView, floorAt, blocks,
    light() { night = true; setNight(true); startReveal(); },
    debug() { const v = new T.Vector3(); return { lit: lit.length, first: lit.slice(0, 4).map(c => { c.getWorldPosition(v); return [v.x.toFixed(1), v.y.toFixed(1), v.z.toFixed(1), c.material.emissiveIntensity]; }), scale }; },
  };
})();
