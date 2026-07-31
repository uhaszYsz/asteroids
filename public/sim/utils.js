/** @file server/utils.js — loaded into shared server scope (do not require() alone). */
function wrap(o) {
  if (o.x < 0) o.x += W; if (o.x > W) o.x -= W;
  if (o.y < 0) o.y += H; if (o.y > H) o.y -= H;
}

function clampSpeed(o) {
  const cap = o.stunned ? STUN_MAX_SPEED : MAX_SPEED;
  const s = Math.hypot(o.vx, o.vy);
  if (s > cap) {
    o.vx = o.vx / s * cap;
    o.vy = o.vy / s * cap;
  }
}

/** Soft speed limit for ships: decelerate toward MAX_SPEED instead of hard clipping. */
function limitPlayerSpeed(o) {
  const s = Math.hypot(o.vx, o.vy);
  if (s < 1e-8) return;
  if (o.stunned) {
    if (s > STUN_MAX_SPEED) {
      o.vx = o.vx / s * STUN_MAX_SPEED;
      o.vy = o.vy / s * STUN_MAX_SPEED;
    }
    return;
  }
  if (s <= MAX_SPEED) return;
  const next = Math.max(MAX_SPEED, s - OVERSPEED_DECEL / TPS);
  const scale = next / s;
  o.vx *= scale;
  o.vy *= scale;
}

/** Shortest signed delta from a → b in (-π, π]. */
function angleDeltaToward(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function turnAngleToward(from, to, maxTurn) {
  const d = angleDeltaToward(from, to);
  if (d > maxTurn) return from + maxTurn;
  if (d < -maxTurn) return from - maxTurn;
  return from + d;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function torusDistSq(x1, y1, x2, y2) {
  let dx = Math.abs(x1 - x2);
  let dy = Math.abs(y1 - y2);
  if (dx > W / 2) dx = W - dx;
  if (dy > H / 2) dy = H - dy;
  return dx * dx + dy * dy;
}

function wrapDelta(dx, dy) {
  if (Math.abs(dx) > W / 2) dx = dx > 0 ? dx - W : dx + W;
  if (Math.abs(dy) > H / 2) dy = dy > 0 ? dy - H : dy + H;
  return { dx, dy };
}

function hitCircleCircle(x1, y1, r1, x2, y2, r2, torus) {
  const rr = r1 + r2;
  if (torus) return torusDistSq(x1, y1, x2, y2) < rr * rr;
  const dx = x1 - x2, dy = y1 - y2;
  return dx * dx + dy * dy < rr * rr;
}

function hitEllipseCircle(ex, ey, rx, ry, angle, cx, cy, cr, torus) {
  let dx = cx - ex, dy = cy - ey;
  if (torus) ({ dx, dy } = wrapDelta(dx, dy));
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  const rx2 = rx + cr, ry2 = ry + cr;
  return (lx / rx2) ** 2 + (ly / ry2) ** 2 <= 1;
}

function hitLineCircle(lx, ly, length, width, angle, cx, cy, cr, torus) {
  let dx = cx - lx, dy = cy - ly;
  if (torus) ({ dx, dy } = wrapDelta(dx, dy));
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const px = dx * c - dy * s;
  const py = dx * s + dy * c;
  const hL = length / 2, hW = width / 2;
  const qx = Math.max(-hL, Math.min(hL, px));
  const qy = Math.max(-hW, Math.min(hW, py));
  const ddx = px - qx, ddy = py - qy;
  return ddx * ddx + ddy * ddy < cr * cr;
}

function leadInterceptAngle(ox, oy, tx, ty, tvx, tvy, speed) {
  // Euclidean only — no torus / edge-teleport shortcuts (turrets, UFO, etc.).
  return leadInterceptFromDelta(tx - ox, ty - oy, tvx, tvy, speed);
}

/** @deprecated alias — same as leadInterceptAngle (flat). */
function leadInterceptAngleFlat(ox, oy, tx, ty, tvx, tvy, speed) {
  return leadInterceptAngle(ox, oy, tx, ty, tvx, tvy, speed);
}

function leadInterceptFromDelta(dx, dy, tvx, tvy, speed) {
  // Solve |P + V t| = speed * t in relative frame from shooter.
  const a = tvx * tvx + tvy * tvy - speed * speed;
  const b = 2 * (dx * tvx + dy * tvy);
  const c = dx * dx + dy * dy;
  let t = null;
  if (Math.abs(a) < 1e-8) {
    if (Math.abs(b) > 1e-8) t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      const t1 = (-b - s) / (2 * a);
      const t2 = (-b + s) / (2 * a);
      if (t1 > 0.05) t = t1;
      if (t2 > 0.05 && (t == null || t2 < t)) t = t2;
    }
  }
  if (t == null || !(t > 0)) return Math.atan2(dy, dx);
  return Math.atan2(dy + tvy * t, dx + tvx * t);
}

function shortestWrapDelta(from, to, size) {
  let d = to - from;
  if (d > size * 0.5) d -= size;
  else if (d < -size * 0.5) d += size;
  return d;
}
