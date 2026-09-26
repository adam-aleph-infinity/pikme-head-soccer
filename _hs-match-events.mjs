// Tracks (_hs-track-match.mjs) → Idan's kicks, in world units, ready to re-stage in our sim.
//   node _hs-match-events.mjs [M1 … M5 | all] [--list]
//
// A KICK is: the KICK plaque lights (the press, frame-exact), and within the swing (0.3 s) the
// ball's velocity jumps (a contact, tools/hs-fit-lib.mjs detectContacts) with the ball IN FRONT of
// the human — the human attacks right in every match, so in front is +x — close enough for the
// boot to reach it. For each: where the ball was relative to his feet when he pressed and what it
// was doing, what his body was doing, and how the ball left.
import { readFileSync } from 'node:fs';
import { series, detectContacts, polyfit, launch, median } from './tools/hs-fit-lib.mjs';

const lit = {
  K: ([r, g, b]) => (r + g) / 2 > 145 && b < 75,
  J: ([r, g, b]) => (r + g) / 2 > 170 && b < 70,
  L: ([r, g, b]) => (r + g) / 2 > 190 && b < 60,
  R: ([r, g, b]) => (r + g) / 2 > 190 && b < 60,
};

export function load(name) {
  const d = JSON.parse(readFileSync(`docs/hs-clips/${name}.raw.json`, 'utf8'));
  const c = d.calib;
  const wx = (x) => (x - c.wallL) * c.s, wy = (y) => c.groundY + (y - c.ground) * c.s;
  const frames = d.frames.map((f) => ({
    i: f.i, t: f.t, dup: f.dup,
    ball: f.ball && { x: wx(f.ball.x), y: wy(f.ball.y) },
    p0: f.f[0] && { x: wx(f.f[0].x), y: wy(f.f[0].y) },
    p1: f.f[1] && { x: wx(f.f[1].x), y: wy(f.f[1].y) },
    btn: f.btn,
  }));
  const presses = {};
  for (const key in lit) {
    presses[key] = [];
    let prev = false;
    for (const f of frames) {
      const v = lit[key](f.btn[key]);
      if (v && !prev) presses[key].push({ t: f.t, i: f.i });
      if (!v && prev && presses[key].length) presses[key][presses[key].length - 1].up = f.t;
      prev = v;
    }
  }
  // standing face height: the face centroid of a player on the grass
  const ys = frames.flatMap((f) => [f.p0?.y, f.p1?.y]).filter((y) => y != null && y > 380).sort((a, b) => a - b);
  const standY = ys[Math.floor(ys.length * 0.7)];
  return { name, frames, presses, standY };
}

// The body of player q around time t: position, velocity, height (a line fit over ±3 frames).
function body(M, q, t) {
  const S = M.frames.filter((f) => !f.dup && f['p' + q] && Math.abs(f.t - t) <= 0.055);
  if (S.length < 4) return null;
  const fx = polyfit(S.map((f) => f.t), S.map((f) => f['p' + q].x), 1, t);
  const fy = polyfit(S.map((f) => f.t), S.map((f) => f['p' + q].y), 1, t);
  if (!fx || !fy) return null;
  return { x: fx.c[0], vx: fx.c[1], face: fy.c[0], vy: fy.c[1], air: M.standY - fy.c[0] };
}

export function kicks(M) {
  const ball = series(M.frames, 'ball');
  const cs = [...new Set([...detectContacts(ball, { axis: 'y', minDv: 200 }), ...detectContacts(ball, { axis: 'x', minDv: 200 })])].sort((a, b) => a - b);
  const contacts = [];
  for (const t of cs) if (!contacts.length || t - contacts[contacts.length - 1] > 0.05) contacts.push(t);
  const out = [];
  for (const tc of contacts) {
    const press = M.presses.K.filter((p) => p.t <= tc + 0.02 && p.t > tc - 0.30).pop();
    if (!press) continue;
    // the ball when he pressed, and its velocity then (a parabola over the frames before)
    const pre = ball.filter((p) => p.t <= press.t + 1e-6 && p.t > press.t - 0.12);
    if (pre.length < 4) continue;
    const bp = pre[pre.length - 1];
    const fx = polyfit(pre.map((p) => p.t), pre.map((p) => p.x), 1, press.t);
    const fy = polyfit(pre.map((p) => p.t), pre.map((p) => p.y), 2, press.t);
    if (!fx || !fy) continue;
    // the kicker: the player the ball is in front of (+x for the human), nearest
    let kick = null;
    for (const q of [0, 1]) {
      const B = body(M, q, press.t);
      if (!B) continue;
      const dx = fx.c[0] - B.x;
      if (dx < -5 || dx > 95) continue;
      if (!kick || Math.abs(dx) < Math.abs(kick.dx)) kick = { q, B, dx };
    }
    if (!kick) continue;
    const l = launch(ball, tc, { n: 7 });
    if (!l) continue;
    const feetY = kick.B.face + (435 - M.standY);                    // the shoe line under the face
    // AT THE CONTACT: the ball against the kicker then — it must be where a boot can be (ahead
    // of the body, between the grass and just over the head), and leave forward or up (a ball
    // leaving downward off a boot-height contact is a bounce off the grass, not the boot).
    const Bc = body(M, kick.q, tc);
    const last = ball.filter((p) => p.t <= tc + 1e-6).pop();
    if (!Bc || !last) continue;
    const cdx = last.x - Bc.x, cup = Bc.face + (435 - M.standY) - last.y;
    const ok = cdx > 5 && cdx < 85 && cup > -5 && cup < 100 && l.vy < 100 && l.speed > 150 && kick.B.air < 60 && kick.B.air > -8;
    out.push({
      clip: M.name, press: +press.t.toFixed(3), contact: +tc.toFixed(3), phase: +(tc - press.t).toFixed(3),
      // the ball at the press, relative to his feet: ahead, and up off the shoe line
      dx: +(fx.c[0] - kick.B.x).toFixed(1), up: +(feetY - fy.c[0]).toFixed(1),
      bvx: +fx.c[1].toFixed(0), bvy: +fy.c[1].toFixed(0),
      air: +kick.B.air.toFixed(1), pvx: +kick.B.vx.toFixed(0), pvy: +kick.B.vy.toFixed(0),
      out: [+l.vx.toFixed(0), +l.vy.toFixed(0)], speed: +l.speed.toFixed(0), angle: +l.angle.toFixed(1),
      cdx: +cdx.toFixed(1), cup: +cup.toFixed(1), ok,
    });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const want = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'all';
  const all = [];
  for (const name of want === 'all' ? ['M1', 'M2', 'M3', 'M4', 'M5'] : [want]) {
    const M = load(name);
    const K = kicks(M);
    console.log(`${name}: ${M.presses.K.length} KICK presses, ${K.length} kicks on the ball (standing face ${M.standY.toFixed(0)})`);
    all.push(...K);
  }
  if (process.argv.includes('--list')) for (const e of all) console.log(JSON.stringify(e));
}
