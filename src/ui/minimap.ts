import type { MapDef } from '../world/maps/types';
import { hide, show } from './motion';

const ZONE: Record<string, string> = { path: '#c4683f', plaza: '#d9d4cc', concrete: '#4b5058', court: '#3b6ea5', track: '#b5483a', water: '#4fb3d9' };
const PLACES: { model: string; label: string; color: string }[] = [
  { model: 'gym-ucla', label: 'UCLA', color: '#2774ae' },
  { model: 'gym-deloitte', label: 'Deloitte', color: '#86bc25' },
  { model: 'gym-meta', label: 'Meta', color: '#0866ff' },
  { model: 'gym-betmgm', label: 'BetMGM', color: '#c5a15a' },
];

/** A top-down sketch of the park with the visitor's dot. Toggled with M or the map button. Outdoors only. */
export class Minimap {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly base: HTMLCanvasElement;
  private readonly scale = 4; // px per tile
  private open = false;

  constructor(
    root: HTMLElement,
    private readonly map: MapDef,
  ) {
    const w = map.width * this.scale;
    const h = map.height * this.scale;
    this.el = document.createElement('div');
    this.el.className = 'minimap';
    this.el.hidden = true;
    this.el.setAttribute('role', 'img');
    this.el.setAttribute('aria-label', 'Map of the park: gyms along the west side, the Weightroom in the middle, Calvin’s Court at the top, the plaza at the bottom.');
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.el.appendChild(this.canvas);
    root.appendChild(this.el);

    // The park itself never changes, so it's drawn once and reused.
    this.base = document.createElement('canvas');
    this.base.width = w;
    this.base.height = h;
    const ctx = this.base.getContext('2d')!;
    const s = this.scale;
    ctx.fillStyle = '#6cb872';
    ctx.fillRect(0, 0, w, h);
    for (const z of map.zones) {
      ctx.fillStyle = ZONE[z.kind] ?? '#888';
      ctx.fillRect(z.x * s, z.z * s, z.w * s, z.d * s);
    }
    ctx.font = '700 9px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const place of PLACES) {
      const p = map.props.find((x) => x.model === place.model);
      if (!p) continue;
      ctx.fillStyle = place.color;
      ctx.fillRect(p.x * s, p.z * s, p.w * s, p.d * s);
      ctx.fillStyle = '#fff';
      ctx.fillText(place.label, (p.x + p.w) * s + 14, (p.z + p.d / 2) * s);
    }
    const label = (text: string, x: number, z: number) => {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const tw = ctx.measureText(text).width;
      ctx.fillRect(x * s - tw / 2 - 3, z * s - 7, tw + 6, 14);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x * s - tw / 2, z * s);
    };
    const court = map.zones.find((z) => z.kind === 'court');
    const weights = map.zones.find((z) => z.kind === 'concrete');
    const plaza = map.zones.find((z) => z.kind === 'plaza');
    if (court) label("Calvin's Court", court.x + court.w / 2, court.z + court.d / 2);
    if (weights) label('Weightroom', weights.x + weights.w / 2, weights.z + weights.d / 2);
    if (plaza) label('Plaza', plaza.x + plaza.w / 2, plaza.z + plaza.d / 2);
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(force?: boolean): boolean {
    this.open = force ?? !this.open;
    if (this.open) show(this.el);
    else void hide(this.el);
    return this.open;
  }

  /** Redraw with the visitor's position. Pass null to hide the dot (indoors). */
  update(x: number, z: number, facing: number, time: number): void {
    if (!this.open) return;
    const ctx = this.canvas.getContext('2d')!;
    const s = this.scale;
    ctx.drawImage(this.base, 0, 0);
    ctx.save();
    ctx.translate(x * s, z * s);
    // Pulse ring, then a pointer showing which way they face.
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 7 + Math.sin(time * 4) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(-facing + Math.PI);
    ctx.fillStyle = '#ff6b35';
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    void this.map;
  }
}
