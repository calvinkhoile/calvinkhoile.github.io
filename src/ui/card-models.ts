import { careerData, companies } from '../content/career';
import { hobbies } from '../content/hobbies';
import { profile } from '../content/profile';
import { sideBuilds } from '../content/side-builds';
import { stations, type Station } from '../content/stations';
import type { CardModel } from './card';

// Turns content entries into card models. Copy is passed through untouched.

const companyOf = (key: string) => companies.find((c) => c.overview === key || c.projects.includes(key));

export function careerCard(key: string, opts: { id?: string; initialTab?: number; chip?: string } = {}): CardModel {
  const e = careerData[key];
  if (!e) throw new Error(`card: no career entry "${key}"`);
  const company = companyOf(key);
  return {
    id: opts.id ?? key,
    logo: company?.logo,
    tag: e.tag,
    title: e.title,
    subtitle: e.company,
    chip: opts.chip,
    paragraphs: [e.desc],
    list: e.impact?.length ? { label: e.impactLabel, items: e.impact } : undefined,
    // Overview highlights point at the station that holds each project.
    links: e.highlights
      ?.map((h) => ({ label: h.label, target: stations.find((s) => s.content.source === 'career' && s.content.key === h.project)?.id ?? '' }))
      .filter((l) => l.target),
    screens: e.screens,
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
    tag: 'The Workshop',
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
    tag: 'The Blacktop',
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
      return careerCard(c.key, { ...opts, initialTab: c.tab });
    case 'impact':
      return impactCard(c.key, c.index, { ...opts, title: station.label });
    case 'side-builds':
      return sideBuildCard(c.key, opts);
    case 'hobbies':
      return hobbyCard(c.key, c.slice, opts);
    default:
      return null;
  }
}
