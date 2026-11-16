import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Part {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshLambertMaterial;
  /** Transform of this mesh inside its model. */
  matrix: THREE.Matrix4;
}

/**
 * A kit is one GLB holding many small models, each under a named node (see scripts/assets.mjs).
 * Repeated models are drawn with InstancedMesh, so 60 palms cost one draw call.
 */
export class Kit {
  private readonly models = new Map<string, Part[]>();

  constructor(gltf: GLTF) {
    const lambert = new Map<THREE.Material, THREE.MeshLambertMaterial>();
    gltf.scene.updateMatrixWorld(true);
    for (const wrapper of gltf.scene.children) {
      const inv = wrapper.matrixWorld.clone().invert();
      const parts: Part[] = [];
      wrapper.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        let material = lambert.get(src);
        if (!material) {
          // Lambert is cheaper than the PBR material the loader creates, and matches the flat low-poly look.
          const map = src.map;
          const img = map?.image as { width?: number } | undefined;
          if (map && (img?.width ?? 999) <= 64) {
            // Palette textures are a few pixels wide: filtering or mipmaps would smear neighboring colors together.
            map.magFilter = map.minFilter = THREE.NearestFilter;
            map.generateMipmaps = false;
            map.needsUpdate = true;
          }
          material = new THREE.MeshLambertMaterial({ map, color: src.color });
          lambert.set(src, material);
        }
        parts.push({ geometry: mesh.geometry, material, matrix: inv.clone().multiply(mesh.matrixWorld) });
      });
      this.models.set(wrapper.name, parts);
    }
  }

  has(name: string): boolean {
    return this.models.has(name);
  }

  /** Draw `name` once per transform. */
  instances(name: string, transforms: THREE.Matrix4[], shadows: boolean): THREE.Object3D[] {
    const parts = this.models.get(name);
    if (!parts) throw new Error(`kit: unknown model "${name}"`);
    const m = new THREE.Matrix4();
    return parts.map((part) => {
      const inst = new THREE.InstancedMesh(part.geometry, part.material, transforms.length);
      transforms.forEach((t, i) => inst.setMatrixAt(i, m.multiplyMatrices(t, part.matrix)));
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = shadows;
      inst.computeBoundingSphere();
      return inst;
    });
  }

  /** One standalone copy with its own materials (so it can be tinted or faded on its own). */
  single(name: string, tint = 0xffffff): THREE.Group {
    const parts = this.models.get(name);
    if (!parts) throw new Error(`kit: unknown model "${name}"`);
    const group = new THREE.Group();
    for (const part of parts) {
      const material = part.material.clone();
      material.color.multiply(new THREE.Color(tint));
      const mesh = new THREE.Mesh(part.geometry, material);
      mesh.applyMatrix4(part.matrix);
      group.add(mesh);
    }
    return group;
  }
}
