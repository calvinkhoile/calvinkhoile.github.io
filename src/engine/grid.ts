// Collision grid + A* pathfinding. Pure logic, no three.js, so it's unit-testable.
// 1 tile = 1 world unit. Tile (tx, tz) covers x in [tx, tx+1), z in [tz, tz+1).

export const TILE_BLOCKED = 1;
export const TILE_DOOR = 2;
export const TILE_INTERACT = 4;

export interface Point {
  x: number;
  z: number;
}

const EPS = 1e-4;

export class Grid {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = new Uint8Array(width * height);
  }

  inBounds(tx: number, tz: number): boolean {
    return tx >= 0 && tz >= 0 && tx < this.width && tz < this.height;
  }

  flags(tx: number, tz: number): number {
    return this.inBounds(tx, tz) ? this.cells[tz * this.width + tx] : TILE_BLOCKED;
  }

  /** Out-of-bounds counts as blocked. */
  isBlocked(tx: number, tz: number): boolean {
    return (this.flags(tx, tz) & TILE_BLOCKED) !== 0;
  }

  setFlag(tx: number, tz: number, flag: number, on = true): void {
    if (!this.inBounds(tx, tz)) return;
    const i = tz * this.width + tx;
    this.cells[i] = on ? this.cells[i] | flag : this.cells[i] & ~flag;
  }

  /** Stamp a rectangle given in world units (x, z = min corner). */
  stampRect(x: number, z: number, w: number, d: number, flag: number, on = true): void {
    const x0 = Math.floor(x + EPS);
    const z0 = Math.floor(z + EPS);
    const x1 = Math.ceil(x + w - EPS);
    const z1 = Math.ceil(z + d - EPS);
    for (let tz = z0; tz < z1; tz++) for (let tx = x0; tx < x1; tx++) this.setFlag(tx, tz, flag, on);
  }

  /** True if a circle at (x, z) overlaps any blocked tile. */
  circleBlocked(x: number, z: number, r: number): boolean {
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const z0 = Math.floor(z - r);
    const z1 = Math.floor(z + r);
    for (let tz = z0; tz <= z1; tz++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.isBlocked(tx, tz)) continue;
        const cx = Math.max(tx, Math.min(x, tx + 1));
        const cz = Math.max(tz, Math.min(z, tz + 1));
        const dx = x - cx;
        const dz = z - cz;
        if (dx * dx + dz * dz < r * r - EPS) return true;
      }
    }
    return false;
  }

  /**
   * Move a circle by (dx, dz) with axis separation: move X, resolve, move Z, resolve.
   * Hitting a wall kills only the blocked axis, so the circle slides along it.
   */
  moveCircle(pos: Point, dx: number, dz: number, r: number): Point {
    let { x, z } = pos;
    // Sub-step so a fast frame can never tunnel through a 1-tile wall.
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.25));
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) x = this.slideAxis(x, z, sx, r, true);
      if (sz !== 0) z = this.slideAxis(z, x, sz, r, false);
    }
    return { x, z };
  }

  private slideAxis(a: number, b: number, delta: number, r: number, isX: boolean): number {
    const blocked = (v: number) => (isX ? this.circleBlocked(v, b, r) : this.circleBlocked(b, v, r));
    const target = a + delta;
    if (!blocked(target)) return target;
    // Binary search for the furthest free position along this axis.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (blocked(a + delta * mid)) hi = mid;
      else lo = mid;
    }
    return a + delta * lo;
  }

  /**
   * Nearest non-blocked tile to (tx, tz), searching outward in rings.
   * With `prefer`, candidates on the side facing that point win, so clicking a building
   * walks you to the wall in front of you, not around the back.
   */
  nearestWalkable(tx: number, tz: number, maxRadius = 12, prefer?: Point): { tx: number; tz: number } | null {
    if (!this.isBlocked(tx, tz)) return { tx, tz };
    for (let rad = 1; rad <= maxRadius; rad++) {
      let best: { tx: number; tz: number } | null = null;
      let bestScore = Infinity;
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== rad) continue;
          if (this.isBlocked(tx + dx, tz + dz)) continue;
          let score = Math.hypot(dx, dz);
          if (prefer) score += 0.25 * Math.hypot(tx + dx + 0.5 - prefer.x, tz + dz + 0.5 - prefer.z);
          if (score < bestScore) {
            bestScore = score;
            best = { tx: tx + dx, tz: tz + dz };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** True if a circle of radius r can travel the straight segment a → b. */
  lineClear(a: Point, b: Point, r: number): boolean {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / 0.2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (this.circleBlocked(a.x + dx * t, a.z + dz * t, r)) return false;
    }
    return true;
  }

  /**
   * A* from a world position to a world position, 8-directional, no corner cutting.
   * Returns smoothed waypoints (string-pulled), excluding the start, or null if unreachable.
   * A blocked goal is replaced by the nearest walkable tile.
   */
  findPath(from: Point, to: Point, r = 0.35): Point[] | null {
    const start = this.nearestWalkable(Math.floor(from.x), Math.floor(from.z), 2);
    const goal = this.nearestWalkable(Math.floor(to.x), Math.floor(to.z), 12, from);
    if (!start || !goal) return null;

    const W = this.width;
    const N = W * this.height;
    const startI = start.tz * W + start.tx;
    const goalI = goal.tz * W + goal.tx;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();

    const h = (i: number) => {
      const dx = Math.abs((i % W) - goal.tx);
      const dz = Math.abs(Math.floor(i / W) - goal.tz);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };

    g[startI] = 0;
    heap.push(h(startI), startI);

    let found = false;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (cur === goalI) {
        found = true;
        break;
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W;
      const cz = Math.floor(cur / W);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (this.isBlocked(nx, nz)) continue;
          // No squeezing diagonally past a blocked corner.
          if (dx !== 0 && dz !== 0 && (this.isBlocked(cx + dx, cz) || this.isBlocked(cx, cz + dz))) continue;
          const ni = nz * W + nx;
          if (closed[ni]) continue;
          const cost = g[cur] + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            came[ni] = cur;
            heap.push(cost + h(ni), ni);
          }
        }
      }
    }
    if (!found) return null;

    // Tile centers from start to goal.
    const pts: Point[] = [];
    for (let i = goalI; i !== -1; i = came[i]) pts.push({ x: (i % W) + 0.5, z: Math.floor(i / W) + 0.5 });
    pts.reverse();

    // Finish at the exact clicked point when it's reachable from the goal tile's center.
    const goalWasExact = goal.tx === Math.floor(to.x) && goal.tz === Math.floor(to.z);
    if (goalWasExact && !this.circleBlocked(to.x, to.z, r) && this.lineClear(pts[pts.length - 1], to, r)) {
      pts.push({ x: to.x, z: to.z });
    }

    // String-pulling: from each anchor, jump to the furthest waypoint with a clear line.
    const out: Point[] = [];
    let anchor: Point = { x: from.x, z: from.z };
    let i = 0;
    while (i < pts.length) {
      let far = i;
      for (let j = pts.length - 1; j > i; j--) {
        if (this.lineClear(anchor, pts[j], r)) {
          far = j;
          break;
        }
      }
      out.push(pts[far]);
      anchor = pts[far];
      i = far + 1;
    }
    return out;
  }
}

/** Binary min-heap of (key, value) pairs. Stale duplicates are skipped via the closed set. */
class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];

  get size(): number {
    return this.vals.length;
  }

  push(key: number, val: number): void {
    const k = this.keys;
    const v = this.vals;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }

  pop(): number {
    const k = this.keys;
    const v = this.vals;
    const top = v[0];
    const lastK = k.pop()!;
    const lastV = v.pop()!;
    if (k.length > 0) {
      k[0] = lastK;
      v[0] = lastV;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}
