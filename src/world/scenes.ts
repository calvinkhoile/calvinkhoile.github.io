import type { SceneId } from '../content/stations';
import { exterior } from './maps/exterior';
import { gymBetmgm } from './maps/gym-betmgm';
import type { MapDef } from './maps/types';

/** Every scene that exists so far. Doors that lead somewhere not listed here show an "opening soon" line. */
export const SCENES: Partial<Record<SceneId, MapDef>> = {
  exterior,
  'gym-betmgm': gymBetmgm,
};

export const SCENE_NAMES: Record<SceneId, string> = {
  exterior: 'MyPark',
  'gym-ucla': 'UCLA Gym',
  'gym-deloitte': 'Deloitte Gym',
  'gym-meta': 'Meta Gym',
  'gym-betmgm': 'BetMGM Gym',
};
