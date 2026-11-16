import { careerData, companies } from '../content/career';
import { notes } from '../content/extras';
import { hobbies } from '../content/hobbies';
import { profile } from '../content/profile';
import { sideBuilds } from '../content/side-builds';
import { stations, type Station } from '../content/stations';
import type { CardModel } from './card';

// Turns content entries into card models. Copy is passed through untouched.

const companyOf = (key: string) => companies.find((c) => c.overview === key || c.projects.includes(key));

export function careerCard(key: string, opts: { id?: string; initialTab?: number; onlyTab?: number; chip?: string } = {}): CardModel {
  const e = careerData[key];
  if (!e) throw new Error(`card: no career entry "${key}"`);
  const company = companyOf(key);
  // A station that covers one tab of an entry (UCLA's three) shows just that tab, titled for it.
  const only = opts.onlyTab !== undefined ? e.screens[opts.onlyTab] : undefined;
  return {
    id: opts.id ?? key,
    logo: company?.logo,
    tag: only ? e.title : e.tag,
    title: only ? only.label : e.title,
    subtitle: e.company,
    chip: opts.chip,
    paragraphs: [e.desc],
    list: e.impact?.length ? { label: e.impactLabel, items: e.impact } : undefined,
    // Overview highlights point at the station that holds each project.
    links: e.highlights
      ?.map((h) => ({ label: h.label, target: stations.find((s) => s.content.source === 'career' && s.content.key === h.project)?.id ?? '' }))
      .filter((l) => l.target),
    screens: only ? [only] : e.screens,
    initialTab: opts.initialTab,
    sidePhoto: e.sidePhoto,
    sidePhotoWide: e.sidePhotoWide,
    sideGallery: e.sideGallery,
  };
}

/** One impact bullet as its own small card (Deloitte whiteboards). The bullet text is shown verbatim. */
export function impactCard(key: string, index: number, opts: { id: string; title: string; chip?: string }): CardModel {
  const e = careerData[key];
  return {
    id: opts.id,
    logo: companyOf(key)?.logo,
    tag: e.title,
    title: opts.title,
    subtitle: e.company,
    chip: opts.chip,
    paragraphs: [e.impact![index]],
    screens: [],
    sideGallery: e.sideGallery,
  };
}

export function sideBuildCard(key: string, opts: { id?: string; chip?: string } = {}): CardModel {
  const b = sideBuilds.find((s) => s.id === key)!;
  return {
    id: opts.id ?? key,
    tag: 'The Weightroom',
    title: b.name,
    subtitle: b.tagline,
    chip: opts.chip,
    paragraphs: [b.overview],
    tags: b.tags,
    wip: b.wip,
    screens: b.gallery ? [{ label: b.name, gallery: b.gallery.map((g) => g.src) }] : [],
  };
}

export function hobbyCard(key: string, slice: string | undefined, opts: { id?: string; chip?: string } = {}): CardModel {
  const h = hobbies.find((x) => x.id === key)!;
  return {
    id: opts.id ?? key,
    tag: 'The Weightroom',
    title: h.name,
    chip: opts.chip,
    paragraphs: [],
    screens: h.slices.map((s) => ({ label: s.label, img: s.photo, caption: s.desc })),
    initialTab: Math.max(0, h.slices.findIndex((s) => s.id === slice)),
  };
}

export function aboutCard(): CardModel {
  return {
    id: 'about',
    title: profile.name,
    subtitle: profile.kicker,
    paragraphs: profile.bio,
    screens: [],
  };
}

/** The card for a station, or null when the station isn't a card (photo and dialogue props). */
export function stationCard(station: Station, chip?: string): CardModel | null {
  const c = station.content;
  const opts = { id: station.id, chip };
  switch (c.source) {
    case 'career':
      return careerCard(c.key, { ...opts, onlyTab: c.tab });
    case 'impact':
      return impactCard(c.key, c.index, { ...opts, title: station.label });
    case 'side-builds':
      return sideBuildCard(c.key, opts);
    case 'hobbies':
      return hobbyCard(c.key, c.slice, opts);
    case 'note': {
      const n = notes[c.key];
      return { id: station.id, tag: n.tag, title: n.title, paragraphs: n.paragraphs, screens: n.image ? [{ label: n.title, img: n.image.src, imgWidth: '300px' }] : [] };
    }
    default:
      return null;
  }
}
