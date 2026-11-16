import * as THREE from 'three';
import { Character } from '../world/character';
import { CALVIN_LOOKS } from '../world/looks';

/**
 * Review page (`?lineup=1`): Calvin in every outfit, side by side, turning slowly.
 * `&close=1` moves the camera in on the first one for a look at the face and hair.
 */
export async function runLineup(canvas: HTMLCanvasElement): Promise<void> {
  document.getElementById('loading')!.hidden = true;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe3f5);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.4);
  sun.position.set(-3, 6, 5);
  sun.castShadow = true;
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  scene.add(sun, new THREE.HemisphereLight(0xd4ecff, 0x7c9a63, 1.35));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 20).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd9d4cc }));
  ground.receiveShadow = true;
  scene.add(ground);

  const looks = Object.values(CALVIN_LOOKS);
  const close = new URLSearchParams(location.search).has('close');
  const gap = 1.5;
  const people: Character[] = [];
  const labels = document.createElement('div');
  labels.className = 'lineup-labels';
  document.body.appendChild(labels);
  for (const [i, look] of looks.entries()) {
    const c = await Character.create(look, { shadows: true });
    c.object.position.x = (i - (looks.length - 1) / 2) * gap;
    scene.add(c.object);
    people.push(c);
    const label = document.createElement('span');
    label.textContent = look.caption;
    labels.appendChild(label);
  }

  const camera = new THREE.PerspectiveCamera(close ? 20 : 30, 1, 0.1, 100);
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    if (close) {
      camera.position.set(people[0].object.position.x + 0.8, 1.75, 3.2);
      camera.lookAt(people[0].object.position.x, 1.45, 0);
    } else {
      // Pull back until the whole row fits the width.
      const dist = Math.max(7.5, (looks.length * gap) / (2 * Math.tan(THREE.MathUtils.degToRad(15)) * camera.aspect) + 1);
      camera.position.set(0, 1.5, dist);
      camera.lookAt(0, 0.95, 0);
    }
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let last = performance.now();
  const still = new URLSearchParams(location.search).has('still');
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const c of people) {
      c.update(dt);
      if (!still) c.object.rotation.y = Math.sin(now / 1400) * 0.9;
    }
    renderer.render(scene, camera);
  };
  requestAnimationFrame(frame);
  (window as unknown as { __lineupReady: boolean }).__lineupReady = true;
}
