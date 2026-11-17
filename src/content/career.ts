// Career content, migrated verbatim from the classic site (public/classic/script.js `careerData` and the
// career list in public/classic/index.html). Three things changed: image paths point at the optimized
// copies in /images, em dashes became commas (CLAUDE.md writing rules), and the Loyalty APIs "Account Linking"
// and "Real-Time Data" screens were merged into one comparison with A/B spots (captions unchanged).
// The world, the cards, and the résumé page all read this file, so copy is edited in one place.

export interface TimelineItem {
  period: string;
  company: string;
  /** May contain a <br>. */
  role: string;
}

export interface Screen {
  label: string;
  caption?: string;
  /** Before/after comparison slider. */
  before?: string;
  after?: string;
  /** Side-by-side, with an optional zoomed detail over the left image. */
  left?: string;
  leftLabel?: string;
  leftHover?: string;
  leftHoverPos?: string;
  right?: string;
  rightLabel?: string;
  /** Lettered spots (A, B, ...) on the left image. Picking one zooms into that detail and shows its caption. */
  hotspots?: { title: string; detail: string; pos: string; caption: string }[];
  /** Single image, with an optional zoom spot. */
  img?: string;
  imgWidth?: string;
  imgHover?: string;
  imgHoverPos?: string;
  /** Swipeable photos. */
  gallery?: string[];
  bullets?: string[];
  timeline?: TimelineItem[];
}

export interface CareerEntry {
  tag: string;
  title: string;
  /** Role line. */
  company: string;
  desc: string;
  impact?: string[];
  impactLabel?: string;
  /** Jump links to sibling projects (overview cards). */
  highlights?: { label: string; project: string }[];
  sidePhoto?: string;
  sidePhotoWide?: boolean;
  sideGallery?: string[];
  screens: Screen[];
}

export type CompanyId = 'betmgm' | 'meta' | 'deloitte' | 'ucla';

export interface Company {
  id: CompanyId;
  name: string;
  role: string;
  years: string;
  logo: string;
  /** Overview entry key, then project keys in display order. */
  overview: string;
  projects: string[];
}

/** Reverse chronological, as listed on the classic site. */
export const companies: Company[] = [
  { id: 'betmgm', name: 'BetMGM', role: 'Sr. Product Manager', years: '2024–present', logo: '/images/logos/betmgm.webp', overview: 'betmgm-overview', projects: ['rewards-store', 'loyalty-apis', 'enablement-wins', 'ai-betmgm'] },
  { id: 'meta', name: 'Meta', role: 'Product Ops', years: '2021–2024 · 2 Yr 5 M', logo: '/images/logos/meta.svg', overview: 'meta-overview', projects: ['external-feedback', 'highlighted-features', 'product-feedback'] },
  { id: 'deloitte', name: 'Deloitte', role: 'Business Analyst', years: '2019–2021 · 1 Yr 9 M', logo: '/images/logos/deloitte.webp', overview: 'deloitte-overview', projects: [] },
  { id: 'ucla', name: 'UCLA', role: 'B.A. Business Economics', years: '2016–2019', logo: '/images/logos/ucla.webp', overview: 'ucla-overview', projects: [] },
];

