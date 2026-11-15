// Station registry: the glue between maps, content, progress, and (later) deep links.
// Maps reference stations by id. Content is never referenced from a map directly.

export type SceneId = 'exterior' | 'gym-ucla' | 'gym-deloitte' | 'gym-meta' | 'gym-betmgm' | 'workshop';

export type StationContent =
  | { source: 'career'; key: string; tab?: number }
  /** One `impact` bullet of a career entry, shown as its own small card. */
  | { source: 'impact'; key: string; index: number }
  | { source: 'side-builds'; key: string }
  | { source: 'hobbies'; key: string; slice?: string }
  /** A single photo, opened in the lightbox. */
  | { source: 'photo'; src: string; alt: string }
  /** A dialogue line (easter eggs, teasers). */
  | { source: 'dialogue'; key: string };

export interface Station {
  /** scene/slug. Used in visitedStations, deep links, and progress. */
  id: string;
  scene: SceneId;
  /** Prompt text and screen-reader label. */
  label: string;
  content: StationContent;
  /** Counts toward the scene's "x/N" and its badge. Props (false) are optional extras. */
  counts: boolean;
}

export const stations: Station[] = [
  // UCLA (3 counted)
  { id: 'ucla/graduation', scene: 'gym-ucla', label: 'Graduation Stage', content: { source: 'career', key: 'ucla-overview', tab: 0 }, counts: true },
  { id: 'ucla/clubs', scene: 'gym-ucla', label: 'Club Fair', content: { source: 'career', key: 'ucla-overview', tab: 1 }, counts: true },
  { id: 'ucla/internships', scene: 'gym-ucla', label: 'Internship Board', content: { source: 'career', key: 'ucla-overview', tab: 2 }, counts: true },

  // Deloitte (3 counted)
  { id: 'deloitte/finance-upgrade', scene: 'gym-deloitte', label: 'Financial System Upgrade', content: { source: 'impact', key: 'deloitte-overview', index: 0 }, counts: true },
  { id: 'deloitte/hr-tools', scene: 'gym-deloitte', label: 'Self-Service HR Tools', content: { source: 'impact', key: 'deloitte-overview', index: 1 }, counts: true },
  { id: 'deloitte/case-management', scene: 'gym-deloitte', label: 'Case Management', content: { source: 'impact', key: 'deloitte-overview', index: 2 }, counts: true },
  { id: 'deloitte/sushi-bar', scene: 'gym-deloitte', label: 'Sushi Bar', content: { source: 'dialogue', key: 'deloitte.sushi' }, counts: false },

  // Meta (3 counted)
  { id: 'meta/external-feedback', scene: 'gym-meta', label: 'Feedback Kiosk', content: { source: 'career', key: 'external-feedback' }, counts: true },
  { id: 'meta/highlighted-features', scene: 'gym-meta', label: 'Feature Wall', content: { source: 'career', key: 'highlighted-features' }, counts: true },
  { id: 'meta/product-feedback', scene: 'gym-meta', label: 'Voice of the Customer', content: { source: 'career', key: 'product-feedback' }, counts: true },
  { id: 'meta/hq-window', scene: 'gym-meta', label: 'HQ Window', content: { source: 'photo', src: '/images/meta/meta-hq.webp', alt: 'Meta headquarters' }, counts: false },

  // BetMGM (4 counted)
  { id: 'betmgm/rewards-store', scene: 'gym-betmgm', label: 'Rewards Store', content: { source: 'career', key: 'rewards-store' }, counts: true },
  { id: 'betmgm/loyalty-apis', scene: 'gym-betmgm', label: 'Loyalty APIs', content: { source: 'career', key: 'loyalty-apis' }, counts: true },
  { id: 'betmgm/enablement-wins', scene: 'gym-betmgm', label: 'Partnership Desk', content: { source: 'career', key: 'enablement-wins' }, counts: true },
  { id: 'betmgm/ai-betmgm', scene: 'gym-betmgm', label: 'AI Lab', content: { source: 'career', key: 'ai-betmgm' }, counts: true },
  { id: 'betmgm/product-summit', scene: 'gym-betmgm', label: 'Product Summit Stage', content: { source: 'photo', src: '/images/betmgm/product-summit.webp', alt: 'Calvin on stage at the BetMGM Product Summit' }, counts: false },

  // The Workshop (both count toward Explorer)
  { id: 'workshop/sports-betting', scene: 'workshop', label: 'Sportsbook Ticker', content: { source: 'side-builds', key: 'sports-betting' }, counts: true },
  { id: 'workshop/ai-building', scene: 'workshop', label: 'Workbench', content: { source: 'side-builds', key: 'ai-building' }, counts: true },
  { id: 'workshop/diorama', scene: 'workshop', label: 'You Are Here', content: { source: 'dialogue', key: 'workshop.diorama' }, counts: false },

  // The Blacktop (outdoors, all five count toward Explorer)
  { id: 'blacktop/la-marathon', scene: 'exterior', label: 'Mile Marker: LA', content: { source: 'hobbies', key: 'running', slice: 'la-marathon' }, counts: true },
  { id: 'blacktop/huntington-beach', scene: 'exterior', label: 'Mile Marker: Huntington Beach', content: { source: 'hobbies', key: 'running', slice: 'huntington-beach' }, counts: true },
  { id: 'blacktop/chess', scene: 'exterior', label: 'Chess Table', content: { source: 'hobbies', key: 'chess' }, counts: true },
  { id: 'blacktop/coaching', scene: 'exterior', label: "Coach's Bench", content: { source: 'hobbies', key: 'basketball', slice: 'coaching' }, counts: true },
  { id: 'blacktop/trophy-case', scene: 'exterior', label: 'Trophy Case', content: { source: 'hobbies', key: 'basketball', slice: 'record' }, counts: true },
  { id: 'blacktop/chess-teaser', scene: 'exterior', label: 'Chess Table', content: { source: 'dialogue', key: 'blacktop.chessTeaser' }, counts: false },
];

export const stationById = (id: string): Station | undefined => stations.find((s) => s.id === id);
export const countedStations = (scene: SceneId): Station[] => stations.filter((s) => s.scene === scene && s.counts);
