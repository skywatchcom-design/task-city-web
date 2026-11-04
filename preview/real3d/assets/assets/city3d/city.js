// SkyTasks: the realistic city, drawn live with three.js (sketches 42 and 43). Flutter sends the city as JSON
// (see lib/city3d/city3d_state.dart) and gets taps back; this file only renders. One tile of the map is 10 units.
/* global THREE */
(function () {
  'use strict';
  const T = THREE;
  const TILE = 10;

  // ---------------- bridge ----------------
  function send(msg) {
    try {
      if (window.Sky && window.Sky.postMessage) window.Sky.postMessage(JSON.stringify(msg));
      else if (window.parent && window.parent !== window) window.parent.postMessage(msg, '*');
    } catch (e) { /* no host */ }
  }

  // ---------------- renderer, lights, sky ----------------
  const canvas = document.getElementById('c');
  const R = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  R.shadowMap.enabled = true;
  R.shadowMap.type = T.PCFSoftShadowMap;
  R.outputEncoding = T.sRGBEncoding;
  R.toneMapping = T.ACESFilmicToneMapping;
  R.toneMappingExposure = 0.98;
  const scene = new T.Scene();
  const DAY = { sun: [0xFFF3E0, 3.1], hemi: [0xA9C8EE, 0x55683A, 0.55] };
  const NIGHT = { sun: [0x6F86B8, 0.28], hemi: [0x1B2A4A, 0x0B0F1A, 0.45] };
  const hemi = new T.HemisphereLight(DAY.hemi[0], DAY.hemi[1], DAY.hemi[2]);
  scene.add(hemi);
  const sun = new T.DirectionalLight(DAY.sun[0], DAY.sun[1]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 1.6;
  scene.add(sun);
  scene.add(sun.target);
  function skyTex(top, mid, bot) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, top); gr.addColorStop(0.5, mid); gr.addColorStop(0.62, bot); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    const t = new T.CanvasTexture(c); t.mapping = T.EquirectangularReflectionMapping; t.encoding = T.sRGBEncoding; return t;
  }
  const skyDay = skyTex('#3F86D1', '#BFD9F0', '#9FB08C'), skyNight = skyTex('#060A14', '#121B33', '#1A2238');
  const pmrem = new T.PMREMGenerator(R); const envOf = {};
  const reflective = [];

  // ---------------- materials ----------------
  const loader = new T.TextureLoader();
  const texCache = {};
  function tx(name) {
    if (texCache[name]) return texCache[name];
    const t = loader.load((window.SKY_TEX && window.SKY_TEX[name]) || ('tex/' + name + '.jpg'));
    t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    texCache[name] = t; return t;
  }
  function tm(name, opts = {}) {
    const m = new T.MeshStandardMaterial(Object.assign({ map: tx(name), roughness: .92, metalness: 0 }, opts));
    if (opts.bump !== false) { m.bumpMap = tx(name); m.bumpScale = opts.bumpScale == null ? 0.025 : opts.bumpScale; }
    return m;
  }
  const M = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: .85, metalness: 0 }, o));
  const Mr = (o) => { const m = new T.MeshStandardMaterial(o); reflective.push(m); return m; };
  const mats = {
    tile: tm('clay_roof_tiles', { bumpScale: .05 }), greyTile: tm('grey_roof_tiles', { bumpScale: .05 }),
    beige: tm('beige_wall_001', { bumpScale: .01 }), plaster: tm('grey_plaster'), brick: tm('brick_wall_005', { bumpScale: .04 }),
    concrete: tm('concrete_wall_008'), paving: tm('concrete_floor_02'), brickPave: tm('brick_pavement_02', { bumpScale: .03 }),
    asphalt: tm('asphalt_02', { bumpScale: .03, roughness: .95 }),
    grass: tm('grass_ground', { roughness: 1, bumpScale: .03, color: 0x9ED07A }), bark: tm('bark_brown_01', { bumpScale: .04 }),
    white: M({ color: 0xF4F2EC, roughness: .6 }), cream: M({ color: 0xEFE8DA, roughness: .7 }), frame: M({ color: 0xF6F4EE, roughness: .55 }),
    dark: M({ color: 0x2A2E36, roughness: .7 }), wood: M({ color: 0x7A4B2E, roughness: .6 }), doorBlue: M({ color: 0x2F4F75, roughness: .45 }),
    stone: M({ color: 0xD6D0C4, roughness: .8 }), gold: Mr({ color: 0xC9A227, roughness: .3, metalness: .85 }),
    glassDark: Mr({ color: 0x3C5570, roughness: .08, metalness: .9, envMapIntensity: 1.2 }),
    glassLit: Mr({ color: 0x3C5570, roughness: .08, metalness: .9, envMapIntensity: 1.2, emissive: 0x000000 }),
    tower: Mr({ color: 0x9DBBD0, roughness: .1, metalness: .85 }), water: Mr({ color: 0x5FB0DD, roughness: .03, metalness: .6, envMapIntensity: 1.3 }),
    leaf: [M({ color: 0x4A7E35, roughness: 1 }), M({ color: 0x5B9440, roughness: 1 }), M({ color: 0x376B2C, roughness: 1 })],
    hedge: M({ color: 0x376B2E, roughness: 1 }), red: M({ color: 0xC94F3F, roughness: .5 }), blue: M({ color: 0x1D2B55, roughness: .5 }),
    sunY: M({ color: 0xE0A63A, roughness: .5 }), sand: M({ color: 0xE2CFA3, roughness: 1 }), rubber: M({ color: 0xD2704E, roughness: .95 }),
    metal: Mr({ color: 0xB9BDC4, roughness: .35, metalness: .7 }), pole: M({ color: 0x4A4D55, roughness: .5 }),
    lamp: M({ color: 0xD8D8D0, emissive: 0x000000 }), skin: M({ color: 0xE8B894, roughness: .7 }), pants: M({ color: 0x2A2F3A }),
    cross: M({ color: 0xD23B2E, emissive: 0x000000 }), curb: M({ color: 0xB8B3A8, roughness: .9 }), lane: M({ color: 0xE0A63A, roughness: .6 }),
    crane: M({ color: 0xE0A63A, roughness: .6 }), fence: M({ color: 0x8A8E96, roughness: .7 }), slab: M({ color: 0xB9B6AE, roughness: .95 }),
  };
  const nightOn = []; // point lights and emissive materials switched by the night

  // ---------------- geometry helpers ----------------
  function uvScale(geo, w, h, d, s) {
    const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) { const [a, b] = dims[f]; for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * a / s, uv.getY(k) * b / s); } }
    uv.needsUpdate = true; return geo;
  }
  function box(w, h, d, m, x, y, z, g, s = 2) {
    const geo = new T.BoxGeometry(w, h, d); if (m.map) uvScale(geo, w, h, d, s);
    const b = new T.Mesh(geo, m); b.position.set(x, y + h / 2, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b;
  }
  function cyl(rt, rb, h, m, x, y, z, g, seg = 18) {
    const c = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y + h / 2, z); c.castShadow = true; c.receiveShadow = true; g.add(c); return c;
  }
  function plane(w, d, m, x, y, z, g, s = 2) {
    const geo = new T.PlaneGeometry(w, d);
    if (m.map) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * d / s); }
    const p = new T.Mesh(geo, m); p.rotation.x = -Math.PI / 2; p.position.set(x, y, z); p.receiveShadow = true; g.add(p); return p;
  }
  const aoTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 22, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c);
  })();
  function contact(w, d, x, z, g, y = 0.165, k = 1.25) {
    const m = new T.Mesh(new T.PlaneGeometry(w * k, d * k), new T.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 1; g.add(m);
  }
  let litSeed = 1;
  function litRand() { litSeed = (litSeed * 9301 + 49297) % 233280; return litSeed / 233280; }
  function win(g, face, cx, y, cz, ww = 0.9, wh = 1.1, lit = true) {
    const n = { '+z': [0, 0, 1], '-z': [0, 0, -1], '+x': [1, 0, 0], '-x': [-1, 0, 0] }[face], rot = (face === '+x' || face === '-x') ? Math.PI / 2 : 0;
    const add = (geo, m, off, dy = 0, cast = false) => { const e = new T.Mesh(geo, m); e.position.set(cx + n[0] * off, y + dy, cz + n[2] * off); e.rotation.y = rot; e.castShadow = cast; e.receiveShadow = true; g.add(e); return e; };
    add(new T.BoxGeometry(ww + 0.06, wh + 0.06, 0.3), mats.dark, -0.1);
    add(new T.BoxGeometry(ww + 0.18, wh + 0.18, 0.07), mats.frame, 0.02);
    add(new T.BoxGeometry(ww, wh, 0.05), (lit && litRand() < 0.6) ? mats.glassLit : mats.glassDark, 0.06);
    add(new T.BoxGeometry(0.05, wh, 0.05), mats.frame, 0.1); add(new T.BoxGeometry(ww, 0.05, 0.05), mats.frame, 0.1, wh * 0.15);
    add(new T.BoxGeometry(ww + 0.34, 0.09, 0.24), mats.frame, 0.1, -wh / 2 - 0.045, true);
  }
  function winRow(g, face, x0, x1, y, cz, n, ww, wh) {
    const pitch = (x1 - x0) / n;
    for (let i = 0; i < n; i++) { const t = x0 + pitch * i + pitch / 2; if (face === '+z' || face === '-z') win(g, face, t, y, cz, ww, wh); else win(g, face, cz, y, t, ww, wh); }
  }
  function door(g, x, z, w = 1.2, h = 2.2, m = mats.wood, face = '+z') {
    const rot = face === '+x' ? Math.PI / 2 : 0, n = face === '+x' ? [1, 0] : [0, 1];
    const e = (geo, mm, off, dy, dx = 0) => { const o = new T.Mesh(geo, mm); o.position.set(x + n[0] * off + (rot ? 0 : dx), dy, z + n[1] * off + (rot ? dx : 0)); o.rotation.y = rot; o.castShadow = true; o.receiveShadow = true; g.add(o); };
    e(new T.BoxGeometry(w + 0.24, h + 0.12, 0.12), mats.frame, 0.02, h / 2 + 0.06); e(new T.BoxGeometry(w, h, 0.08), m, 0.04, h / 2); e(new T.SphereGeometry(0.05, 8, 6), mats.gold, 0.1, h * 0.45, w * 0.35);
  }
  function steps(g, x, z, w, n = 3, rise = 0.16, run = 0.38, m = mats.stone) { for (let i = 0; i < n; i++) box(w - i * 0.3, rise, run * (n - i), m, x, i * rise, z + run * (n - i) / 2, g); }
  function gable(g, w, d, h, o, x, y, z, wallMat, roofMat = mats.tile) {
    const W = w / 2 + o, D = d / 2 + o, L = Math.hypot(D, h); const v = [], uv = [];
    const q = (a, b, c, ua, ub, uc) => { v.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); };
    q([-W, 0, D], [W, 0, D], [W, h, 0], [0, 0], [W, 0], [W, L]); q([-W, 0, D], [W, h, 0], [-W, h, 0], [0, 0], [W, L], [0, L]);
    q([W, 0, -D], [-W, 0, -D], [-W, h, 0], [0, 0], [W, 0], [W, L]); q([W, 0, -D], [-W, h, 0], [W, h, 0], [0, 0], [W, L], [0, L]);
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv.map(u => u / 2), 2)); geo.computeVertexNormals();
    const r = new T.Mesh(geo, roofMat); r.position.set(x, y, z); r.castShadow = true; r.receiveShadow = true; g.add(r);
    const gv = [w / 2, 0, -d / 2, w / 2, 0, d / 2, w / 2, h, 0, -w / 2, 0, d / 2, -w / 2, 0, -d / 2, -w / 2, h, 0];
    const gg = new T.BufferGeometry(); gg.setAttribute('position', new T.Float32BufferAttribute(gv, 3)); gg.setAttribute('uv', new T.Float32BufferAttribute([0, 0, d / 2, 0, d / 4, h / 2, 0, 0, d / 2, 0, d / 4, h / 2], 2)); gg.computeVertexNormals();
    const gm = new T.Mesh(gg, wallMat); gm.position.set(x, y, z); gm.castShadow = true; gm.receiveShadow = true; g.add(gm);
    box(w + 2 * o + 0.1, 0.16, 0.22, mats.dark, x, y + h - 0.06, z, g);
    for (const s of [1, -1]) { const gut = cyl(0.06, 0.06, w + 2 * o, mats.metal, x, y - 0.05, z + s * D, g, 8); gut.rotation.z = Math.PI / 2; cyl(0.04, 0.04, y, mats.metal, x + w / 2 - 0.1, 0, z + s * (d / 2 + 0.05), g, 8); }
  }
  function flat(g, w, d, x, y, z, m = mats.concrete) { box(w + 0.3, 0.3, d + 0.3, m, x, y, z, g); box(w + 0.3, 0.08, d + 0.3, mats.dark, x, y + 0.3, z, g); }
  function tree(g, x, z, s = 1, kind = 'oak') {
    const t = new T.Group(); t.position.set(x, 0.16, z); t.scale.setScalar(s); cyl(0.13, 0.22, 1.4, mats.bark, 0, 0, 0, t, 10); contact(2.4, 2.4, x, z, g, 0.168, s);
    if (kind === 'cypress') { const c = new T.Mesh(new T.ConeGeometry(0.55, 3.4, 10), mats.leaf[2]); c.position.y = 2.7; c.castShadow = true; c.receiveShadow = true; t.add(c); }
    else for (const [dx, dy, dz, r, i] of [[-0.45, 1.75, 0.1, 0.85, 0], [0.45, 1.8, -0.15, 0.9, 1], [0.05, 2.4, 0.1, 1.0, 2], [0, 1.65, 0.5, 0.7, 0], [-0.2, 1.55, -0.55, 0.65, 1], [0.55, 2.25, 0.45, 0.6, 2], [-0.6, 2.3, -0.3, 0.62, 0]]) { const m = new T.Mesh(new T.SphereGeometry(r, 12, 10), mats.leaf[i]); m.position.set(dx, dy, dz); m.castShadow = true; m.receiveShadow = true; t.add(m); }
    g.add(t);
  }
  function lampPost(g, x, z) {
    cyl(0.05, 0.08, 3.4, mats.pole, x, 0.16, z, g, 8); box(0.9, 0.06, 0.06, mats.pole, x + 0.4, 3.47, z, g);
    const h = new T.Mesh(new T.SphereGeometry(0.2, 12, 10), mats.lamp); h.position.set(x + 0.8, 3.42, z); g.add(h);
    const l = new T.PointLight(0xFFD9A0, 0, 11, 2); l.position.set(x + 0.8, 3.2, z); g.add(l); nightOn.push(l);
  }
  function bench(g, x, z, rot = 0) { const b = new T.Group(); b.position.set(x, 0.16, z); b.rotation.y = rot; box(1.6, 0.08, 0.5, mats.wood, 0, 0.45, 0, b); box(1.6, 0.4, 0.08, mats.wood, 0, 0.55, -0.25, b); box(0.08, 0.45, 0.5, mats.pole, -0.7, 0, 0, b); box(0.08, 0.45, 0.5, mats.pole, 0.7, 0, 0, b); g.add(b); }
  function hedge(g, x, z, w, d) { box(w, 0.7, d, mats.hedge, x, 0.16, z, g); }
  function car(g, col, x, z, rot) {
    const c = new T.Group(); c.position.set(x, 0.16, z); c.rotation.y = rot; const body = Mr({ color: col, roughness: .25, metalness: .45 });
    box(1.9, 0.5, 0.95, body, 0, 0.3, 0, c); box(1.05, 0.42, 0.85, mats.glassDark, -0.05, 0.8, 0, c); box(1.7, 0.06, 0.9, mats.dark, 0, 0.27, 0, c); box(0.12, 0.22, 0.98, mats.dark, 0.95, 0.32, 0, c); box(0.12, 0.22, 0.98, mats.dark, -0.95, 0.32, 0, c);
    for (const [dx, dz] of [[-0.6, 0.45], [0.6, 0.45], [-0.6, -0.45], [0.6, -0.45]]) { const w = cyl(0.22, 0.22, 0.16, mats.dark, dx, 0, dz, c, 14); w.rotation.x = Math.PI / 2; w.position.y = 0.22; }
    g.add(c); return c;
  }
  function person(g, x, z, shirt, rot = 0) { const p = new T.Group(); p.position.set(x, 0.16, z); p.rotation.y = rot; cyl(0.12, 0.14, 0.42, mats.pants, 0, 0, 0, p, 8); cyl(0.17, 0.2, 0.5, M({ color: shirt }), 0, 0.42, 0, p, 10); const h = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), mats.skin); h.position.y = 1.1; h.castShadow = true; p.add(h); g.add(p); }
  function signBoard(g, text, x, y, z, w = 2.4, h = 0.6, bg = 0x1D2B55, fg = '#ffffff', rot = 0) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const q = c.getContext('2d');
    q.fillStyle = '#' + bg.toString(16).padStart(6, '0'); q.fillRect(0, 0, 512, 128); q.fillStyle = fg; q.font = 'bold 64px Assistant, Rubik, Arial, sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.direction = 'rtl'; q.fillText(text, 256, 68);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
    const m = new T.MeshStandardMaterial({ map: t, roughness: .5, emissive: 0x000000, emissiveMap: t });
    const b = box(w, h, 0.08, m, x, y, z, g); b.rotation.y = rot; nightOn.push(m); return b;
  }

  // ---------------- the buildings (sketch 43), built in a 10 x 10 lot whose front is +z ----------------
  const B = {};
  B.house = (g, lv, L) => {
    const two = lv >= 3, w = two ? 6 : 5, d = two ? 5 : 4.5, h = two ? 5.4 : 2.8, x = 5, z = 4.6;
    if (lv < 2) plane(9.6, 9.6, mats.sand, 5, 0.17, 5, g, 3);
    contact(w, d, x, z, g); box(w, h, d, mats.beige, x, 0.16, z, g); gable(g, w, d, 1.7, 0.55, x, 0.16 + h, z, mats.beige);
    door(g, x, z + d / 2, 1.1, 2.1); steps(g, x, z + d / 2, 2.2, 2); signBoard(g, L.home, x + 1.1, 0.16 + 2.3, z + d / 2 + 0.05, 0.7, 0.3, 0xF6F4EE, '#1D2B55'); cyl(0.04, 0.04, 1.0, mats.pole, x + 3.4, 0.16, 9.3, g, 6); box(0.35, 0.3, 0.5, mats.blue, x + 3.4, 1.16, 9.3, g);
    win(g, '+z', x - 1.8, 1.5, z + d / 2, 0.95, 1.15); win(g, '+z', x + 1.8, 1.5, z + d / 2, 0.95, 1.15); win(g, '+x', x + w / 2, 1.5, z - 0.9); win(g, '-x', x - w / 2, 1.5, z + 0.8); win(g, '-z', x - 1.5, 1.5, z - d / 2); win(g, '-z', x + 1.5, 1.5, z - d / 2);
    box(0.6, 1.5, 0.6, mats.brick, x + w / 2 - 1, 0.16 + h + 0.6, z - 0.6, g); box(0.74, 0.1, 0.74, mats.dark, x + w / 2 - 1, 0.16 + h + 2.1, z - 0.6, g);
    if (two) {
      for (const f of [-1.8, 1.8]) win(g, '+z', x + f, 4.2, z + d / 2, 0.95, 1.15); win(g, '+x', x + w / 2, 4.2, z - 0.9); win(g, '-x', x - w / 2, 4.2, z + 0.8); win(g, '-z', x - 1.5, 4.2, z - d / 2); win(g, '-z', x + 1.5, 4.2, z - d / 2);
      box(2.4, 0.14, 1.1, mats.cream, x, 3.2, z + d / 2 + 0.55, g); for (const dx of [-1.15, -0.58, 0, 0.58, 1.15]) box(0.04, 0.9, 0.04, mats.pole, x + dx, 3.34, z + d / 2 + 1.05, g); box(2.4, 0.05, 0.05, mats.pole, x, 4.2, z + d / 2 + 1.05, g);
      const bd = new T.Mesh(new T.BoxGeometry(1.0, 2.0, 0.08), mats.glassDark); bd.position.set(x, 4.34, z + d / 2 + 0.04); g.add(bd);
    }
    if (lv >= 2) { plane(1.4, 10 - (z + d / 2), mats.brickPave, x, 0.165, (z + d / 2 + 10) / 2, g, 1); for (let i = 0; i <= 9; i++) { if (Math.abs(i - 4.5) < 1.2) continue; box(0.1, 0.9, 0.1, mats.white, i * 1.1, 0.16, 9.9, g); } box(10, 0.08, 0.1, mats.white, 5, 0.86, 9.9, g); for (let i = 0; i < 9; i++) box(0.1, 0.9, 0.1, mats.white, 9.95, 0.16, i * 1.15 + 0.5, g); box(0.1, 0.08, 10, mats.white, 9.95, 0.86, 5, g); }
    if (lv >= 3) tree(g, 1.4, 1.6, 1.05);
    if (lv >= 4) { box(2, 1.9, 1.6, mats.wood, 8.7, 0.16, 1.2, g); gable(g, 2, 1.6, 0.6, 0.2, 8.7, 2.06, 1.2, mats.wood, mats.greyTile); for (let i = 0; i < 3; i++) box(1.6, 0.25, 0.5, M({ color: 0x5A3B23, roughness: 1 }), 1.6, 0.16, 7.4 + i * 0.75, g); for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const f = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), mats.leaf[j % 3]); f.position.set(1.0 + j * 0.4, 0.55, 7.4 + i * 0.75); g.add(f); } }
    if (lv >= 5) { box(4.2, 0.12, 3.2, M({ color: 0xD9CDB5, roughness: .9 }), 7.4, 0.16, 8.0, g); box(3.2, 0.06, 2.2, mats.water, 7.4, 0.22, 8.0, g); for (const [dx, dz] of [[-1.8, -1.3], [1.8, -1.3], [-1.8, 1.3], [1.8, 1.3]]) cyl(0.07, 0.07, 2.3, mats.wood, 7.4 + dx, 0.28, 8.0 + dz, g, 8); for (let i = 0; i < 7; i++) box(0.08, 0.06, 3.0, mats.wood, 5.7 + i * 0.57, 2.58, 8.0, g); box(4.0, 0.08, 0.08, mats.wood, 7.4, 2.5, 6.7, g); box(4.0, 0.08, 0.08, mats.wood, 7.4, 2.5, 9.3, g); hedge(g, 0.7, 5, 1.0, 4); }
  };
  B.school = (g, lv, L) => {
    const floors = lv >= 5 ? 3 : (lv >= 2 ? 2 : 1), wide = lv >= 3, w = wide ? 17 : 9, fh = 3.1, h = floors * fh + 0.2, d = 6, x = wide ? 10 : 5, z = 4.2;
    contact(w, d, x, z, g); box(w, h, d, mats.brick, x, 0.16, z, g); flat(g, w, d, x, 0.16 + h, z, mats.plaster);
    for (let f = 0; f < floors; f++) { const y = 0.16 + f * fh + 1.75; winRow(g, '+z', x - w / 2 + 0.5, x + w / 2 - 0.5, y, z + d / 2, wide ? 9 : 5, 1.0, 1.3); winRow(g, '-z', x - w / 2 + 0.5, x + w / 2 - 0.5, y, z - d / 2, wide ? 9 : 5, 1.0, 1.3); winRow(g, '+x', z - d / 2 + 0.4, z + d / 2 - 0.4, y, x + w / 2, 2, 1.0, 1.3); winRow(g, '-x', z - d / 2 + 0.4, z + d / 2 - 0.4, y, x - w / 2, 2, 1.0, 1.3); if (f > 0) box(w + 0.2, 0.18, d + 0.2, mats.cream, x, 0.16 + f * fh - 0.1, z, g); }
    box(9.3, 0.22, 6.3, mats.frame, x, 2.9, z, g);
    box(3.4, 3.0, 0.5, mats.plaster, x, 0.16, z + d / 2 + 0.1, g); door(g, x - 0.62, z + d / 2 + 0.35, 1.1, 2.2, mats.doorBlue); door(g, x + 0.62, z + d / 2 + 0.35, 1.1, 2.2, mats.doorBlue); box(3.6, 0.14, 1.4, mats.cream, x, 0.16 + 2.5, z + d / 2 + 1.0, g); for (const dx of [-1.6, 1.6]) cyl(0.05, 0.05, 2.5, mats.frame, x + dx, 0.16, z + d / 2 + 1.6, g, 8); steps(g, x, z + d / 2 + 0.35, 3.6, 3);
    const clk = cyl(0.6, 0.6, 0.1, mats.white, x, 0.16 + h - 0.95, z + d / 2 + 0.02, g, 24); clk.rotation.x = Math.PI / 2; box(0.06, 0.45, 0.04, mats.dark, x, 0.16 + h - 0.95, z + d / 2 + 0.1, g).position.y += 0.2; box(0.32, 0.05, 0.04, mats.dark, x + 0.14, 0.16 + h - 0.95, z + d / 2 + 0.1, g);
    signBoard(g, L.school, x, 0.16 + h - 0.35, z + d / 2 + 0.06, 3.2, 0.5);
    cyl(0.04, 0.05, 5.5, mats.metal, x + w / 2 + 1.2, 0.16, z + d / 2 + 1.2, g, 8); box(0.06, 0.6, 1.0, mats.blue, x + w / 2 + 1.2, 5.0, z + d / 2 + 1.7, g);
    if (wide) { plane(7, 4.6, M({ color: 0xB9C4B0, roughness: .95 }), 15.5, 0.17, 6.2, g); cyl(0.06, 0.06, 3.0, mats.pole, 19, 0.17, 6.2, g, 8); box(1.2, 0.8, 0.05, mats.white, 19, 2.4, 6.2, g); }
    if (lv >= 4) { tree(g, 1.2, 1.3, 1.1); tree(g, (wide ? 19 : 9) - 0.4, 1.2, 0.95); for (let i = 0; i < 4; i++) { const r = new T.Mesh(new T.TorusGeometry(0.3, 0.03, 6, 16, Math.PI), mats.pole); r.position.set(2.5 + i * 0.5, 0.17, 8.8); r.castShadow = true; g.add(r); } bench(g, x - 4, 8.9, 0); bench(g, x + 4, 8.9, 0); }
    if (lv >= 5) { box(2.4, 3.2, 2.4, mats.brick, x - w / 2 + 1.6, 0.16 + h + 0.3, z, g); gable(g, 2.4, 2.4, 1.1, 0.3, x - w / 2 + 1.6, 0.16 + h + 3.5, z, mats.brick, mats.greyTile); cyl(0.25, 0.35, 0.4, mats.gold, x - w / 2 + 1.6, 0.16 + h + 2.3, z, g, 12); for (const f of ['+z', '-z']) win(g, f, x - w / 2 + 1.6, 0.16 + h + 2.3, z + (f === '+z' ? 1.2 : -1.2), 0.7, 1.2, false); }
  };
  B.bank = (g, lv, L) => {
    if (lv >= 5) plane(9.6, 9.6, mats.brickPave, 5, 0.17, 5, g, 2);
    const tall = lv >= 4, w = 7.4, d = 5.6, h = tall ? 6.6 : 3.8, x = 5, z = 3.6;
    contact(w, d, x, z, g); box(w, h, d, mats.plaster, x, 0.16, z, g); box(w + 0.5, 0.4, d + 0.5, mats.stone, x, 0.16 + h, z, g); box(w + 0.2, 0.1, d + 0.2, mats.dark, x, 0.56 + h, z, g);
    box(w + 0.3, 0.35, 0.25, mats.stone, x, 0.16 + h - 0.3, z + d / 2 + 0.08, g);
    door(g, x, z + d / 2, 1.5, 2.6, mats.wood); box(0.7, 1.2, 0.06, mats.gold, x + 2.3, 1.3 + 0.16, z + d / 2 + 0.04, g);
    if (lv < 3) { signBoard(g, L.bank, x, 0.16 + 3.1, z + d / 2 + 0.06, 2.0, 0.5, 0xD6D0C4, '#1D2B55'); for (const dx of [-1.15, 1.15]) { cyl(0.22, 0.24, 2.9, mats.white, x + dx, 0.16, z + d / 2 + 0.12, g, 14); cyl(0.3, 0.3, 0.14, mats.white, x + dx, 0.16 + 2.9, z + d / 2 + 0.12, g, 8); } }
    for (const dx of [-2.6, 2.6]) win(g, '+z', x + dx, 1.9, z + d / 2, 1.2, 1.7); win(g, '+x', x + w / 2, 1.9, z - 1.4, 1.2, 1.7); win(g, '+x', x + w / 2, 1.9, z + 1.2, 1.2, 1.7); win(g, '-x', x - w / 2, 1.9, z - 1.4, 1.2, 1.7); win(g, '-x', x - w / 2, 1.9, z + 1.2, 1.2, 1.7);
    if (tall) { for (const dx of [-2.6, 0, 2.6]) win(g, '+z', x + dx, 4.9, z + d / 2, 1.1, 1.5); win(g, '+x', x + w / 2, 4.9, z - 1.4, 1.1, 1.5); win(g, '+x', x + w / 2, 4.9, z + 1.2, 1.1, 1.5); win(g, '-x', x - w / 2, 4.9, z - 1.4, 1.1, 1.5); win(g, '-x', x - w / 2, 4.9, z + 1.2, 1.1, 1.5); box(w + 0.3, 0.25, 0.2, mats.stone, x, 0.16 + 3.5, z + d / 2 + 0.08, g);
      const dome = new T.Mesh(new T.SphereGeometry(1.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.metal); dome.position.set(x, 0.66 + h + 0.3, z); dome.castShadow = true; g.add(dome); cyl(1.7, 1.7, 0.3, mats.stone, x, 0.66 + h, z, g, 24); cyl(0.05, 0.05, 1.0, mats.gold, x, 0.66 + h + 1.9, z, g, 8); }
    steps(g, x, z + d / 2, lv >= 2 ? 6.4 : 3.0, lv >= 2 ? 4 : 2);
    const cols = lv >= 3 ? 4 : (lv >= 2 ? 2 : 0), portH = tall ? 6.2 : 3.4;
    for (let i = 0; i < cols; i++) { const cxx = cols === 4 ? x - 3 + i * 2 : x - 1.1 + i * 2.2; cyl(0.32, 0.36, portH, mats.white, cxx, 0.16, z + d / 2 + 1.6, g, 18); cyl(0.46, 0.46, 0.22, mats.white, cxx, 0.16 + portH, z + d / 2 + 1.6, g, 8); cyl(0.46, 0.5, 0.2, mats.white, cxx, 0.16, z + d / 2 + 1.6, g, 8); }
    if (lv >= 3) { box(w + 0.6, 0.55, 2.4, mats.stone, x, 0.16 + portH + 0.2, z + d / 2 + 1.2, g); gable(g, w + 0.6, 2.4, 1.2, 0.1, x, 0.16 + portH + 0.75, z + d / 2 + 1.2, mats.stone, mats.greyTile); signBoard(g, L.bank, x, 0.16 + portH + 1.1, z + d / 2 + 2.45, 2.0, 0.5, 0xD6D0C4, '#1D2B55'); }
    if (lv >= 5) { const fx = 1.9, fz = 8.2; cyl(1.5, 1.6, 0.5, mats.stone, fx, 0.16, fz, g, 28); cyl(1.35, 1.35, 0.42, mats.water, fx, 0.18, fz, g, 28); cyl(0.2, 0.25, 1.1, mats.stone, fx, 0.2, fz, g, 12); cyl(0.6, 0.45, 0.1, mats.stone, fx, 1.3, fz, g, 20); lampPost(g, 8.6, 8.6); lampPost(g, 0.6, 1.2); bench(g, 5, 9.2, 0); }
    else { tree(g, 1.0, 1.2, 0.9, 'cypress'); tree(g, 9.0, 1.2, 0.9, 'cypress'); }
  };
  B.office = (g, lv, L) => {
    plane(9.6, 9.6, mats.paving, 5, 0.17, 5, g, 3);
    const floors = [4, 8, 12, 15, 18][lv - 1], fh = 1.0, w = 5.2, d = 5.2, h = floors * fh, x = 5, z = 4.2;
    contact(w, d, x, z, g, 0.165, 1.6); box(w, h, d, mats.tower, x, 0.16, z, g); for (let f = 1; f < floors; f++) box(w + 0.12, 0.16, d + 0.12, mats.dark, x, 0.16 + f * fh - 0.08, z, g);
    for (const [sx, sz] of [[w / 2 + 0.06, 0], [-w / 2 - 0.06, 0], [0, d / 2 + 0.06], [0, -d / 2 - 0.06]]) { for (let k = -2; k <= 2; k++) { if (sx !== 0) box(0.1, h, 0.1, mats.dark, x + sx, 0.16, z + k * 1.05, g); else box(0.1, h, 0.1, mats.dark, x + k * 1.05, 0.16, z + sz, g); } }
    box(w + 0.4, 0.4, d + 0.4, mats.concrete, x, 0.16 + h, z, g); box(3.6, 3.0, 0.4, mats.concrete, x, 0.16, z + d / 2 + 0.1, g); door(g, x - 0.6, z + d / 2 + 0.3, 1.0, 2.4, mats.glassDark); door(g, x + 0.6, z + d / 2 + 0.3, 1.0, 2.4, mats.glassDark); box(4.0, 0.16, 1.6, mats.dark, x, 0.16 + 2.9, z + d / 2 + 1.0, g);
    for (const dx of [-1.9, 1.9]) box(0.1, 1.6, 0.1, mats.pole, x + dx, 0.56 + h, z + d / 2 - 0.3, g); signBoard(g, 'SkyTasks', x, 0.56 + h + 1.2, z + d / 2 - 0.3, 3.8, 0.7); signBoard(g, L.office, x, 0.16 + 2.6, z + d / 2 + 0.32, 2.4, 0.45, 0x2A2E36, '#F2C14E');
    if (lv >= 4) { for (const px of [1.2, 8.8]) for (const pz of [1.2, 8.8]) { box(1.2, 0.6, 1.2, mats.concrete, px, 0.16, pz, g); box(0.9, 0.7, 0.9, mats.hedge, px, 0.76, pz, g); } bench(g, 2.2, 8.6, 0); bench(g, 7.8, 8.6, 0); lampPost(g, 0.7, 5); }
    if (lv >= 5) { box(3.4, 0.9, 3.4, M({ color: 0x8A8E96, roughness: .6 }), x, 0.56 + h, z, g); cyl(0.05, 0.07, 4.0, mats.metal, x + 1.2, 1.46 + h, z - 1.2, g, 8); const l = new T.PointLight(0xFF3B3B, 0, 6, 2); l.position.set(x + 1.2, 5.4 + h, z - 1.2); g.add(l); nightOn.push(l); cyl(1.3, 1.3, 0.06, M({ color: 0xD9D4C8, roughness: .9 }), x - 0.6, 1.46 + h, z + 0.4, g, 24); const ring = new T.Mesh(new T.RingGeometry(0.9, 1.1, 24), M({ color: 0xE0A63A })); ring.rotation.x = -Math.PI / 2; ring.position.set(x - 0.6, 1.53 + h, z + 0.4); g.add(ring); }
  };
  B.clinic = (g, lv, L) => {
    if (lv < 4) plane(9.6, 9.6, mats.paving, 5, 0.17, 5, g, 3);
    const floors = lv >= 5 ? 3 : (lv >= 2 ? 2 : 1), fh = 3.0, w = 7.6, d = 5.4, h = floors * fh + 0.2, x = 4.6, z = 3.6;
    contact(w, d, x, z, g); box(w, h, d, mats.concrete, x, 0.16, z, g); flat(g, w, d, x, 0.16 + h, z, mats.concrete);
    for (let f = 0; f < floors; f++) { const y = 0.16 + f * fh + 1.7; box(w + 0.08, 1.3, 0.06, mats.glassDark, x, y - 0.65, z + d / 2 + 0.03, g); box(w + 0.08, 1.3, 0.06, mats.glassDark, x, y - 0.65, z - d / 2 - 0.03, g); box(0.06, 1.3, d + 0.08, mats.glassDark, x + w / 2 + 0.03, y - 0.65, z, g); box(0.06, 1.3, d + 0.08, mats.glassDark, x - w / 2 - 0.03, y - 0.65, z, g); box(w + 0.2, 0.12, d + 0.2, mats.white, x, y + 0.65, z, g); box(w + 0.2, 0.12, d + 0.2, mats.white, x, y - 0.75, z, g); for (let k = -3; k <= 3; k++) box(0.06, 1.3, 0.1, mats.white, x + k * 1.1, y - 0.65, z + d / 2 + 0.03, g); }
    box(2.0, h + 1.6, 2.0, mats.white, x + w / 2 - 0.6, 0.16, z - d / 2 + 0.6, g); const cx = x + w / 2 - 0.6, cz = z - d / 2 + 0.6, cy = 0.16 + h + 0.9; box(0.9, 0.26, 0.1, mats.cross, cx, cy - 0.13, cz + 1.02, g); box(0.26, 0.9, 0.1, mats.cross, cx, cy - 0.45, cz + 1.02, g); box(0.9, 0.26, 0.1, mats.cross, cx + 1.02, cy - 0.13, cz, g).rotation.y = Math.PI / 2; box(0.26, 0.9, 0.1, mats.cross, cx + 1.02, cy - 0.45, cz, g).rotation.y = Math.PI / 2;
    door(g, x, z + d / 2, 1.0, 2.3, mats.glassDark); door(g, x - 1.05, z + d / 2, 1.0, 2.3, mats.glassDark); steps(g, x - 0.5, z + d / 2, 3.2, 2); box(1.6, 0.05, 2.2, mats.dark, x + 1.8, 0.17, z + d / 2 + 1.2, g);
    if (lv >= 2) { box(4.2, 0.14, 2.0, mats.white, x - 0.5, 0.16 + 2.7, z + d / 2 + 1.0, g); for (const dx of [-1.9, 1.9]) cyl(0.05, 0.05, 2.7, mats.metal, x - 0.5 + dx, 0.16, z + d / 2 + 1.9, g, 8); }
    signBoard(g, L.clinic, x - 0.5, 0.16 + h - 0.45, z + d / 2 + 0.06, 2.6, 0.5, 0xF4F2EC, '#1D2B55');
    if (lv >= 3) { const a = car(g, 0xF4F4EE, 9.0, 8.0, Math.PI / 2); box(1.3, 0.9, 0.95, mats.white, -0.45, 0.8, 0, a); box(0.5, 0.12, 0.3, M({ color: 0x2F6BD6, emissive: 0x2F6BD6, emissiveIntensity: .8 }), -0.4, 1.72, 0, a); box(0.12, 0.4, 0.1, mats.cross, 0.2, 1.0, 0.49, a); box(0.4, 0.12, 0.1, mats.cross, 0.2, 1.14, 0.49, a); bench(g, 1.2, 8.9, 0); bench(g, 3.2, 8.9, 0); }
    if (lv >= 4) { tree(g, 1.2, 1.2, 1.0); tree(g, 1.0, 5.5, 0.8, 'cypress'); hedge(g, 0.5, 3.4, 0.6, 2.5); }
    if (lv >= 5) { box(3.0, 3.2, 3.4, mats.concrete, x - w / 2 - 1.4, 0.16, z + 0.6, g); flat(g, 3.0, 3.4, x - w / 2 - 1.4, 3.36, z + 0.6, mats.concrete); box(2.9, 1.1, 0.06, mats.glassDark, x - w / 2 - 1.4, 1.3, z + 0.6 + 1.73, g); }
  };
  B.playground = (g, lv, L) => {
    box(4.2, 0.3, 4.2, mats.wood, 3, 0.16, 3, g); box(3.8, 0.2, 3.8, mats.sand, 3, 0.3, 3, g); bench(g, 1.4, 8.6, 0); tree(g, 8.8, 1.4, 1.1); signBoard(g, L.playground, 5, 1.6, 9.8, 2.8, 0.5); for (const dx of [-1.3, 1.3]) cyl(0.05, 0.05, 1.4, mats.pole, 5 + dx, 0.16, 9.8, g, 8);
    if (lv >= 2) { box(1.2, 2.0, 1.2, mats.blue, 2.2, 0.16, 2.2, g); box(1.3, 0.08, 1.3, mats.red, 2.2, 2.16, 2.2, g); const sl = box(0.9, 0.08, 3.4, mats.sunY, 3.9, 1.0, 2.2, g); sl.rotation.z = -0.58; sl.position.set(3.95, 1.12, 2.2); for (const dz of [-0.45, 0.45]) { const r = box(0.06, 0.3, 3.4, mats.sunY, 3.95, 1.25, 2.2 + dz, g); r.rotation.z = -0.58; } for (let i = 0; i < 5; i++) box(0.9, 0.06, 0.2, mats.metal, 1.3, 0.3 + i * 0.38, 2.3, g); }
    if (lv >= 3) { for (const dx of [-1.4, 1.4]) for (const dz of [-0.6, 0.6]) { const l = cyl(0.06, 0.06, 2.6, mats.metal, 7.4 + dx, 0.16, 6.4 + dz, g, 8); l.rotation.x = dz > 0 ? -0.22 : 0.22; } const bar = cyl(0.05, 0.05, 3.0, mats.metal, 7.4, 2.6, 6.4, g, 8); bar.rotation.z = Math.PI / 2; for (const dx of [-0.6, 0.6]) { box(0.5, 0.08, 0.25, mats.wood, 7.4 + dx, 1.2, 6.4, g); for (const k of [-0.2, 0.2]) box(0.03, 1.4, 0.03, mats.metal, 7.4 + dx + k, 1.24, 6.4, g); }
      cyl(1.1, 1.1, 0.12, mats.red, 2.6, 0.4, 7.4, g, 24); cyl(0.08, 0.08, 1.0, mats.metal, 2.6, 0.5, 7.4, g, 8); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; box(0.06, 0.6, 0.06, mats.metal, 2.6 + Math.cos(a) * 0.9, 0.52, 7.4 + Math.sin(a) * 0.9, g); } }
    if (lv >= 4) { plane(3.6, 3.6, mats.rubber, 7.6, 0.17, 2.4, g); cyl(0.06, 0.06, 3.0, mats.pole, 9.3, 0.17, 2.4, g, 8); box(1.2, 0.8, 0.05, mats.white, 9.3, 2.4, 2.4, g); const hoop = new T.Mesh(new T.TorusGeometry(0.25, 0.03, 6, 16), mats.sunY); hoop.rotation.x = Math.PI / 2; hoop.position.set(8.95, 2.5, 2.4); g.add(hoop); }
    if (lv >= 5) { for (let i = 0; i <= 9; i++) for (const zz of [0.05, 9.95]) box(0.08, 0.9, 0.08, mats.white, i * 1.1 + 0.05, 0.16, zz, g); for (const zz of [0.05, 9.95]) box(10, 0.06, 0.08, mats.white, 5, 0.9, zz, g); tree(g, 1.2, 5.6, 0.9); tree(g, 8.8, 9.0, 0.9); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(0.07, 0.07, 2.3, mats.wood, 5 + dx * 1.2, 0.16, 8.3 + dz * 0.9, g, 8); for (let i = 0; i < 6; i++) box(0.08, 0.06, 2.2, mats.wood, 3.8 + i * 0.5, 2.46, 8.3, g); bench(g, 5, 8.3, 0); }
  };
  B.supermarket = (g, lv, L) => {
    plane(19.6, 9.6, mats.paving, 10, 0.17, 5, g, 3);
    const w = 13, d = 7, h = 4.6, x = 7.5, z = 3.6; contact(w, d, x, z, g); box(w, h, d, mats.concrete, x, 0.16, z, g); flat(g, w, d, x, 0.16 + h, z, mats.concrete);
    box(w + 0.2, 1.0, 0.3, mats.red, x, 0.16 + h - 1.3, z + d / 2 + 0.1, g); signBoard(g, L.supermarket, x, 0.16 + h - 0.8, z + d / 2 + 0.28, 4.0, 0.7, 0xC94F3F, '#ffffff');
    box(w - 1, 2.8, 0.06, mats.glassDark, x, 0.46, z + d / 2 + 0.03, g); for (let k = -5; k <= 5; k++) box(0.08, 2.8, 0.12, mats.dark, x + k * 1.2, 0.46, z + d / 2 + 0.03, g); box(w - 1, 0.14, 0.14, mats.dark, x, 3.26, z + d / 2 + 0.03, g); box(w - 1, 0.3, 0.14, mats.dark, x, 0.16, z + d / 2 + 0.03, g);
    box(2.4, 0.08, 2.2, mats.dark, x, 0.16 + 3.2, z + d / 2 + 1.1, g); for (const dx of [-1, 1]) cyl(0.05, 0.05, 3.2, mats.metal, x + dx, 0.16, z + d / 2 + 2.1, g, 8);
    for (let i = 0; i < 4; i++) box(1.6, 0.9, 0.3, mats.plaster, x - 5.5 + i * 1.1, 0.16 + h + 0.3, z - 2, g);
    for (let i = 0; i < 3; i++) { const cz = z + d / 2 + 0.9; box(0.6, 0.5, 0.8, mats.metal, x - 5.2 + i * 0.7, 0.5, cz, g); }
    plane(4.4, 9.6, mats.asphalt, 17.6, 0.17, 5, g, 3); for (let i = 0; i < 4; i++) box(0.1, 0.01, 2.6, mats.white, 15.8 + i * 1.2, 0.175, 2.4, g); car(g, 0xC94F3F, 16.4, 2.4, 0); car(g, 0x2E5B8F, 17.6, 2.4, 0);
    tree(g, 1.0, 1.2, 0.9); tree(g, 1.0, 8.6, 0.9);
  };
  // Your own neighbourhoods (sketch 16) and the shared home (sketch 20): simpler bodies from the same parts, with
  // the neighbourhood's colour on the trim. They get their full treatment in stage 3.
  function tint(hex) { return M({ color: hex, roughness: .6 }); }
  B.shop = (g, lv, L, b) => {
    const c = tint(b.color), w = 6, d = 5, h = 3.4 + Math.min(lv - 1, 2) * 0.6, x = 5, z = 4.5; plane(9.6, 9.6, mats.paving, 5, 0.17, 5, g, 3); contact(w, d, x, z, g); box(w, h, d, mats.beige, x, 0.16, z, g); flat(g, w, d, x, 0.16 + h, z, mats.concrete);
    box(w - 0.6, 2.0, 0.06, mats.glassDark, x, 0.46, z + d / 2 + 0.03, g); box(w + 0.6, 0.12, 1.4, c, x, 2.7, z + d / 2 + 0.6, g); for (let k = 0; k < 6; k++) box((w + 0.6) / 6 - 0.05, 0.4, 1.4, k % 2 ? c : mats.white, x - w / 2 - 0.3 + (k + 0.5) * (w + 0.6) / 6, 2.3, z + d / 2 + 0.6, g);
    door(g, x, z + d / 2, 1.1, 2.1, mats.glassDark); signBoard(g, b.name || L.shop, x, 0.16 + h - 0.5, z + d / 2 + 0.06, 3.2, 0.6, b.color);
    if (lv >= 3) { tree(g, 1.2, 8.6, 0.9); bench(g, 8.4, 8.6, 0); } if (lv >= 5) lampPost(g, 0.8, 1.2);
  };
  B.studio = (g, lv, L, b) => {
    const c = tint(b.color), w = 6, d = 5.5, h = 3.6 + Math.min(lv - 1, 3) * 0.5, x = 5, z = 4.5; contact(w, d, x, z, g); box(w, h, d, mats.concrete, x, 0.16, z, g); flat(g, w, d, x, 0.16 + h, z, mats.concrete);
    box(w - 1, h - 1.2, 0.06, mats.glassDark, x, 0.56, z + d / 2 + 0.03, g); for (let k = -2; k <= 2; k++) box(0.08, h - 1.2, 0.1, mats.dark, x + k * 1.2, 0.56, z + d / 2 + 0.03, g); box(w, 0.3, 0.3, c, x, 0.16 + h - 0.3, z + d / 2 + 0.1, g);
    const sk = box(2.4, 0.9, 2.0, mats.glassDark, x, 0.46 + h, z - 0.8, g); sk.rotation.x = -0.4; door(g, x + 2, z + d / 2, 1.0, 2.1, mats.dark); signBoard(g, b.name || L.studio, x - 1.2, 0.16 + h - 0.7, z + d / 2 + 0.06, 2.6, 0.5, b.color);
    if (lv >= 3) tree(g, 1.0, 1.4, 0.9, 'cypress'); if (lv >= 4) tree(g, 9.0, 8.8, 1.0);
  };
  B.garden = (g, lv, L, b) => {
    const c = tint(b.color); for (let i = 0; i < Math.min(lv + 1, 5); i++) { box(1.6, 0.3, 6, M({ color: 0x5A3B23, roughness: 1 }), 1.3 + i * 1.7, 0.16, 5, g); for (let j = 0; j < 6; j++) { const f = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), mats.leaf[(i + j) % 3]); f.position.set(1.3 + i * 1.7, 0.6, 2.5 + j * 1); f.castShadow = true; g.add(f); } }
    box(3.2, 2.2, 2.6, mats.glassDark, 8.2, 0.16, 2.4, g); gable(g, 3.2, 2.6, 0.9, 0.1, 8.2, 2.36, 2.4, mats.glassDark, mats.glassDark); box(1.0, 1.0, 1.0, mats.wood, 8.5, 0.16, 8.5, g); signBoard(g, b.name || L.garden, 5, 1.6, 9.8, 2.8, 0.5, b.color); for (const dx of [-1.3, 1.3]) cyl(0.05, 0.05, 1.4, mats.pole, 5 + dx, 0.16, 9.8, g, 8);
    for (let i = 0; i <= 9; i++) box(0.08, 0.7, 0.08, mats.wood, i * 1.1 + 0.05, 0.16, 0.05, g); box(10, 0.05, 0.06, mats.wood, 5, 0.7, 0.05, g); if (lv >= 4) tree(g, 0.9, 8.8, 1.0);
  };
  B.tower = (g, lv, L, b) => {
    const c = tint(b.color), floors = 3 + lv * 2, w = 4.2, d = 4.2, h = floors, x = 5, z = 4.5; plane(9.6, 9.6, mats.paving, 5, 0.17, 5, g, 3); contact(w, d, x, z, g, 0.165, 1.5); box(w, h, d, mats.plaster, x, 0.16, z, g);
    for (let f = 0; f < floors; f++) { const y = 0.16 + f + 0.5; for (const dx of [-1.2, 0, 1.2]) { const wmesh = new T.Mesh(new T.BoxGeometry(0.8, 0.6, 0.06), litRand() < 0.6 ? mats.glassLit : mats.glassDark); wmesh.position.set(x + dx, y, z + d / 2 + 0.03); g.add(wmesh); const w2 = wmesh.clone(); w2.position.set(x + d / 2 + 0.03, y, z + dx); w2.rotation.y = Math.PI / 2; g.add(w2); } }
    box(w + 0.3, 0.5, d + 0.3, c, x, 0.16 + h, z, g); door(g, x, z + d / 2, 1.0, 2.1, mats.dark); signBoard(g, b.name || L.tower, x, 0.16 + 2.6, z + d / 2 + 0.06, 2.6, 0.5, b.color); if (lv >= 3) lampPost(g, 0.8, 8.8);
  };
  B.ourHouse = (g, lv, L, b) => {
    const w = 6.5, d = 5, h = 5.4, x = 5, z = 4.6; contact(w, d, x, z, g); box(w, h, d, mats.beige, x, 0.16, z, g); gable(g, w, d, 1.8, 0.55, x, 0.16 + h, z, mats.beige);
    door(g, x, z + d / 2, 1.2, 2.2); steps(g, x, z + d / 2, 2.4, 2);
    const ws = (b.windows || []).slice(0, 6); const spots = [[-2.2, 1.6], [2.2, 1.6], [-2.2, 4.2], [0, 4.2], [2.2, 4.2], [0, 1.6]];
    ws.forEach((col, i) => { const [dx, y] = spots[i]; const lit = (b.lit || []).indexOf(i) >= 0; win(g, '+z', x + dx, y, z + d / 2, 0.95, 1.15, false); const fr = box(1.2, 1.4, 0.06, M({ color: parseInt(col.slice(1), 16), roughness: .6 }), x + dx, y - 0.7, z + d / 2 + 0.14, g); fr.scale.set(1, 1, 1); const gl = new T.Mesh(new T.BoxGeometry(0.9, 1.1, 0.05), lit ? M({ color: 0xFFE2A0, emissive: 0xFFC46B, emissiveIntensity: night ? 1.2 : 0 }) : mats.glassDark); gl.position.set(x + dx, y, z + d / 2 + 0.2); g.add(gl); });
    for (let i = 0; i <= 9; i++) { if (Math.abs(i - 4.5) < 1.2) continue; box(0.1, 0.9, 0.1, mats.white, i * 1.1, 0.16, 9.9, g); } box(10, 0.08, 0.1, mats.white, 5, 0.86, 9.9, g);
    for (const dx of [-1.4, 1.4]) cyl(0.06, 0.06, 2.6, mats.wood, x + dx, 0.16, 9.9, g, 8); signBoard(g, b.name || L.ours, x, 2.5, 9.9, 2.8, 0.5, 0x7A4B2E); tree(g, 1.2, 1.6, 1.0);
  };
  // A project on a plot beside the landmark (sketch 5): sign, foundation and crane, shell, finished.
  function project(g, b, L) {
    const w = 5, d = 4.5, x = 5, z = 4.6, col = parseInt((b.color || '#1D2B55').slice(1), 16);
    if (b.stage === 'lot') { for (let i = 0; i <= 9; i++) for (const zz of [0.05, 9.95]) box(0.08, 0.8, 0.08, mats.fence, i * 1.1 + 0.05, 0.16, zz, g); for (const zz of [0.05, 9.95]) box(10, 0.05, 0.06, mats.fence, 5, 0.9, zz, g); plane(9.6, 9.6, mats.sand, 5, 0.17, 5, g, 3); for (const dx of [-1.3, 1.3]) cyl(0.05, 0.05, 2.2, mats.pole, 5 + dx, 0.16, 8.5, g, 8); signBoard(g, b.name || L.lot, 5, 2.3, 8.5, 3.0, 0.7, 0xF6F4EE, '#1D2B55'); return; }
    plane(9.6, 9.6, mats.sand, 5, 0.17, 5, g, 3); box(w + 0.6, 0.4, d + 0.6, mats.slab, x, 0.16, z, g);
    if (b.stage === 'foundation') { for (const [dx, dz] of [[-2, -1.6], [2, -1.6], [-2, 1.6], [2, 1.6]]) box(0.5, 0.9, 0.5, mats.slab, x + dx, 0.56, z + dz, g); cyl(0.12, 0.12, 9, mats.crane, 8.6, 0.16, 1.4, g, 8); const arm = box(7, 0.3, 0.3, mats.crane, 5.6, 9.1, 1.4, g); box(0.3, 0.3, 0.3, mats.crane, 8.6, 9.0, 1.4, g); cyl(0.02, 0.02, 4, mats.dark, 3.2, 5.0, 1.4, g, 6); box(0.8, 0.8, 0.8, mats.slab, 3.2, 4.6, 1.4, g); signBoard(g, b.name || L.lot, 5, 2.3, 8.9, 3.0, 0.7, 0xF6F4EE, '#1D2B55'); for (const dx of [-1.3, 1.3]) cyl(0.05, 0.05, 2.2, mats.pole, 5 + dx, 0.16, 8.9, g, 8); return; }
    if (b.stage === 'shell') { for (let f = 0; f < 3; f++) { box(w, 0.25, d, mats.slab, x, 0.56 + f * 2.6, z, g); for (const [dx, dz] of [[-2.2, -1.9], [2.2, -1.9], [-2.2, 1.9], [2.2, 1.9], [0, -1.9], [0, 1.9]]) box(0.3, 2.6, 0.3, mats.slab, x + dx, 0.56 + f * 2.6, z + dz, g); } box(w, 0.25, d, mats.slab, x, 0.56 + 7.8, z, g); cyl(0.12, 0.12, 11, mats.crane, 8.6, 0.16, 1.4, g, 8); box(7, 0.3, 0.3, mats.crane, 5.6, 11.1, 1.4, g); return; }
    const two = true, h = 5.2; contact(w, d, x, z, g); box(w, h, d, mats.beige, x, 0.16, z, g); gable(g, w, d, 1.6, 0.5, x, 0.16 + h, z, mats.beige); door(g, x, z + d / 2, 1.1, 2.1); steps(g, x, z + d / 2, 2.2, 2);
    for (const y of [1.5, 4.1]) { win(g, '+z', x - 1.6, y, z + d / 2, 0.9, 1.1); win(g, '+z', x + 1.6, y, z + d / 2, 0.9, 1.1); win(g, '+x', x + w / 2, y, z, 0.9, 1.1); win(g, '-x', x - w / 2, y, z, 0.9, 1.1); }
    cyl(0.04, 0.05, 4.0, mats.metal, 8.8, 0.16, 8.8, g, 8); box(0.06, 0.5, 0.8, M({ color: col }), 8.8, 3.6, 9.2, g); if (b.alive) { tree(g, 1.2, 8.6, 0.9); hedge(g, 1.4, 1.2, 2.4, 0.6); }
  }

  // ---------------- the city from the state ----------------
  let root = null, night = false, state = null;
  const tappable = []; // meshes with userData.district
  function clearRoot() {
    if (root) { scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    root = new T.Group(); scene.add(root); nightOn.length = 0; tappable.length = 0;
  }
  function front(cx, cz, roads, cols, rows) {
    // The building faces the nearest road; failing one, the map's near edge.
    let best = null, bd = 1e9;
    for (const r of roads) {
      let dist, dir;
      if (r.alongI) { const rz = (r.at + 0.5) * TILE; dist = Math.abs(cz - rz); dir = cz < rz ? 0 : Math.PI; if (cx < r.from * TILE || cx > r.to * TILE) dist += 50; }
      else { const rx = (r.at + 0.5) * TILE; dist = Math.abs(cx - rx); dir = cx < rx ? -Math.PI / 2 : Math.PI / 2; if (cz < r.from * TILE || cz > r.to * TILE) dist += 50; }
      if (dist < bd) { bd = dist; best = dir; }
    }
    return best == null ? 0 : best;
  }
  function placeBuilding(b, d, L) {
    const wide = b.kind === 'school' || b.kind === 'supermarket', lw = wide ? 2 : 1;
    const g = new T.Group(); const cx = (b.i + lw / 2) * TILE, cz = (b.j + 0.5) * TILE;
    const yaw = front(cx, cz, state.roads, state.cols, state.rows);
    // The builder draws in lot space (0..10 or 0..20, front at +z); rotate about the lot centre.
    const inner = new T.Group(); inner.position.set(-lw * TILE / 2, 0, -TILE / 2);
    const bb = Object.assign({}, b, { color: d.color, name: b.name || d.name });
    if (b.stage === 'finished' || b.stage === 'alive') { if (b.landmark) (B[b.kind] || B.house)(inner, Math.max(1, Math.min(5, b.level || 1)), L, bb); else project(inner, Object.assign({}, bb, { alive: b.stage === 'alive' }), L); }
    else project(inner, bb, L);
    g.add(inner); g.position.set(cx, 0, cz); g.rotation.y = yaw;
    g.traverse(o => { if (o.isMesh) { o.userData.district = d.id; o.userData.building = b; tappable.push(o); } });
    root.add(g);
  }
  function build(s) {
    state = s; clearRoot(); litSeed = 7;
    const L = s.labels || {}; const W = s.cols * TILE, H = s.rows * TILE;
    // Ground: the map's grass, the far grass, and a dark edge so the map reads as a model on a table.
    const far = plane(W + 400, H + 400, mats.grass, W / 2, -0.02, H / 2, root, 3);
    plane(W, H, mats.grass, W / 2, 0.15, H / 2, root, 3);
    // Roads with sidewalks, curbs and lane dashes.
    const roads = s.roads.slice(); if (s.rows > s.baseRows) roads.push({ alongI: true, at: s.quarterRoad, from: 0, to: s.cols }, ...(s.quarterLinks || []));
    for (const r of roads) {
      const len = (r.to - r.from) * TILE;
      if (r.alongI) { const cz = (r.at + 0.5) * TILE, cx = (r.from + r.to) / 2 * TILE; const rp = plane(len, 5.6, mats.asphalt, cx, 0.16, cz, root, 3); rp.material = mats.asphalt; for (const s2 of [-1, 1]) { box(len, 0.02, 2.0, mats.paving, cx, 0.16, cz + s2 * 3.9, root, 1.2); box(len, 0.1, 0.2, mats.curb, cx, 0.16, cz + s2 * 2.9, root); } for (let k = r.from * TILE + 1.5; k < r.to * TILE - 1; k += 3) box(1.4, 0.012, 0.14, mats.lane, k, 0.165, cz, root); }
      else { const cx = (r.at + 0.5) * TILE, cz = (r.from + r.to) / 2 * TILE; const rp = plane(5.6, len, mats.asphalt, cx, 0.16, cz, root, 3); for (const s2 of [-1, 1]) { box(2.0, 0.02, len, mats.paving, cx + s2 * 3.9, 0.16, cz, root, 1.2); box(0.2, 0.1, len, mats.curb, cx + s2 * 2.9, 0.16, cz, root); } for (let k = r.from * TILE + 1.5; k < r.to * TILE - 1; k += 3) box(0.14, 0.012, 1.4, mats.lane, cx, 0.165, k, root); }
      // Street lamps every other tile, on the sidewalk's outer edge.
      for (let k = r.from * TILE + 5; k < r.to * TILE; k += 20) { if (r.alongI) lampPost(root, k, (r.at + 0.5) * TILE + 4.6); else lampPost(root, (r.at + 0.5) * TILE - 4.6, k); }
    }
    for (const p of s.paving || []) plane((p[2] - p[0]) * TILE, (p[3] - p[1]) * TILE, mats.brickPave, (p[0] + p[2]) / 2 * TILE, 0.165, (p[1] + p[3]) / 2 * TILE, root, 2);
    if (s.fountain) { const fx = s.fountain[0] * TILE, fz = s.fountain[1] * TILE; cyl(2.2, 2.4, 0.6, mats.stone, fx, 0.16, fz, root, 32); cyl(2.0, 2.0, 0.5, mats.water, fx, 0.18, fz, root, 32); cyl(0.3, 0.4, 1.6, mats.stone, fx, 0.2, fz, root, 12); cyl(0.9, 0.7, 0.12, mats.stone, fx, 1.8, fz, root, 24); }
    if (s.letters) { const [i0, i1, j] = s.letters; const cx = (i0 + i1) / 2 * TILE, cz = j * TILE; box((i1 - i0) * TILE, 0.6, 1.2, mats.stone, cx, 0.16, cz, root); signBoard(root, 'SkyTasks.', cx, 0.76 + 1.0, cz, (i1 - i0) * TILE - 1, 2.0, 0x1D2B55); }
    for (const p of s.parks || []) { const cx = (p.i + p.wi / 2) * TILE, cz = (p.j + p.wj / 2) * TILE; let n = 0; for (let a = 0; a < p.wi; a++) for (let b = 0; b < p.wj; b++) { tree(root, (p.i + a + 0.3 + ((a + b) % 2) * 0.4) * TILE, (p.j + b + 0.35 + (a % 2) * 0.3) * TILE, 1.0 + ((a * 3 + b) % 3) * 0.15, (a + b) % 3 === 1 ? 'cypress' : 'oak'); n++; } bench(root, cx, cz, 0); }
    for (const d of s.districts) {
      if (d.park) { const z = d.zone; for (let a = 0; a < z.wi; a++) for (let b = 0; b < z.wj; b++) tree(root, (z.i + a + 0.5) * TILE, (z.j + b + 0.5) * TILE, 1.1); continue; }
      for (const b of d.buildings) placeBuilding(b, d, L);
      // Life: people and trees on the empty ground of the neighbourhood, from finished loose tasks (stage 2 moves them).
      const z = d.zone; const taken = new Set(d.buildings.flatMap(b => { const lw = (b.kind === 'school' || b.kind === 'supermarket') ? 2 : 1; const out = []; for (let k = 0; k < lw; k++) out.push((b.i + k) + ',' + b.j); return out; }));
      let life = d.neglected ? 0 : (d.life || 0), k = 0;
      for (let a = 0; a < z.wi && life > 0; a++) for (let b = 0; b < z.wj && life > 0; b++) { if (taken.has((z.i + a) + ',' + (z.j + b))) continue; const cx = (z.i + a) * TILE, cz = (z.j + b) * TILE; tree(root, cx + 2 + (k % 3) * 2.5, cz + 2.5, 1.0); if (life > 1) person(root, cx + 6, cz + 6, [0xC94F3F, 0x1D2B55, 0x5C9A48, 0xE0A63A][k % 4]); life -= 2; k++; }
      if (d.neglected && d.buildings.length) { const b = d.buildings[0]; signBoard(root, L.waiting || '', (b.i + 0.5) * TILE + 4.2, 1.6, (b.j + 0.5) * TILE + 4.6, 2.4, 0.5, 0xF6F4EE, '#1D2B55'); cyl(0.05, 0.05, 1.4, mats.pole, (b.i + 0.5) * TILE + 4.2, 0.16, (b.j + 0.5) * TILE + 4.6, root, 8); }
    }
    far.receiveShadow = true;
    sun.shadow.camera.left = -Math.max(W, H) * 0.75; sun.shadow.camera.right = Math.max(W, H) * 0.75; sun.shadow.camera.top = Math.max(W, H) * 0.75; sun.shadow.camera.bottom = -Math.max(W, H) * 0.75; sun.shadow.camera.near = 1; sun.shadow.camera.far = 400; sun.shadow.camera.updateProjectionMatrix();
    setNight(!!s.night);
    if (!view.placed) { top(false); view.placed = true; }
  }
  function setNight(on) {
    night = on; const k = on ? NIGHT : DAY;
    sun.color.set(k.sun[0]); sun.intensity = k.sun[1]; hemi.color.set(k.hemi[0]); hemi.groundColor.set(k.hemi[1]); hemi.intensity = k.hemi[2];
    const key = on ? 'n' : 'd'; if (!envOf[key]) envOf[key] = pmrem.fromEquirectangular(on ? skyNight : skyDay).texture; for (const m of reflective) { m.envMap = envOf[key]; m.needsUpdate = true; } scene.background = on ? skyNight : skyDay;
    mats.glassLit.emissive.set(on ? 0xFFC46B : 0x000000); mats.glassLit.emissiveIntensity = on ? 1.1 : 0; mats.lamp.emissive.set(on ? 0xFFE2A0 : 0x000000); mats.lamp.emissiveIntensity = on ? 1.6 : 0; mats.cross.emissive.set(on ? 0xFF4040 : 0x000000); mats.cross.emissiveIntensity = on ? 1.4 : 0;
    for (const l of nightOn) { if (l.isLight) l.intensity = on ? (quality.lights ? 1.4 : 0) : 0; else { l.emissive.set(on ? 0xFFFFFF : 0x000000); l.emissiveIntensity = on ? 0.9 : 0; } }
  }

  // ---------------- camera ----------------
  const cam = new T.PerspectiveCamera(38, 1, 0.5, 700);
  const view = { yaw: 0, pitch: 52, dist: 80, tx: 40, ty: 1, tz: 40, placed: false };
  const anim = { from: null, to: null, t0: 0, ms: 0 };
  function place() {
    if (anim.to) { const k = Math.min(1, (performance.now() - anim.t0) / anim.ms), e = 1 - Math.pow(1 - k, 3); for (const key of ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz']) view[key] = anim.from[key] + (anim.to[key] - anim.from[key]) * e; if (k >= 1) anim.to = null; }
    const y = view.yaw * Math.PI / 180, p = view.pitch * Math.PI / 180;
    cam.position.set(view.tx + Math.sin(y) * Math.cos(p) * view.dist, view.ty + Math.sin(p) * view.dist, view.tz + Math.cos(y) * Math.cos(p) * view.dist); cam.lookAt(view.tx, view.ty, view.tz);
    sun.target.position.set(view.tx, 0, view.tz); sun.position.set(view.tx + 60, 90, view.tz + 30);
  }
  function animateTo(to, ms = 700) { anim.from = Object.assign({}, view); anim.to = Object.assign({}, view, to); anim.t0 = performance.now(); anim.ms = ms; }
  function top(animate = true) {
    if (!state) return; const W = state.cols * TILE, H = state.rows * TILE; const aspect = cam.aspect || 1;
    const pitch = 52, t2 = 2 * Math.tan(cam.fov * Math.PI / 360);
    const need = Math.max(H * Math.sin(pitch * Math.PI / 180) * 1.12 / t2, W * 1.08 / t2 / aspect);
    const to = { yaw: 0, pitch, dist: need, tx: W / 2, ty: 1, tz: H / 2 + H * 0.04 };
    if (animate) animateTo(to, 700); else Object.assign(view, to);
  }
  function focusTile(i, j, lw = 1) { animateTo({ tx: (i + lw / 2) * TILE, ty: 2, tz: (j + 0.5) * TILE, dist: 34, pitch: Math.min(view.pitch, 32) }, 700); }
  function resize() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();

  // Gestures: one finger orbits, two pinch to zoom, and a quick touch without movement is a tap.
  const ptr = new Map(); let lastPinch = 0, moved = 0, downAt = 0, downPos = null;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); if (ptr.size === 1) { moved = 0; downAt = performance.now(); downPos = [e.clientX, e.clientY]; anim.to = null; } });
  function up(e) { ptr.delete(e.pointerId); lastPinch = 0; if (ptr.size === 0 && downPos && moved < 8 && performance.now() - downAt < 450) tap(downPos[0], downPos[1]); downPos = null; }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return; const prev = ptr.get(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); moved += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
    if (ptr.size === 1) {
      if (e.shiftKey || e.buttons === 2) { view.yaw -= (e.clientX - prev[0]) * 0.4; view.pitch = Math.max(10, Math.min(85, view.pitch + (e.clientY - prev[1]) * 0.3)); }
      else { // pan on the ground, in camera space
        const y = view.yaw * Math.PI / 180, k = view.dist / (canvas.clientHeight || 600) * 1.6; const dx = -(e.clientX - prev[0]) * k, dz = -(e.clientY - prev[1]) * k / Math.max(0.35, Math.sin(view.pitch * Math.PI / 180));
        view.tx += dx * Math.cos(y) + dz * Math.sin(y); view.tz += -dx * Math.sin(y) + dz * Math.cos(y);
      }
    } else if (ptr.size === 2) {
      const [a, b] = [...ptr.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (lastPinch) view.dist = Math.max(10, Math.min(260, view.dist * lastPinch / d)); lastPinch = d;
      const ang = Math.atan2(a[1] - b[1], a[0] - b[0]); if (ptr.lastAng != null) { let da = ang - ptr.lastAng; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; view.yaw -= da * 180 / Math.PI; } ptr.lastAng = ang;
      const my = (a[1] + b[1]) / 2; if (ptr.lastMy != null) view.pitch = Math.max(10, Math.min(85, view.pitch + (my - ptr.lastMy) * 0.25)); ptr.lastMy = my;
    }
  });
  canvas.addEventListener('pointerup', () => { ptr.lastAng = null; ptr.lastMy = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.dist = Math.max(10, Math.min(260, view.dist * (1 + e.deltaY * 0.0012))); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const ray = new T.Raycaster();
  function tap(px, py) {
    const r = canvas.getBoundingClientRect(); const v = new T.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, cam); const hit = ray.intersectObjects(tappable, false)[0];
    if (hit) { const b = hit.object.userData.building; send({ type: 'tap', district: hit.object.userData.district, kind: b.kind, i: b.i, j: b.j, projectId: b.projectId || null }); return; }
    // the ground: which tile
    const g = new T.Plane(new T.Vector3(0, 1, 0), -0.16); const pt = new T.Vector3(); if (ray.ray.intersectPlane(g, pt)) send({ type: 'tap', district: null, i: Math.floor(pt.x / TILE), j: Math.floor(pt.z / TILE) });
  }

  // ---------------- quality: steps down by itself when frames are slow ----------------
  const quality = { level: 3, lights: true };
  let slow = 0, frames = 0, tAcc = 0;
  function applyQuality() {
    if (quality.level === 3) { R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; sun.shadow.mapSize.set(4096, 4096); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); quality.lights = true; }
    else if (quality.level === 2) { R.shadowMap.enabled = true; R.shadowMap.type = T.PCFShadowMap; sun.shadow.mapSize.set(2048, 2048); R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); quality.lights = true; }
    else { R.shadowMap.enabled = false; R.setPixelRatio(1); quality.lights = false; }
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    setNight(night); resize(); send({ type: 'quality', level: quality.level });
  }
  let last = performance.now();
  function loop(now) {
    const dt = now - last; last = now;
    if (state) { frames++; tAcc += dt; if (dt > 40) slow++; if (tAcc > 3000) { if (slow > frames * 0.4 && quality.level > 1 && quality.auto !== false) { quality.level--; applyQuality(); } slow = 0; frames = 0; tAcc = 0; } }
    place(); R.render(scene, cam); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------------- public API ----------------
  window.sky = {
    setState(s) { if (typeof s === 'string') s = JSON.parse(s); if (s.quality) { quality.auto = s.quality === 'auto'; if (s.quality === 'low') { quality.level = 1; applyQuality(); } else if (s.quality === 'high') { quality.level = 3; applyQuality(); } } build(s); },
    setNight(on) { setNight(!!on); },
    top() { top(true); send({ type: 'camera', top: true }); },
    focus(i, j, lw) { focusTile(i, j, lw || 1); },
    street(i, j) { animateTo({ tx: (i + 0.5) * TILE, ty: 1.5, tz: (j + 0.5) * TILE, pitch: 12, dist: 14 }, 800); },
    snapshot() { place(); R.render(scene, cam); return canvas.toDataURL('image/jpeg', 0.85); },
  };
  function handle(d) { if (!d || typeof d !== 'object') return; if (d.type === 'state') window.sky.setState(d.state); else if (d.type === 'top') window.sky.top(); else if (d.type === 'focus') window.sky.focus(d.i, d.j, d.lw); else if (d.type === 'street') window.sky.street(d.i, d.j); else if (d.type === 'night') window.sky.setNight(d.on); }
  window.sky.msg = handle;
  addEventListener('message', e => handle(e.data));
  send({ type: 'ready' });
})();
