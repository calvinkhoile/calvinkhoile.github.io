import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

/** Load a GLB from /models/, cached so repeat requests share one download. */
export function loadModel(file: string): Promise<GLTF> {
  let p = cache.get(file);
  if (!p) {
    p = gltfLoader.loadAsync(`/models/${file}`);
    cache.set(file, p);
  }
  return p;
}

/** Run several loads and report overall progress (0..1) as each one finishes. */
export async function loadAll<T extends unknown[]>(
  tasks: { [K in keyof T]: Promise<T[K]> },
  onProgress: (fraction: number) => void,
): Promise<T> {
  let done = 0;
  const list = tasks as Promise<unknown>[];
  onProgress(0);
  return Promise.all(
    list.map((t) =>
      t.then((v) => {
        done++;
        onProgress(done / list.length);
        return v;
      }),
    ),
  ) as Promise<T>;
}
