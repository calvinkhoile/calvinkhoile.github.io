// Side builds ("MyBadges" on the classic site), migrated verbatim. Shown at The Workshop.

export interface SideBuild {
  id: string;
  name: string;
  tagline: string;
  overview: string;
  gallery?: { src: string; alt: string }[];
  tags?: string[];
  /** The classic site shows a work-in-progress image here; the world uses a 3D caution sign instead. */
  wip?: boolean;
}

export const sideBuilds: SideBuild[] = [
  {
    id: 'sports-betting',
    name: 'Sports Betting',
    tagline: 'Line shopping and market inefficiencies',
    overview:
      "Started in 2022 when sports betting went legal in New York, at first just chasing sign-up promotions. That curiosity turned into learning how to line shop and find real market inefficiencies. I still wager from time to time, though I'm limited by the standard restrictions that come with being a BetMGM employee.",
    gallery: [
      { src: '/images/mybadges/img-0348.webp', alt: 'Pikkit 2023 betting record' },
      { src: '/images/mybadges/img-5463.webp', alt: 'Pikkit CLV bettor persona, 78.5% of bets beating closing line value' },
    ],
  },
  {
    id: 'ai-building',
    name: 'Building with AI',
    tagline: 'Claude Code + Cursor as a development stack',
    overview:
      "Honestly, still early days for me. I've been learning to build using Claude Code and Cursor as my primary tools. I don't come from a technical background, but have gotten a lot more comfortable through experience building APIs at BetMGM and the capabilities that AI has unlocked. AI has allowed me to create the PM Operating System (OS) at BetMGM, and made me much more comfortable with GitHub, PRs, git clones, you name it. More to come!",
    tags: ['Claude Code', 'Cursor', 'GitHub'],
    wip: true,
  },
];
