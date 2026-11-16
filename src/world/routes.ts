import { stationById, type SceneId } from '../content/stations';

// Deep links. The URL hash tracks where the visitor is, so Calvin can send someone straight to a project:
//   #/                              plaza
//   #/gym/<ucla|deloitte|meta|betmgm>[/<station>]
//   #/weightroom[/<station>]
//   #/court

export interface Route {
  scene: SceneId;
  /** Outdoor spot to stand at (exterior routes only). */
  spot?: 'weightroom' | 'court';
  /** Station whose card should be open. */
  station?: string;
}

const GYMS: Record<string, SceneId> = { ucla: 'gym-ucla', deloitte: 'gym-deloitte', meta: 'gym-meta', betmgm: 'gym-betmgm' };

export function parseRoute(hash: string): Route | null {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === 'gym' && GYMS[parts[1]]) {
    const station = parts[2] ? `${parts[1]}/${parts[2]}` : undefined;
    return { scene: GYMS[parts[1]], station: station && stationById(station) ? station : undefined };
  }
  if (parts[0] === 'weightroom') {
    const station = parts[1] ? `weightroom/${parts[1]}` : undefined;
    return { scene: 'exterior', spot: 'weightroom', station: station && stationById(station) ? station : undefined };
  }
  if (parts[0] === 'court') return { scene: 'exterior', spot: 'court' };
  return null;
}

/** Hash for the current place. `station` is the id of an open station card, if any. */
export function formatRoute(scene: SceneId, station: string | null): string {
  if (station?.startsWith('weightroom/')) return `#/${station}`;
  const gym = Object.keys(GYMS).find((k) => GYMS[k] === scene);
  if (!gym) return '#/';
  return station?.startsWith(`${gym}/`) ? `#/gym/${station}` : `#/gym/${gym}`;
}
