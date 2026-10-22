'use strict';
// Isometric rooms, drawn as inline SVG from boxes, flat quads and cylinders.
// A room floor is 10×10 world units with z pointing up; one unit is S px.
// Rooms sit on a 2×2 grid D units apart; the map and each room share one projection.

const Iso = (() => {
  const S = 20, C = Math.cos(Math.PI / 6), WALL = 4.5, D = 19;
  // Pads for missions 1–4 sit in the front-right quarter of every room.
  const PADS = [[6.0, 6.0], [7.9, 6.0], [6.0, 7.9], [7.9, 7.9]];
  // Room 1 left, 2 back, 3 right, 4 front: a clockwise climb that ends closest to you.
  const GRID = [[0, 1], [0, 0], [1, 0], [1, 1]];
  // Room art box and stage, in projected px around the room / map origin.
  const ART = {x: -195, y: -125, w: 390, h: 375};
  const STAGE = {x: -540, y: -195, w: 1080, h: 840};
  let uid = 0;

  const pt = (x, y, z = 0) => [(x - y) * C * S, (x + y) * S / 2 - z * S];
  const f = n => +n.toFixed(1);
  const pts = list => list.map(p => pt(...p).map(f).join(',')).join(' ');
  const hsl = (c, dl = 0, a = 1) => `hsla(${c[0]},${c[1]}%,${Math.max(0, Math.min(100, c[2] + dl))}%,${a})`;
  const attr = cls => cls ? ` class="${cls}"` : '';
  const poly = (list, fill, cls) => `<polygon points="${pts(list)}" fill="${fill}"${attr(cls)}/>`;

  // Solid box from (x,y,z) sized w×d×h. Only the three camera-facing sides are drawn.
  function box(x, y, z, w, d, h, c, cls) {
    const X = x + w, Y = y + d, Z = z + h;
    return `<g${attr(cls)}>`
      + poly([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]], hsl(c))
      + poly([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]], hsl(c, -9))
      + poly([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]], hsl(c, 10))
      + '</g>';
  }
  // Flat quads: on a floor at height z, on a plane facing +y, on a plane facing +x.
  const flat = (x0, y0, x1, y1, z, fill, cls) => poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill, cls);
  const faceY = (y, x0, z0, x1, z1, fill, cls) => poly([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], fill, cls);
  const faceX = (x, y0, z0, y1, z1, fill, cls) => poly([[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], fill, cls);

  function cyl(cx, cy, z, r, h, c) {
    const [ax, ay] = pt(cx, cy, z), by = pt(cx, cy, z + h)[1];
    const rx = f(r * S * 1.2247), ry = f(r * S * 0.7071);
    return `<path d="M${f(ax - rx)},${f(ay)} A${rx},${ry} 0 0 0 ${f(ax + rx)},${f(ay)} L${f(ax + rx)},${f(by)} L${f(ax - rx)},${f(by)} Z" fill="${hsl(c, -6)}"/>`
      + `<ellipse cx="${f(ax)}" cy="${f(by)}" rx="${rx}" ry="${ry}" fill="${hsl(c, 10)}"/>`;
  }
  const path = (list, stroke, width, cls) =>
    `<polyline points="${pts(list)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${attr(cls)}/>`;
  const dot = (p, r, fill, cls) => { const [x, y] = pt(...p); return `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${fill}"${attr(cls)}/>`; };

  // ------------------------------------------------------------ the four rooms

  const BOOKS = [[4, 70, 55], [205, 70, 55], [45, 85, 58], [150, 45, 45], [280, 45, 60]];

  const THEMES = [
    { // 1 · The Silicon Citadel: an engineer's workbench
      floor: [222, 26, 30], wall: [224, 24, 40], slab: [226, 30, 19], accent: [42, 95, 60],
      props(g) {
        let s = faceY(0, 1.6, 1.7, 3.9, 3.8, hsl([224, 25, 24]))
          + faceY(0.01, 1.75, 1.85, 3.75, 3.65, hsl([200, 75, 62], 0, .55))
          + path([[2.75, 0.02, 1.85], [2.75, 0.02, 3.65]], hsl([224, 25, 24]), 2)
          + path([[1.75, 0.02, 2.75], [3.75, 0.02, 2.75]], hsl([224, 25, 24]), 2);
        s += box(0, 1.2, 0, 1, 3, 3.4, [26, 32, 34]);
        for (let r = 0; r < 3; r++) for (let b = 0; b < 7; b++) {
          s += faceX(1.01, 1.4 + b * 0.38, 0.35 + r * 1.05, 1.66 + b * 0.38, 1.0 + r * 1.05 - (b % 3) * 0.08, hsl(BOOKS[(b + r) % 5]));
        }
        s += box(4.2, 0.3, 0, 4.6, 1.7, 1.5, [220, 16, 24]);
        s += box(5.0, 0.6, 1.5, 2.4, 0.2, 1.6, [222, 20, 14]);
        s += faceY(0.81, 5.12, 1.65, 7.28, 2.98, hsl([215, 60, 13]));
        const code = [[0, 1.2, [42, 95, 62]], [0.3, 1.5, [195, 85, 62]], [0.3, 0.9, [280, 70, 72]], [0.6, 1.1, [195, 85, 62]], [0, 0.7, [42, 95, 62]]];
        s += `<g${g}>` + code.map(([ind, len, c], j) => faceY(0.82, 5.3 + ind, 2.72 - j * 0.22, 5.3 + ind + len, 2.82 - j * 0.22, hsl(c), 'pulse d' + j)).join('') + '</g>';
        s += box(7.7, 0.5, 1.5, 0.9, 0.9, 0.75, [215, 10, 62]);
        s += faceY(1.41, 7.78, 1.62, 8.52, 2.12, hsl([150, 70, 14]));
        const wave = [...Array(9).keys()].map(i => [7.83 + i * 0.08, 1.42, 1.87 + 0.15 * Math.sin(i * 0.9)]);
        s += `<g${g}>` + path(wave, hsl([140, 90, 60]), 1.2) + '</g>';
        s += box(5.8, 2.4, 0, 1.1, 1.1, 0.75, [222, 45, 46]) + box(5.8, 3.3, 0.75, 1.1, 0.2, 1.1, [222, 45, 46]);
        s += box(1.4, 5.8, 0, 3, 3, 0.3, [225, 15, 14]);
        for (let i = 0; i < 6; i++) {
          s += flat(1.6 + i * 0.48, 8.85, 1.82 + i * 0.48, 9.3, 0.01, hsl([45, 70, 55]));
          s += flat(4.45, 6.0 + i * 0.48, 4.9, 6.22 + i * 0.48, 0.01, hsl([45, 70, 55]));
        }
        s += flat(1.75, 6.15, 4.05, 8.45, 0.31, hsl([225, 15, 20]));
        s += `<g${g}>` + flat(2.25, 6.65, 3.55, 7.95, 0.32, hsl([42, 95, 60]), 'pulse') + '</g>';
        s += box(8.7, 2.6, 0, 0.8, 0.8, 0.7, [18, 45, 45]);
        const [lx, ly] = pt(9.1, 3.0, 1.3);
        s += [[0, 0, 11], [-7, 3, 8], [7, 2, 8], [0, -7, 7]].map(([dx, dy, r]) =>
          `<circle cx="${f(lx + dx)}" cy="${f(ly + dy)}" r="${r}" fill="${hsl([140, 45, 38 + r])}"/>`).join('');
        return s;
      },
    },
    { // 2 · The Nexus Grid: a server room
      floor: [200, 30, 20], wall: [198, 24, 30], slab: [205, 35, 13], accent: [160, 85, 50],
      props(g) {
        let s = '';
        const leds = (face, a0, a1, z, k) => face(a0, z, a1, z + 0.38, hsl([210, 25, 9]))
          + `<g${g}>` + face(a1 - 0.35, z + 0.12, a1 - 0.17, z + 0.26, hsl(k % 4 ? [160, 85, 55] : [40, 95, 60]), 'led d' + k % 5) + '</g>';
        s += box(0.2, 2.6, 0, 1.5, 3.4, 3.4, [210, 20, 16]);
        for (let r = 0; r < 5; r++) s += leds((a, z0, b, z1, c, cls) => faceX(1.71, a, z0, b, z1, c, cls), 2.75, 5.85, 0.4 + r * 0.58, r + 2);
        for (let i = 0; i < 3; i++) {
          const x0 = 2.0 + i * 2.5;
          s += box(x0, 0.2, 0, 1.9, 1.5, 4, [210, 20, 16]);
          for (let r = 0; r < 6; r++) s += leds((a, z0, b, z1, c, cls) => faceY(1.71, a, z0, b, z1, c, cls), x0 + 0.15, x0 + 1.75, 0.45 + r * 0.58, i * 6 + r);
        }
        s += path([[3.0, 1.75, 0.02], [3.0, 6.4, 0.02], [3.3, 6.6, 0.02]], hsl([160, 85, 50], 0, .25), 3);
        s += `<g${g}>` + path([[3.0, 1.75, 0.02], [3.0, 6.4, 0.02], [3.3, 6.6, 0.02]], hsl([160, 85, 55]), 1.4, 'flow')
          + path([[5.5, 1.75, 0.02], [5.5, 4.2, 0.02], [4.2, 5.9, 0.02]], hsl([160, 85, 55]), 1.4, 'flow d2') + '</g>';
        for (let i = 0; i < 3; i++) {
          s += cyl(3.4, 7.2, i * 0.75, 1.05, 0.6, [200, 18, 62]);
          const [cx, cy] = pt(3.4, 7.2, i * 0.75 + 0.6);
          s += `<g${g}><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(1.05 * S * 1.2247 - 4)}" ry="${f(1.05 * S * 0.7071 - 2.4)}" fill="none" stroke="${hsl([160, 85, 55])}" stroke-width="1.2" class="pulse d${i}"/></g>`;
        }
        return s;
      },
    },
    { // 3 · The Vector Vault: an archive with embeddings floating overhead
      floor: [262, 26, 22], wall: [260, 22, 32], slab: [265, 30, 13], accent: [290, 85, 68],
      props(g, n) {
        let s = box(0, 0.5, 0, 1, 4.6, 4.2, [255, 22, 22]);
        for (let r = 0; r < 4; r++) for (let b = 0; b < 11; b++) {
          s += faceX(1.01, 0.7 + b * 0.38, 0.3 + r * 1.0, 0.96 + b * 0.38, 0.95 + r * 1.0 - (b % 4) * 0.07, hsl([[290, 60, 62], [190, 70, 55], [255, 50, 68], [330, 60, 62]][(b + r) % 4]));
        }
        s += box(1.6, 0, 0, 4.2, 1, 4.2, [255, 22, 22]);
        for (let r = 0; r < 4; r++) for (let b = 0; b < 10; b++) {
          s += faceY(1.01, 1.8 + b * 0.38, 0.3 + r * 1.0, 2.06 + b * 0.38, 0.95 + r * 1.0 - ((b + 1) % 4) * 0.07, hsl([[190, 70, 55], [290, 60, 62], [330, 60, 62], [255, 50, 68]][(b + r) % 4]));
        }
        s += cyl(3.4, 6.8, 0, 0.8, 1.0, [260, 16, 46]);
        const stars = [[1.8, 3.2, 5.6], [4.4, 2.2, 5.0], [6.6, 3.6, 5.8], [3.6, 4.6, 6.6], [8.4, 1.6, 4.8], [7.6, 5.2, 6.3]];
        const links = [[0, 1], [1, 2], [0, 3], [3, 2], [2, 4], [2, 5], [3, 5]];
        s += `<g class="float slow">` + links.map(([a, b]) => path([stars[a], stars[b]], hsl([190, 90, 70], 0, .35), 1)).join('')
          + path([[3.4, 6.8, 2.4], stars[3]], hsl([290, 85, 75], 0, .4), 1, 'dash')
          + `<g${g}>` + stars.map((p, i) => dot(p, 2.6, hsl([190, 90, 70]), 'twinkle d' + i % 5)).join('') + '</g></g>';
        const [ox, oy] = pt(3.4, 6.8, 2.4);
        s += `<g class="float"><circle cx="${f(ox)}" cy="${f(oy)}" r="22" fill="url(#halo${n})"/>`
          + `<circle cx="${f(ox)}" cy="${f(oy)}" r="11" fill="url(#orb${n})"${g}/></g>`;
        return s;
      },
    },
    { // 4 · The Production Forge: containers, a conveyor and your agent
      floor: [22, 22, 22], wall: [20, 20, 32], slab: [18, 28, 13], accent: [190, 90, 58],
      props(g) {
        let s = faceX(0.01, 1.2, 1.3, 5.0, 3.9, hsl([215, 40, 11]));
        s += `<g${g}>` + [1.0, 1.6, 1.25, 2.1, 1.8].map((h, i) => faceX(0.02, 1.6 + i * 0.68, 1.6, 1.98 + i * 0.68, 1.6 + h * 0.95, hsl([190, 90, 58], 0, .85), 'pulse d' + i)).join('') + '</g>';
        s += box(1.4, 0.3, 0, 4, 1.7, 1.8, [210, 55, 40]);
        for (let i = 0; i < 8; i++) s += faceY(2.01, 1.6 + i * 0.47, 0.15, 1.72 + i * 0.47, 1.65, hsl([210, 55, 32]));
        s += box(1.7, 0.4, 1.8, 3.4, 1.5, 1.4, [8, 58, 46]);
        for (let i = 0; i < 7; i++) s += faceY(1.91, 1.9 + i * 0.45, 1.95, 2.02 + i * 0.45, 3.05, hsl([8, 58, 38]));
        s += box(6.3, 0.5, 0, 3.4, 1.3, 0.7, [220, 8, 26]);
        for (let i = 0; i < 6; i++) s += flat(6.45 + i * 0.55, 0.55, 6.6 + i * 0.55, 1.75, 0.71, hsl([220, 8, 34]));
        s += box(6.7, 0.75, 0.7, 0.75, 0.75, 0.6, [32, 45, 56]) + box(8.3, 0.75, 0.7, 0.75, 0.75, 0.6, [32, 45, 56]);
        const metal = [214, 12, 66];
        s += box(2.75, 6.6, 0, 0.35, 0.35, 0.9, metal) + box(3.45, 6.6, 0, 0.35, 0.35, 0.9, metal);
        s += box(2.35, 6.5, 1.3, 0.25, 0.4, 0.8, metal);
        s += box(2.6, 6.2, 0.9, 1.4, 1.1, 1.3, metal);
        s += `<g${g}>` + faceY(7.31, 3.0, 1.35, 3.6, 1.75, hsl([28, 95, 58]), 'pulse') + '</g>';
        s += box(4.0, 6.5, 1.3, 0.25, 0.4, 0.8, metal);
        s += box(2.75, 6.3, 2.2, 1.1, 0.9, 0.8, [214, 12, 72]);
        s += faceY(7.21, 2.88, 2.38, 3.72, 2.8, hsl([215, 40, 11]));
        s += `<g${g}>` + faceY(7.22, 3.0, 2.52, 3.2, 2.66, hsl([190, 90, 62]), 'blink')
          + faceY(7.22, 3.4, 2.52, 3.6, 2.66, hsl([190, 90, 62]), 'blink') + '</g>';
        s += path([[3.3, 6.75, 3.0], [3.3, 6.75, 3.55]], hsl(metal), 1.2);
        s += `<g${g}>` + dot([3.3, 6.75, 3.6], 2.2, hsl([28, 95, 60]), 'led d1') + '</g>';
        return s;
      },
    },
  ];

  // progress: {pads: [bool×4], next: index of the active mission or -1, cleared: bool}
  function room(w, progress = {pads: [], next: -1, cleared: false}) {
    const t = THEMES[w - 1], n = ++uid, g = ` filter="url(#glow${n})"`, accent = hsl(t.accent);
    let s = `<svg class="iso" viewBox="${ART.x} ${ART.y} ${ART.w} ${ART.h}" aria-hidden="true" focusable="false">
      <defs>
        <filter id="glow${n}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="soft${n}" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>
        <radialGradient id="orb${n}" cx="38%" cy="35%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${hsl([290, 90, 78])}"/><stop offset="1" stop-color="${hsl([265, 80, 45])}"/></radialGradient>
        <radialGradient id="halo${n}"><stop offset="0" stop-color="${hsl([290, 90, 70], 0, .55)}"/><stop offset="1" stop-color="${hsl([290, 90, 70], 0, 0)}"/></radialGradient>
        <linearGradient id="beam${n}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${hsl(t.accent, 0, .45)}"/><stop offset="1" stop-color="${hsl(t.accent, 0, 0)}"/></linearGradient>
      </defs>
      <ellipse class="shadow" cx="0" cy="226" rx="176" ry="44" filter="url(#soft${n})"/>
      <g class="lift">`;
    s += box(-0.4, -0.4, -1.6, 10.8, 10.8, 1.6, t.slab);
    s += flat(0, 0, 10, 10, 0, hsl(t.floor));
    for (let i = 2; i < 10; i += 2) {
      s += path([[i, 0, 0], [i, 10, 0]], hsl(t.floor, 7, .55), 0.7) + path([[0, i, 0], [10, i, 0]], hsl(t.floor, 7, .55), 0.7);
    }
    s += flat(0.2, 0.2, 9.8, 9.8, 0.005, 'none', 'ring');
    s += box(-0.4, -0.4, 0, 10.4, 0.4, WALL, t.wall) + box(-0.4, 0, 0, 0.4, 10, WALL, t.wall);
    s += `<g${g} class="seam">` + path([[10, 0.02, 0.04], [0.02, 0.02, 0.04], [0.02, 10, 0.04]], hsl(t.accent, 0, .7), 1.2)
      + path([[10, -0.4, WALL], [-0.4, -0.4, WALL], [-0.4, 10, WALL]], hsl(t.accent, 0, .35), 1) + '</g>';
    s += PADS.map(([x, y], i) => {
      const on = progress.pads[i], next = i === progress.next;
      const pad = flat(x, y, x + 1.4, y + 1.4, 0.02, on ? accent : hsl(t.floor, 6), on ? 'pad on' : 'pad');
      const edge = `<polygon points="${pts([[x, y, 0.03], [x + 1.4, y, 0.03], [x + 1.4, y + 1.4, 0.03], [x, y + 1.4, 0.03]])}" fill="none" stroke="${accent}" stroke-width="1" stroke-opacity="${on ? 1 : 0.35}"${next ? ' class="pad-next"' : ''}/>`;
      return on || next ? `<g${g}>${pad}${edge}</g>` : pad + edge;
    }).join('');
    s += t.props(g, n);
    if (progress.cleared) {
      const [cx, cy] = pt(7.6, 7.6, 2.6), [bx, by] = pt(7.6, 7.6, 0);
      s += `<polygon points="${f(bx - 30)},${f(by)} ${f(bx + 30)},${f(by)} ${f(cx + 12)},${f(cy - 70)} ${f(cx - 12)},${f(cy - 70)}" fill="url(#beam${n})" class="pulse"/>`
        + `<g class="float"${g}><polygon points="${f(cx)},${f(cy - 18)} ${f(cx + 10)},${f(cy)} ${f(cx)},${f(cy + 18)} ${f(cx - 10)},${f(cy)}" fill="${accent}"/>`
        + `<polygon points="${f(cx)},${f(cy - 18)} ${f(cx + 10)},${f(cy)} ${f(cx)},${f(cy + 18)}" fill="#fff" opacity=".35"/></g>`;
    }
    s += `<polygon class="hit" points="${pts([[-0.4, -0.4, WALL], [10, -0.4, WALL], [10.4, -0.4, -1.6], [10.4, 10.4, -1.6], [-0.4, 10.4, -1.6], [-0.4, 10, WALL]])}" fill="transparent"/>`;
    return s + '</g></svg>';
  }

  // ------------------------------------------------------------ the map

  const origin = w => { const [gx, gy] = GRID[w - 1]; return pt(gx * D, gy * D); };
  const pct = (v, start, size) => f((v - start) / size * 100) + '%';

  // Where a room's art sits on the stage, as CSS percentages.
  function place(w) {
    const [ox, oy] = origin(w);
    return {left: pct(ox + ART.x, STAGE.x, STAGE.w), top: pct(oy + ART.y, STAGE.y, STAGE.h),
      width: f(ART.w / STAGE.w * 100) + '%', height: f(ART.h / STAGE.h * 100) + '%'};
  }

  // Label anchors (centre x, top y) chosen to sit in the empty space around each room.
  function labelAt(w) {
    const [x, y] = [[-400, 10], [0, -185], [400, 10], [400, 470]][w - 1];
    return {left: pct(x, STAGE.x, STAGE.w), top: pct(y, STAGE.y, STAGE.h)};
  }

  // Walkway from room w to room w + 1. `lit` once the next room is open.
  function bridge(w, lit) {
    const [[ax, ay], [bx, by]] = [GRID[w - 1], GRID[w]];
    const n = ++uid, c = THEMES[w].accent;
    const [x, y, len] = ax === bx ? [ax * D + 4, Math.min(ay, by) * D + 10.4, D - 10.8] : [Math.min(ax, bx) * D + 10.4, ay * D + 4, D - 10.8];
    const along = ax === bx;
    const [w2, d2] = along ? [2, len] : [len, 2];
    const mid = along ? [[x + 1, y, -0.42], [x + 1, y + len, -0.42]] : [[x, y + 1, -0.42], [x + len, y + 1, -0.42]];
    return `<svg class="bridge ${lit ? 'lit' : ''}" style="--z:${2 + 2 * Math.min(ax + ay, bx + by)}" viewBox="${STAGE.x} ${STAGE.y} ${STAGE.w} ${STAGE.h}" aria-hidden="true" focusable="false">
      <defs><filter id="glow${n}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      ${box(x, y, -1.0, w2, d2, 0.55, [225, 20, lit ? 22 : 16])}
      <g filter="url(#glow${n})">${path(mid, hsl(c, 0, lit ? .3 : .08), 3)}${lit ? path(mid, hsl(c), 1.4, 'flow') : ''}</g>
    </svg>`;
  }

  const accent = w => hsl(THEMES[w - 1].accent);
  return {room, bridge, place, labelAt, accent};
})();
