import * as THREE from 'three';

export const isCoarsePointer = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

export function hasWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export interface Renderer {
  three: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  /** Calls back with the new aspect ratio whenever the canvas size changes. */
  onResize(cb: (aspect: number, width: number, height: number) => void): void;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const three = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // Pixel-ratio cap: 2 on desktop, 1.5 on phones.
  const cap = isCoarsePointer() ? 1.5 : 2;
  const listeners: ((aspect: number, w: number, h: number) => void)[] = [];

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    three.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    three.setSize(w, h, false);
    for (const cb of listeners) cb(w / h, w, h);
  };
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener('orientationchange', resize);
  resize();

  return {
    three,
    canvas,
    onResize(cb) {
      listeners.push(cb);
      cb(canvas.clientWidth / canvas.clientHeight, canvas.clientWidth, canvas.clientHeight);
    },
  };
}
