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
  setPixelRatioCap(cap: number): void;
}

export function createRenderer(canvas: HTMLCanvasElement, opts: { antialias: boolean; pixelRatioCap: number }): Renderer {
  const three = new THREE.WebGLRenderer({ canvas, antialias: opts.antialias, powerPreference: 'high-performance' });
  let cap = opts.pixelRatioCap;
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
    setPixelRatioCap(next) {
      cap = next;
      resize();
    },
    onResize(cb) {
      listeners.push(cb);
      cb(canvas.clientWidth / canvas.clientHeight, canvas.clientWidth, canvas.clientHeight);
    },
  };
}
