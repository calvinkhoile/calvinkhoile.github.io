import * as THREE from 'three';
import { TILE_BLOCKED, TILE_DOOR, TILE_INTERACT, type Grid, type Point } from './grid';
import type { MapDef } from '../world/maps/types';

/** `?debug=1` overlay: grid lines, collision cells, door and interact tiles, interact radii, path, FPS. */
export class DebugOverlay {
  readonly root = new THREE.Group();
  private readonly panel: HTMLElement;
  private readonly pathLine: THREE.Line;
  private frames = 0;
  private elapsed = 0;
  private fps = 0;

  constructor(grid: Grid, map: MapDef, ui: HTMLElement) {
    // Grid lines.
    const pts: number[] = [];
    for (let x = 0; x <= grid.width; x++) pts.push(x, 0, 0, x, 0, grid.height);
    for (let z = 0; z <= grid.height; z++) pts.push(0, 0, z, grid.width, 0, z);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
    );
    lines.position.y = 0.05;
    this.root.add(lines);

    // Tile flags as tinted quads.
    this.addTiles(grid, TILE_BLOCKED, 0xff2d2d, 0.38, 0.06);
    this.addTiles(grid, TILE_INTERACT, 0x22d3ee, 0.3, 0.07);
    this.addTiles(grid, TILE_DOOR, 0xfde047, 0.75, 0.08);

    // Interact radii.
    for (const i of map.interactables) {
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          Array.from({ length: 48 }, (_, k) => {
            const a = (k / 48) * Math.PI * 2;
            return new THREE.Vector3(i.x + Math.cos(a) * i.radius, 0.1, i.z + Math.sin(a) * i.radius);
          }),
        ),
        new THREE.LineBasicMaterial({ color: 0x0891b2 }),
      );
      this.root.add(ring);
    }

    // Current click-to-move path.
    this.pathLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false }));
    this.pathLine.renderOrder = 20;
    this.pathLine.frustumCulled = false;
    this.root.add(this.pathLine);

    // One panel is shared by every scene's overlay.
    let panel = ui.querySelector<HTMLElement>('.debug-panel');
    if (!panel) {
      panel = document.createElement('pre');
      panel.className = 'debug-panel';
      ui.appendChild(panel);
    }
    this.panel = panel;
  }

  private addTiles(grid: Grid, flag: number, color: number, opacity: number, y: number): void {
    const tiles: [number, number][] = [];
    for (let tz = 0; tz < grid.height; tz++) {
      for (let tx = 0; tx < grid.width; tx++) if (grid.flags(tx, tz) & flag) tiles.push([tx, tz]);
    }
    if (tiles.length === 0) return;
    const geo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
    const inst = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false }),
      tiles.length,
    );
    inst.renderOrder = 15; // draw over the boxes so blocked cells under props stay visible
    const m = new THREE.Matrix4();
    tiles.forEach(([tx, tz], i) => inst.setMatrixAt(i, m.makeTranslation(tx + 0.5, y, tz + 0.5)));
    inst.instanceMatrix.needsUpdate = true;
    this.root.add(inst);
  }

  update(dt: number, info: { x: number; z: number; speed: number; path: Point[]; calls: number; tris: number }): void {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed >= 0.5) {
      this.fps = this.frames / this.elapsed;
      this.frames = 0;
      this.elapsed = 0;
    }
    const pts = [new THREE.Vector3(info.x, 0.15, info.z), ...info.path.map((p) => new THREE.Vector3(p.x, 0.15, p.z))];
    this.pathLine.geometry.setFromPoints(info.path.length ? pts : []);
    this.panel.textContent =
      `${this.fps.toFixed(0)} fps\n` +
      `pos ${info.x.toFixed(2)}, ${info.z.toFixed(2)}  tile ${Math.floor(info.x)}, ${Math.floor(info.z)}\n` +
      `speed ${info.speed.toFixed(2)}  path ${info.path.length}\n` +
      `draws ${info.calls}  tris ${info.tris}`;
  }
}
