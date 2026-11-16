// Every NPC line and sign in one place, so copy can be edited without touching game logic.
// A node is a run of lines, optionally ending in a choice. `next` jumps to another node,
// `action` asks the game to do something (see runAction in src/main.ts).
//
// TODO(calvin): review. All of this is draft copy written for you, except lines marked "source copy",
// which are your own words from the classic site. Drafts are also listed in docs/CONTENT-EDITING.md.

export interface DialogueLine {
  speaker: string;
  text: string;
}

export interface DialogueChoice {
  label: string;
  next?: string;
  action?: string;
}

export interface DialogueNode {
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  /** Runs when the last line is dismissed (when there are no choices). */
  action?: string;
}

const CALVIN = 'Calvin';

const plazaChoices: DialogueChoice[] = [
  { label: 'Show me around', action: 'tour' },
  { label: "I'll explore", next: 'plaza.explore' },
  { label: 'Who are you?', action: 'about' },
];

/** First talk with a gym leader: take the quick tour inside the pop-up, or explore on foot with the overview in hand. */
const leaderChoices = (_gym: string): DialogueChoice[] => [
  // Most visitors won't walk every room. "Finish" marks the gym done and hands over the badge on the spot.
  { label: 'Finish this gym', action: 'finish-gym' },
  { label: 'Walk me through it', action: 'walkthrough' },
  // No pop-up: the visitor wants to walk the room.
  { label: "I'll look around" },
];

export const dialogue: Record<string, DialogueNode> = {
  'plaza.intro': {
    lines: [
      { speaker: CALVIN, text: "Hey! I'm Calvin. Welcome to my park." },
      { speaker: CALVIN, text: 'Every building here is a stop in my career. Start at UCLA and work your way up.' },
      { speaker: CALVIN, text: "When you're done, come find me at my court. I'll be waiting with a ball." },
    ],
    choices: plazaChoices,
  },
  'plaza.again': {
    lines: [{ speaker: CALVIN, text: 'Back already? What do you need?' }],
    choices: plazaChoices,
  },
  'plaza.explore': {
    lines: [{ speaker: CALVIN, text: "Cool. Résumé kiosk is right there if you're in a rush." }],
  },
  'plaza.tourStart': {
    lines: [{ speaker: CALVIN, text: 'Follow me. First stop is where it all started.' }],
    action: 'tour-walk',
  },
  'plaza.tourEnd': {
    lines: [{ speaker: CALVIN, text: "UCLA. Best years of my life. Head in, I'll be back at the plaza." }],
    action: 'tour-return',
  },
  'plaza.signpost': {
    lines: [
      { speaker: 'Signpost', text: 'West: UCLA. North along the path: Deloitte, Meta, BetMGM.' },
      { speaker: 'Signpost', text: "Straight north of here: The Weightroom. Past that: Calvin's Court." },
    ],
  },

  // Gym leaders. Three nodes each: first talk, all stations done (awards the badge), and after the badge.
  'ucla.leader': {
    lines: [{ speaker: CALVIN, text: "Welcome to UCLA. Dream school, and where all of this started. Three stops in here." }],
    choices: leaderChoices('ucla'),
  },
  'ucla.leaderDone': {
    lines: [{ speaker: CALVIN, text: "That's all of UCLA. Go Bruins. This one's yours." }],
    action: 'badge:ucla',
  },
  'ucla.leaderAgain': {
    lines: [{ speaker: CALVIN, text: 'Bruin Badge looks good on you. Deloitte is next door, up the path.' }],
    action: 'card:ucla-overview',
  },

  'deloitte.leader': {
    lines: [{ speaker: CALVIN, text: "Deloitte. First real job, and where I figured out I wanted to build products. Three whiteboards, and a sushi bar with a story." }],
    choices: leaderChoices('deloitte'),
  },
  'deloitte.leaderDone': {
    lines: [{ speaker: CALVIN, text: 'Three for three. You read whiteboards faster than most partners.' }],
    action: 'badge:deloitte',
  },
  'deloitte.leaderAgain': {
    lines: [{ speaker: CALVIN, text: 'Consultant Badge, earned. Meta is the next building up.' }],
    action: 'card:deloitte-overview',
  },

  'meta.leader': {
    lines: [{ speaker: CALVIN, text: "Meta. Stories and Messaging, shipping to billions of people. Three stops, plus a window worth a look." }],
    choices: leaderChoices('meta'),
  },
  'meta.leaderDone': {
    lines: [{ speaker: CALVIN, text: 'All three. Ship it.' }],
    action: 'badge:meta',
  },
  'meta.leaderAgain': {
    lines: [{ speaker: CALVIN, text: 'Ship-It Badge is yours. BetMGM is at the top of the path.' }],
    action: 'card:meta-overview',
  },

  'betmgm.leader': {
    lines: [{ speaker: CALVIN, text: "Welcome to BetMGM. This is where I work now, on the rewards program. Four stations in here." }],
    choices: leaderChoices('betmgm'),
  },
  'betmgm.leaderDone': {
    lines: [{ speaker: CALVIN, text: "That's all four. You know this place better than most new hires." }],
    action: 'badge:betmgm',
  },
  'betmgm.leaderAgain': {
    lines: [{ speaker: CALVIN, text: 'High Roller Badge, nice. My court is right outside when you want a game.' }],
    action: 'card:betmgm-overview',
  },

  // The finale challenge (lines from the plan).
  'court.challenge': {
    lines: [
      { speaker: CALVIN, text: 'So you made it. First to the most buckets after 5 possessions.' },
      { speaker: CALVIN, text: "Every possession, I'm giving you a read. Get it right, you score. Get it wrong, I'm cooking you." },
    ],
    choices: [
      { label: 'Run it', action: 'finale' },
      { label: 'Not yet', next: 'court.later' },
    ],
  },
  'court.later': {
    lines: [{ speaker: CALVIN, text: "I'll be here. Ball's not going anywhere." }],
  },

  // Shown when a door leads to a scene that isn't built yet. The speaker is replaced with the place's name.
  'door.locked': {
    lines: [{ speaker: 'Door', text: 'Still under construction. This one opens in the next build.' }],
  },

  // Calvin's words, from the Deloitte overview. "March" added at his request.
  'deloitte.sushi': {
    lines: [{ speaker: CALVIN, text: 'When the world shut down in March 2020, I was at a sushi bar in SF for a client project.' }],
  },
};

/** Short non-blocking notices. The two badge lines arrive as a "text from Calvin". */
export const toasts = {
  welcomeBack: 'Welcome back. Your progress is saved.',
  twoBadges: "Calvin: Two badges already? You're moving. Court's open whenever you're ready.",
  fourBadges: "Calvin: Okay you've done your homework. Let's see if it paid off. Court. Now.",
  reset: 'Progress cleared.',
};
