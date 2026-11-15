// Hobbies ("Off the Court" on the classic site), migrated verbatim (one em dash replaced with a colon).
// Each hobby has one or more slices: a photo, a tab label, and its own description. Shown at The Blacktop.

export interface HobbySlice {
  id: string;
  label: string;
  photo: string;
  alt: string;
  desc: string;
}

export interface Hobby {
  id: string;
  name: string;
  slices: HobbySlice[];
}

export const hobbies: Hobby[] = [
  {
    id: 'running',
    name: 'Running',
    slices: [
      {
        id: 'la-marathon',
        label: 'LA Marathon',
        photo: '/images/hobbies/marathon-2.webp',
        alt: 'LA Marathon',
        desc: 'Los Angeles Marathon, 2026: Trained well, but got hit with near 90 degree weather. Finished in 4:30. Taking a bit of a break from running to build general fitness and overall health.',
      },
      {
        id: 'huntington-beach',
        label: 'Huntington Beach',
        photo: '/images/hobbies/marathon-1.webp',
        alt: 'Huntington Beach',
        desc: 'Huntington Beach Marathon, 2025: Underestimated a marathon and was hit with runners knee before the race. Had to walk most of it, finished in 5:30.',
      },
    ],
  },
  {
    id: 'chess',
    name: 'Chess',
    slices: [
      {
        id: 'rating',
        label: 'Chess',
        photo: '/images/hobbies/chess.webp',
        alt: 'Chess.com rating history',
        desc: "I started playing when I was 12 with my childhood best friend. Still mostly casual, and rated ~1600-1700 on Chess.com (97.5th percentile), but I'd eventually like to start taking it more seriously and study and enter some tournaments.",
      },
    ],
  },
  {
    id: 'basketball',
    name: 'Basketball',
    slices: [
      {
        id: 'record',
        label: 'Record',
        photo: '/images/hobbies/3-point-record.webp',
        alt: 'High school 3-point record',
        desc: "I've played since I was 8, all the way through high school, where I set the HS record for most 3-pointers made in a game. I don't play anymore, but the love for the game, analytics, strategy, and competitiveness still carries on.",
      },
      {
        id: 'playing',
        label: 'Playing',
        photo: '/images/hobbies/basketball-1.webp',
        alt: 'Driving to the basket during a high school game',
        desc: 'Driving to the rim during a game my senior year at Fountain Valley High.',
      },
      {
        id: 'coaching',
        label: 'Coaching',
        photo: '/images/hobbies/coaching.webp',
        alt: 'Coaching my travel basketball team',
        desc: "In my early college days, I started and coached my own travel team, Genesis Elite, for two summers. It taught me a lot of things I expected, and plenty I didn't: hiring good coaches, marketing, jerseys, tournament entries, basically running a small business.",
      },
    ],
  },
];
