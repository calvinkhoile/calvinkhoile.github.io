// One-off stops that aren't career projects, side builds, or hobbies. Copy here is Calvin's own words.

export interface Note {
  tag: string;
  title: string;
  paragraphs: string[];
  image?: { src: string; alt: string };
}

export const notes: Record<string, Note> = {
  jetblue: {
    tag: 'Points & Loyalty',
    title: 'JetBlue 25 for 25',
    paragraphs: [
      'In 2025, I completed the JetBlue challenge that gave me 25 years of loyalty status, Mosaic 1. I hit 25 different airports in the span of 2 months. It was a crazy time!',
    ],
    image: { src: '/images/jetblue.png', alt: 'JetBlue congratulations screen: completed 25 for 25 and unlocked Mosaic 1 status for 25 years' },
  },
};
