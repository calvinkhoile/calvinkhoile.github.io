import * as THREE from 'three';

export interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CameraOptions {
  /** Degrees around the vertical axis. 45 is the isometric look. */
  yawDeg?: number;
  /** Degrees below the horizon. */
  pitchDeg?: number;
  fovDeg?: number;
  /** Distance multiplier. Above 1 pulls the camera back. */
  zoomOut?: number;
  reducedMotion?: boolean;
}

const SMOOTH_TIME = 0.15; // critically damped follow
const LEAD = 1.4; // world units the camera looks ahead at full walk speed
const BASE_DISTANCE = 36;
const MIN_VISIBLE_WIDTH = 13; // world units across the screen, so portrait phones zoom out

/** Fixed-angle follow camera: narrow FOV, high and angled down, for an isometric feel with some depth. */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly yaw: number;
  readonly pitch: number;
  private distance = BASE_DISTANCE;
  private readonly target = new THREE.Vector3();
  private velX = 0;
  private velZ = 0;
  private readonly reducedMotion: boolean;
  private readonly zoomOut: number;
  private bounds: CameraBounds | null = null;

  constructor(opts: CameraOptions = {}) {
    this.yaw = THREE.MathUtils.degToRad(opts.yawDeg ?? 45);
    this.pitch = THREE.MathUtils.degToRad(opts.pitchDeg ?? 50);
    this.reducedMotion = opts.reducedMotion ?? false;
    this.zoomOut = opts.zoomOut ?? 1;
    this.camera = new THREE.PerspectiveCamera(opts.fovDeg ?? 30, 1, 1, 400);
  }

  setBounds(b: CameraBounds): void {
    this.bounds = b;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const widthAtBase = 2 * BASE_DISTANCE * Math.tan(halfFov) * aspect;
    const fit = widthAtBase < MIN_VISIBLE_WIDTH ? BASE_DISTANCE * (MIN_VISIBLE_WIDTH / widthAtBase) : BASE_DISTANCE;
    this.distance = fit * this.zoomOut;
    this.camera.updateProjectionMatrix();
    this.place();
  }

  /** Ground-plane directions for "screen up" and "screen right", used to map input to world movement. */
  basis(): { fx: number; fz: number; rx: number; rz: number } {
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    return { fx, fz, rx: -fz, rz: fx };
  }

  snapTo(x: number, z: number): void {
    this.target.set(x, 0, z);
    this.clamp(this.target);
    this.velX = this.velZ = 0;
    this.place();
  }

  update(dt: number, x: number, z: number, vx: number, vz: number, walkSpeed: number): void {
    const lead = this.reducedMotion ? 0 : LEAD / walkSpeed;
    const goal = new THREE.Vector3(x + vx * lead, 0, z + vz * lead);
    this.clamp(goal);
    const sx = smoothDamp(this.target.x, goal.x, this.velX, SMOOTH_TIME, dt);
    const sz = smoothDamp(this.target.z, goal.z, this.velZ, SMOOTH_TIME, dt);
    this.target.x = sx.value;
    this.velX = sx.velocity;
    this.target.z = sz.value;
    this.velZ = sz.velocity;
    this.place();
  }

  private clamp(v: THREE.Vector3): void {
    if (!this.bounds) return;
    v.x = Math.min(this.bounds.maxX, Math.max(this.bounds.minX, v.x));
    v.z = Math.min(this.bounds.maxZ, Math.max(this.bounds.minZ, v.z));
  }

  private place(): void {
    const h = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * h,
      Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * h,
    );
    this.camera.lookAt(this.target.x, 0.9, this.target.z);
  }
}

/** Critically damped spring (same shape as Unity's SmoothDamp). */
function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  return { value: target + (change + temp) * exp, velocity: (velocity - omega * temp) * exp };
}
