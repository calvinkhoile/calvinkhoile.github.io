import type { SceneId } from '../content/stations';
import { exterior } from './maps/exterior';
import { gymBetmgm } from './maps/gym-betmgm';
import { gymDeloitte } from './maps/gym-deloitte';
import { gymMeta } from './maps/gym-meta';
import { gymUcla } from './maps/gym-ucla';
import type { MapDef } from './maps/types';

/** Every scene that exists so far. Doors that lead somewhere not listed here show an "opening soon" line. */
export const SCENES: Partial<Record<SceneId, MapDef>> = {
  exterior,
  'gym-ucla': gymUcla,
  'gym-deloitte': gymDeloitte,
  'gym-meta': gymMeta,
  'gym-betmgm': gymBetmgm,
};

export const SCENE_NAMES: Record<SceneId, string> = {
  exterior: 'MyPark',
  'gym-ucla': 'UCLA Gym',
  'gym-deloitte': 'Deloitte Gym',
  'gym-meta': 'Meta Gym',
  'gym-betmgm': 'BetMGM Gym',
};