export const careerData: Record<string, CareerEntry> = {
  'betmgm-overview': {
    tag: 'BetMGM',
    title: 'BetMGM',
    company: 'Sr. Product Manager, Player Experience · 2024–present',
    sidePhoto: '/images/betmgm/product-summit.webp',
    desc: 'I lead the product experience for the rewards program at BetMGM, targeting the top 10% of players, the segment driving 70%+ of revenue. I started by building the foundation (APIs, MGM Resorts data connectivity, Marriott) and now I\'m focused on 1/1 personalization at scale.',
    highlights: [
      {
        label: 'Rewards Store Enhancements',
        project: 'rewards-store',
      },
      {
        label: 'Loyalty APIs',
        project: 'loyalty-apis',
      },
      {
        label: 'Platform Enablement',
        project: 'enablement-wins',
      },
      {
        label: 'AI at BetMGM',
        project: 'ai-betmgm',
      },
    ],
    screens: [],
  },
  'rewards-store': {
    tag: 'BetMGM',
    title: 'Rewards Store Enhancements',
    company: 'Sr. Product Manager, Player Experience',
    desc: 'I led a full revamp of the BetMGM Rewards Store, giving users more visibility into what they could redeem for, and making it easier to do so. This increased monthly redemption rates from <15% to over 40%.',
    impact: [],
    screens: [
      {
        label: 'Rewards Store',
        before: '/images/betmgm/store-before.webp',
        after: '/images/betmgm/store-after.webp',
        caption: 'Key Enhancements: fixed item ordering so users see what they can redeem first, blocked unusable items, added custom icons per reward type, and a full UI uplift.',
      },
      {
        label: 'Redemption',
        before: '/images/betmgm/redemption-before.webp',
        after: '/images/betmgm/redemption-after.webp',
        caption: 'The old modal had the bare minimum. The new bottom sheet shows full details, including longer item titles, detailed descriptions, custom icons, and more scalable spacing.',
      },
      {
        label: 'Merch Redemption',
        before: '/images/betmgm/merch-before.webp',
        after: '/images/betmgm/redemption-merch-after.webp',
        caption: 'Merch and voucher redemptions got the same bottom sheet treatment, but also allowed for pictures in the app. The description was also scalable and no longer limited to 3 short lines.',
      },
    ],
  },
  'loyalty-apis': {
    tag: 'BetMGM',
    title: 'Loyalty APIs',
    company: 'Sr. Product Manager, Player Experience',
    desc: 'Most players think BetMGM and MGM are one company. They\'re not, and for a long time our product made that painfully obvious. I built the Loyalty APIs to close that gap, connecting both platforms so players earn and redeem seamlessly, whether they\'re playing digitally or in person.',
    impact: [],
    screens: [
      {
        label: 'Before / After',
        before: '/images/betmgm/rewards-hub-before.webp',
        after: '/images/betmgm/rewards-hub-after.webp',
        caption: 'Before, the Rewards Hub was a static basic account summary. I led the rebuild into a live loyalty dashboard with Tier Status, Tier Credits progress, and automated real time MGM account linking.',
      },
      {
        // Account Linking and Real-Time Data share one comparison. Each is a lettered spot on the BetMGM screen.
        label: 'BetMGM + MGM',
        left: '/images/betmgm/rewards-hub-after.webp',
        leftLabel: 'BetMGM',
        right: '/images/betmgm/mgm-after-comparison.webp',
        rightLabel: 'MGM',
        hotspots: [
          {
            title: 'Account Linking',
            detail: '/images/betmgm/account-linking.webp',
            pos: '8%',
            caption: 'Players now have the same MGM Rewards ID for both digital and physical properties. We automated matching on day 1.',
          },
          {
            title: 'Real-Time Data',
            detail: '/images/betmgm/loyalty-info.webp',
            pos: '38%',
            caption: 'With a shared rewards program, we focused on sharing this data real time and accurately. Players now see the same Tier Credit balance on both the BetMGM and MGM app.',
          },
        ],
      },
    ],
  },
  'enablement-wins': {
    tag: 'BetMGM',
    title: 'Platform Enablement',
    company: 'Sr. Product Manager, Player Experience',
    desc: 'I led a mix of key strategic initiatives for our BetMGM Rewards Program. Some were focused on getting the brilliant basics right, others were enabling key partnerships like Marriott.',
    impact: [],
    screens: [
      {
        label: 'Marriott',
        gallery: [
          '/images/betmgm/marriott-1.webp',
          '/images/betmgm/marriott-3.webp',
        ],
        caption: 'We enabled Marriott account linking, point transfers, and other benefits to BetMGM players. The partnership was one of a kind and made various loyalty and points blogs, including "The Points Guy".',
      },
      {
        label: 'Global BRPs',
        img: '/images/betmgm/global-brps-creative-copy.webp',
        caption: 'Before this, your BetMGM Rewards Points (BRPs) were locked to the state you earned them in. Play in Vegas, live in New York. Those points didn\'t follow you home. About 45% of our multi-state players were affected. We fixed it: one account, one points balance.',
      },
    ],
  },
  'ai-betmgm': {
    tag: 'BetMGM',
    title: 'AI at BetMGM',
    company: 'Sr. Product Manager, Player Experience',
    desc: 'One of my favorite initiatives. I saw the external push other companies had for AI and wanted BetMGM to be at the forefront. I co-led an AI Enablement Initiative, where the goal was to have every employee have their own "Operating System" (OS). We started with a Product OS and are quickly scaling across the business.',
    impact: [],
    screens: [
      {
        label: 'Personal OS',
        img: '/images/betmgm/operating-system.webp',
        imgWidth: '420px',
        caption: 'We created an AI repository that included onboarding videos, pre-made templates, and guides to getting started with your Personal Operating System.',
      },
      {
        label: 'Team OS',
        img: '/images/betmgm/team-os2.webp',
        imgWidth: '900px',
        caption: 'We wanted everyone to be able to benefit from each other\'s context. So we created a git repo and called it Team OS, which allows us to scale context across the product org, including A/B tests, user research, roadmaps.',
      },
    ],
  },
  'meta-overview': {
    tag: 'Meta',
    title: 'Meta',
    company: 'Product Operations Manager, SMX · 2021–2024',
    sidePhoto: '/images/meta/meta-hq.webp',
    sidePhotoWide: true,
    desc: 'I was lucky enough to break into consumer-facing product at Meta, where I led Product Operations for Stories and Messaging Experience (SMX). It was a horizontal PM role, supporting several engineering teams and splitting my focus between roadmap brainstorming and new feature launches.',
    highlights: [
      {
        label: 'External User Feedback Process',
        project: 'external-feedback',
      },
      {
        label: 'Highlighted Features',
        project: 'highlighted-features',
      },
      {
        label: 'Product Feedback',
        project: 'product-feedback',
      },
    ],
    screens: [],
  },
  'external-feedback': {
    tag: 'Meta',
    title: 'External User Feedback Process',
    company: 'Product Operations Manager, SMX',
    desc: 'I redesigned how users report issues and give feedback across Stories and Messaging. The new reporting flow tripled feedback volume without compromising user privacy, giving the team much faster signal for triage and prioritization. We then partnered with engineering to use machine learning to automatically diagnose new issues and trends.',
    impact: [],
    screens: [
      {
        label: 'Report Menu',
        img: '/images/meta/external-signal-1.webp',
        imgWidth: '220px',
        imgHover: '/images/meta/external-signal-1-zoom.webp',
        imgHoverPos: '15%',
        caption: 'Every story includes reporting options right in the menu, from a quick "Not interested" to a formal "Report story" for more serious issues.',
      },
      {
        label: 'Report Flow',
        img: '/images/meta/external-signal-2.webp',
        imgWidth: '220px',
        caption: 'Reporting a technical problem lets users describe what went wrong and attach a screenshot or screen recording, giving the team far richer context than a bug report alone.',
      },
    ],
  },
  'highlighted-features': {
    tag: 'Meta',
    title: 'Highlighted Features',
    company: 'Product Operations Manager, SMX',
    desc: 'Every key feature we built felt like a unique experience, but the underlying theme was that Meta had the art down to a science. The ability to A/B test, iterate, and gather data and insights was as good as it gets. And when you\'re shipping to billions of users, the bar to getting a feature fully rolled out was so high.',
    impact: [],
    screens: [
      {
        label: 'Midcards',
        img: '/images/meta/midcards.webp',
        imgWidth: '220px',
        caption: 'Midcards is a big driver for several Stories metrics, including creation and reactions. I helped generate new midcards, iterate on existing ideas, and unship the ones that weren\'t working.',
      },
      {
        label: 'Stories Comments',
        img: '/images/meta/comments.webp',
        imgWidth: '220px',
        imgHover: '/images/meta/comments-zoom.webp',
        imgHoverPos: '72%',
        caption: 'I learned so much working on this feature. We iterated and tested for my entire time at Meta and ultimately never fully rolled it out, but it\'s made its way to Instagram!',
      },
    ],
  },
  'product-feedback': {
    tag: 'Meta',
    title: 'Product Feedback',
    company: 'Product Operations Manager, SMX',
    desc: 'I was the voice of the customer, and turned user feedback into actionable roadmap items, oftentimes quick wins. This was less about big projects, but arguably some of my most valuable and impactful work, and where I learned how much little details made a difference!',
    impact: [],
    screens: [
      {
        label: 'Audio Toggle',
        img: '/images/meta/music-and-reactions.webp',
        imgWidth: '220px',
        imgHover: '/images/meta/audio-toggle-zoom.webp',
        imgHoverPos: '12%',
        caption: 'Users complained that music was broken, but many times their phone\'s audio wasn\'t on or the story itself had no audio. The toggle helped distinguish what was going on.',
      },
      {
        label: 'Reactions',
        img: '/images/meta/reactions-2.webp',
        imgWidth: '220px',
        imgHover: '/images/meta/reactions-zoom.webp',
        imgHoverPos: '82%',
        caption: 'I partnered with engineering to constantly iterate on the right reaction options, the signals that confirmed a user\'s action, and how we surfaced that back to story creators.',
      },
    ],
  },
  'deloitte-overview': {
    tag: 'Overview',
    title: 'Deloitte',
    company: 'Business Analyst · 2019–2021',
    sideGallery: [
      '/images/deloitte/deloitte-full-time.webp',
      '/images/deloitte/deloitte-full-time-2.webp',
      '/images/deloitte/deloitte-3.webp',
    ],
    desc: 'I started my career at Deloitte Consulting, first as a summer intern and then full-time as a Business Analyst. It was one of the best ways to start a career. I still remember how much my day-to-day changed when the world shut down in 2020 (I was at a sushi bar in SF for a client project). I built products for internal teams, which is where I realized I eventually wanted to become a product manager.',
    impact: [
      'Led a digital transformation for a global tech company: financial system upgrade for 5,000+ employees across 4 countries, on time',
      'Designed self-service HR tools (name/address changes, manager approvals) adopted by 10,000+ employees',
      'Implemented a JIRA-based case management system that improved ops for 500+ weekly inquiries',
    ],
    impactLabel: 'Selected Product Experience',
    screens: [],
  },
  'ucla-overview': {
    tag: 'Education',
    title: 'UCLA',
    company: 'B.A. Business Economics · Graduated Dec 2019',
    desc: 'UCLA was my dream school and some of the best years of my life! I always get nostalgic thinking about it. Go Bruins!',
    impact: [],
    screens: [
      {
        label: 'Education',
        gallery: [
          '/images/ucla/uclagrad.webp',
          '/images/ucla/social-enterprise-academy.webp',
        ],
        bullets: [
          '2019 William Sharpe Fellow in Consulting. 1 of 20 students selected for the award, honoring the top Economics students each year.',
          '1 of 50 selected for the Social Enterprise Academy, a full-year program where we partnered with nonprofits to help develop a social enterprise.',
        ],
      },
      {
        label: 'Clubs',
        gallery: [
          '/images/ucla/180-degrees.webp',
          '/images/ucla/pse.webp',
          '/images/ucla/startup-grind.webp',
        ],
        bullets: [
          '180 Degrees Consulting, Project Lead. Ran client engagements for nonprofits and social enterprises.',
          'Pi Sigma Epsilon, VP of Professional Development.',
          'Undergraduate Business Society (UBS) Consulting Workshop Participant: 1 of 25 selected for the 2-month program, which included private sessions with consulting firms and interview prep, ultimately landing my Deloitte internship.',
          'Startup Grind LA, one of 4 chapter members hosting events for the LA startup community. Pictured hosting author Alex Banayan for his book The Third Door.',
        ],
      },
      {
        label: 'Internships',
        gallery: [
          '/images/ucla/svb.webp',
          '/images/ucla/svb-2.webp',
          '/images/ucla/deloitte-internship.webp',
          '/images/ucla/deloitte-internship-2.webp',
        ],
        caption: 'I took the unique approach of doing internships while taking classes. I\'d stack my classes into 2 days a week, then spend the other 2-3 days at the internship. It gave me invaluable experience and helped me understand the professional world a bit better.',
        timeline: [
          {
            period: 'Sophomore Year',
            company: 'Watertower Ventures',
            role: 'Venture Capital Intern, full year',
          },
          {
            period: 'Summer',
            company: 'Silicon Valley Bank',
            role: 'Summer Analyst',
          },
          {
            period: 'Junior Year',
            company: 'Ordermark / Nextbite',
            role: 'Operations Intern, fall (4 mo).<br>Later raised $120M Series C from SoftBank.',
          },
          {
            period: 'Summer',
            company: 'Deloitte',
            role: 'Summer Analyst. Received a full-time offer.',
          },
          {
            period: 'Senior Year',
            company: 'VaynerMedia',
            role: 'Marketing & Biz Analytics Intern, fall (4 mo)',
          },
        ],
      },
    ],
  },
};
