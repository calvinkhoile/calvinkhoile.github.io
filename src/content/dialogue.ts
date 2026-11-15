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
      { speaker: 'Signpost', text: "East: The Workshop and The Blacktop. Far corner: Calvin's Court." },
    ],
  },

  'betmgm.leader': {
    lines: [
      { speaker: CALVIN, text: 'Welcome to BetMGM. This is where I work now, on the rewards program.' },
      { speaker: CALVIN, text: 'Four stations in here. Hit them all, then come back and see me.' },
    ],
    action: 'card:betmgm-overview',
  },
  'betmgm.leaderDone': {
    lines: [{ speaker: CALVIN, text: "That's all four. You know this place better than most new hires." }],
    action: 'card:betmgm-overview',
  },

  // Shown when a door leads to a scene that isn't built yet. The speaker is replaced with the place's name.
  'door.locked': {
    lines: [{ speaker: 'Door', text: 'Still under construction. This one opens in the next build.' }],
  },

  // Source copy (deloitte-overview.desc).
  'deloitte.sushi': {
    lines: [{ speaker: CALVIN, text: 'When the world shut down in 2020, I was at a sushi bar in SF for a client project.' }],
  },
  'workshop.diorama': {
    // TODO(calvin): write a few sentences on how this site was built.
    lines: [{ speaker: 'Diorama', text: 'A tiny model of the park. (Calvin is still writing the story of how this site got built.)' }],
  },
  'blacktop.chessTeaser': {
    lines: [{ speaker: 'Chess Table', text: "A game is set up, mid-position. Calvin plays for real at his court. Find him there when you're ready." }],
  },
};

/** Short non-blocking notices. */
export const toasts = {
  welcomeBack: 'Welcome back. Your progress is saved.',
};
