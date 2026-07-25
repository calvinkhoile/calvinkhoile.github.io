# Cursor Marketing Site — Design System

## Overview

Cursor's marketing site reads as a quietly-confident developer brand that believes in editorial calm over IDE-darkness. The base canvas is **warm cream** (`{colors.canvas}` — #f7f7f4) holding warm near-black ink (`{colors.ink}` — #26251e) for body and display alike. The single brand voltage is **Cursor Orange** (`{colors.primary}` — #f54e00) reserved for primary CTAs and the wordmark — used scarcely.

Type runs **CursorGothic** as the single sans family. Display sits at weight 400 with negative letter-spacing — a magazine-editorial voice rather than tech-bombastic. JetBrains Mono carries every code surface (and code surfaces are roughly half the page).

The brand's strongest visual signature is the **AI-timeline pill palette**: five pastel pills (peach `{colors.timeline-thinking}`, mint `{colors.timeline-grep}`, blue `{colors.timeline-read}`, lavender `{colors.timeline-edit}`, gold `{colors.timeline-done}`) marking AI-action stages inside in-product timeline visualizations. Used only in product UI — never as system action colors.

**Key Characteristics:**

- Warm cream canvas, not white. Ink is warm (#26251e), not pure black.
- Single CTA color: `{colors.primary}` (Cursor Orange #f54e00). Used scarcely.
- Display weight stays at 400 — never bold. Magazine voice.
- AI timeline pastels: 5 dedicated tokens for in-product agent action stages.
- Compact 8px CTA radius — developer dialect.
- Hairline-only depth; no drop shadows.
- 80px section rhythm.

---

## Colors

### Brand & Accent

- **Cursor Orange** (`{colors.primary}` — #f54e00): Primary CTA pills, wordmark, hero accent. Used scarcely.
- **Cursor Orange Active** (`{colors.primary-active}` — #d04200): Press state.

### Surface

- **Canvas** (`{colors.canvas}` — #f7f7f4): Warm cream page floor.
- **Canvas Soft** (`{colors.canvas-soft}` — #fafaf7): IDE-pane background inside mockups.
- **Surface Card** (`{colors.surface-card}` — #ffffff): Pure white card surface — slight contrast against the cream canvas.
- **Surface Strong** (`{colors.surface-strong}` — #e6e5e0): Badges, tag pills.

### Hairlines

- **Hairline** (`{colors.hairline}` — #e6e5e0): 1px divider.
- **Hairline Soft** (`{colors.hairline-soft}` — #efeee8): Lighter divider.
- **Hairline Strong** (`{colors.hairline-strong}` — #cfcdc4): Stronger panel outline.

### Text

- **Ink** (`{colors.ink}` — #26251e): Display, body emphasis. Warm near-black.
- **Body** (`{colors.body}` — #5a5852): Default running-text.
- **Body Strong** (`{colors.body-strong}` — #26251e): Same as ink.
- **Muted** (`{colors.muted}` — #807d72): Sub-titles.
- **Muted Soft** (`{colors.muted-soft}` — #a09c92): Disabled text.
- **On Primary** (`{colors.on-primary}` — #ffffff): White text on Cursor Orange.

### Timeline (AI-action signature)

- **Thinking** (`{colors.timeline-thinking}` — #dfa88f): Peach. Used inside in-product agent timeline only.
- **Grep** (`{colors.timeline-grep}` — #9fc9a2): Mint.
- **Read** (`{colors.timeline-read}` — #9fbbe0): Pastel blue.
- **Edit** (`{colors.timeline-edit}` — #c0a8dd): Lavender.
- **Done** (`{colors.timeline-done}` — #c08532): Warm gold.

### Semantic

- **Success** (`{colors.semantic-success}` — #1f8a65): Confirmation indicators.
- **Error** (`{colors.semantic-error}` — #cf2d56): Validation errors.

---

## Dark Mode

The system supports a full dark-mode inversion. When active, the canvas flips to a deep warm charcoal and all surface/text tokens remap. The brand voice (CursorGothic 400, Cursor Orange CTA, hairline-only depth, 8px radius) stays identical — only the surface palette changes.

### Dark Mode — Surface

- **Canvas Dark** (`{colors.dark.canvas}` — #1a1a1a): Deep warm charcoal page floor. Replaces `{colors.canvas}`.
- **Canvas Dark Soft** (`{colors.dark.canvas-soft}` — #222222): IDE-pane background inside mockups on dark mode.
- **Surface Dark Card** (`{colors.dark.surface-card}` — #2a2a2a): Card surface — slight lift above the dark canvas.
- **Surface Dark Strong** (`{colors.dark.surface-strong}` — #3a3a3a): Badges, tag pills on dark mode.

### Dark Mode — Hairlines

- **Hairline Dark** (`{colors.dark.hairline}` — #3a3a3a): 1px divider on dark canvas.
- **Hairline Dark Soft** (`{colors.dark.hairline-soft}` — #2e2e2e): Lighter divider on dark canvas.
- **Hairline Dark Strong** (`{colors.dark.hairline-strong}` — #4a4a4a): Stronger panel outline on dark canvas.

### Dark Mode — Text

- **On Dark** (`{colors.dark.ink}` — #e8e6e1): Primary text on dark canvas. Warm off-white — never pure #ffffff.
- **Body Dark** (`{colors.dark.body}` — #a8a5a0): Default running-text on dark canvas.
- **Body Dark Strong** (`{colors.dark.body-strong}` — #e8e6e1): Same as dark ink.
- **Muted Dark** (`{colors.dark.muted}` — #807d72): Sub-titles on dark canvas.
- **Muted Dark Soft** (`{colors.dark.muted-soft}` — #5a5852): Disabled text on dark canvas.

### Dark Mode — Brand & Accent

- **Cursor Orange** stays `{colors.primary}` (#f54e00) on dark mode — unchanged. The orange reads even more vividly against the dark canvas.
- **On Primary** stays `{colors.on-primary}` (#ffffff) — white text on orange CTAs.

### Dark Mode — Timeline Pills

Timeline pill backgrounds stay identical (#dfa88f, #9fc9a2, #9fbbe0, #c0a8dd, #c08532) but text flips to `{colors.dark.canvas}` (#1a1a1a) for contrast on the pastel backgrounds. Exception: `{colors.timeline-done}` (gold) keeps white text.

### Dark Mode — Semantic

- **Success Dark** (`{colors.dark.semantic-success}` — #2ecc8f): Brightened for dark-canvas legibility.
- **Error Dark** (`{colors.dark.semantic-error}` — #f25c7a): Brightened for dark-canvas legibility.

### Dark Mode — Elevation & Depth

The hairline-only depth philosophy stays. Cards on dark canvas use `{colors.dark.surface-card}` (#2a2a2a) against `{colors.dark.canvas}` (#1a1a1a) — the subtle lift comes from the 10-unit value difference rather than shadows. Hairlines use `{colors.dark.hairline}` (#3a3a3a).

---

## Typography

### Font Family

**CursorGothic** is the licensed display + body family. Fallback: `system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif`. Code surfaces switch to **JetBrains Mono**.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-mega}` | 72px | 400 | 1.1 | -2.16px | Homepage hero h1 |
| `{typography.display-lg}` | 36px | 400 | 1.2 | -0.72px | Section heads |
| `{typography.display-md}` | 26px | 400 | 1.25 | -0.325px | Sub-section heads |
| `{typography.display-sm}` | 22px | 400 | 1.3 | -0.11px | Card group titles |
| `{typography.title-md}` | 18px | 600 | 1.4 | 0 | Component titles |
| `{typography.title-sm}` | 16px | 600 | 1.4 | 0 | List labels |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | Default body |
| `{typography.body-tracked}` | 16px | 400 | 1.5 | 0.08px | Tracked editorial body |
| `{typography.body-sm}` | 14px | 400 | 1.5 | 0 | Footer body |
| `{typography.caption}` | 13px | 400 | 1.4 | 0 | Photo captions |
| `{typography.caption-uppercase}` | 11px | 600 | 1.4 | 0.88px | Section labels, timeline pill labels |
| `{typography.code}` | 13px | 400 | 1.5 | 0 | Code blocks — JetBrains Mono |
| `{typography.button}` | 14px | 500 | 1.0 | 0 | CTA pill labels |
| `{typography.nav-link}` | 14px | 500 | 1.4 | 0 | Top-nav menu |

### Principles

- **Display weight stays at 400.** Magazine voice, never bold.
- **Negative letter-spacing on display only.** -0.11px to -2.16px tracking.
- **JetBrains Mono on every code surface.**

### Note on Font Substitutes

CursorGothic is licensed. Open-source substitute: **Inter** at weight 400 with letter-spacing -1.5%. Or **GT Sectra** for a more editorial feel.

---

## Layout

### Spacing System

- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.base}` 16px · `{spacing.md}` 20px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 80px.
- **Section padding:** 80px.

### Grid & Container

- Max content width: ~1200px.
- Editorial body: 12-column grid.
- Feature card grids: 2-up at desktop for splits, 3-up for benefits.
- Footer: 5-column at desktop.

### Whitespace Philosophy

Generous editorial pacing — closer to a print magazine than a tech site. The cream canvas has plenty of breathing room; cards within bands sit close (16-24px gap).

---

## Elevation & Depth

The system uses **hairline-only depth**. No drop shadows, no elevation tiers. Cards float above the canvas via 1px hairlines and the slight white-on-cream contrast (or dark-card-on-dark-canvas contrast in dark mode).

| Level | Treatment (Light) | Treatment (Dark) | Use |
|---|---|---|---|
| Flat (canvas) | `{colors.canvas}` (#f7f7f4) | `{colors.dark.canvas}` (#1a1a1a) | Body bands, footer |
| Card | `{colors.surface-card}` (#ffffff) | `{colors.dark.surface-card}` (#2a2a2a) | Content cards |
| Hairline border | 1px `{colors.hairline}` (#e6e5e0) | 1px `{colors.dark.hairline}` (#3a3a3a) | Card outlines, dividers |
| IDE pane | `{colors.canvas-soft}` (#fafaf7) | `{colors.dark.canvas-soft}` (#222222) | Inside IDE mockup cards |

### Decorative Depth

- **IDE-mockup cards** are the only "elevated" element. White card on cream canvas (or dark card on dark canvas) with internal pane structure mimicking the actual Cursor editor.
- **Timeline pastel pills** add chromatic depth without surface elevation.

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Reserved |
| `{rounded.xs}` | 4px | Inline tags |
| `{rounded.sm}` | 6px | Compact rows |
| `{rounded.md}` | 8px | CTA buttons, form inputs |
| `{rounded.lg}` | 12px | Cards, IDE panes |
| `{rounded.xl}` | 16px | Larger feature cards (rare) |
| `{rounded.pill}` | 9999px | Timeline pills, badges |
| `{rounded.full}` | 9999px | Avatars (rare) |

---

## Components

### Top Navigation

**`top-nav`** — Background `{colors.canvas}` (light) / `{colors.dark.canvas}` (dark), text `{colors.ink}` / `{colors.dark.ink}`, height 64px. Layout: Cursor wordmark left, primary horizontal menu (Pricing / Features / Enterprise / Blog / Forum / Careers), Sign In + Download primary CTA right.

### Buttons

**`button-primary`** — The signature Cursor Orange CTA. Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}` (14px / 500), padding 10px × 18px, height 40px, rounded `{rounded.md}` (8px). Identical in both light and dark mode.

**`button-primary-active`** — Press state. Background `{colors.primary-active}`.

**`button-secondary`** — Light mode: Background `{colors.surface-card}`, text `{colors.ink}`, 1px `{colors.hairline-strong}` border. Dark mode: Background `{colors.dark.surface-card}`, text `{colors.dark.ink}`, 1px `{colors.dark.hairline-strong}` border.

**`button-tertiary-text`** — Inline text link. Color `{colors.ink}` (light) / `{colors.dark.ink}` (dark).

**`button-download`** — Larger ink-canvas CTA. Light mode: Background `{colors.ink}`, text `{colors.canvas}`. Dark mode: Background `{colors.dark.ink}`, text `{colors.dark.canvas}`. Padding 12px × 20px, height 44px.

### Hero & IDE Mockups

**`hero-band`** — Background `{colors.canvas}` (light) / `{colors.dark.canvas}` (dark), full-width display headline in `{typography.display-mega}` (72px / 400 / -2.16px), subhead in `{typography.body-md}`, two CTAs (`button-download` + `button-tertiary-text`), and a centered IDE-mockup card below the hero copy.

**`ide-mockup-card`** — A card containing a multi-pane IDE mockup (sidebar + main editor + chat panel + terminal). Light: Background `{colors.surface-card}`, 1px `{colors.hairline}` border. Dark: Background `{colors.dark.surface-card}`, 1px `{colors.dark.hairline}` border. Rounded `{rounded.lg}` (12px), no padding (panes fill the card edge-to-edge).

**`ide-pane`** — Individual IDE pane inside the mockup. Light: Background `{colors.canvas-soft}`, text `{colors.body}`. Dark: Background `{colors.dark.canvas-soft}`, text `{colors.dark.body}`. Type `{typography.code}` (JetBrains Mono 13px), rounded `{rounded.md}` (8px), padding 16px.

### Cards

**`feature-card`** — Light: Background `{colors.surface-card}`, text `{colors.ink}`, 1px `{colors.hairline}` border. Dark: Background `{colors.dark.surface-card}`, text `{colors.dark.ink}`, 1px `{colors.dark.hairline}` border. Type `{typography.title-md}`, rounded `{rounded.lg}`, padding 24px.

**`comparison-card`** — Side-by-side "Cursor vs other tools" card. Same surface and rounding as `feature-card`; internally split into 2 columns.

**`testimonial-card`** — Quote card. Same surface tokens as `feature-card`, text `{colors.body}` / `{colors.dark.body}`, rounded `{rounded.lg}`, padding 24px.

### AI Timeline (signature)

**`timeline-pill-thinking`** — Peach pill. Background `{colors.timeline-thinking}`, text `{colors.ink}` (light) / `{colors.dark.canvas}` (dark), type `{typography.caption-uppercase}` (11px / 600 / 0.88px tracking, uppercase), rounded `{rounded.pill}`, padding 4px × 10px. Marks "Thinking" stage in product timeline.

**`timeline-pill-grep`** — Mint pill. Same shape, background `{colors.timeline-grep}`. Marks "Grepping" stage.

**`timeline-pill-read`** — Pastel-blue pill. Background `{colors.timeline-read}`. Marks "Reading" stage.

**`timeline-pill-edit`** — Lavender pill. Background `{colors.timeline-edit}`. Marks "Editing" stage.

**`timeline-pill-done`** — Gold pill. Background `{colors.timeline-done}`, text `{colors.on-primary}` white (both modes). Marks "Done" stage.

### Code

**`code-block`** — Light: Background `{colors.surface-card}`, text `{colors.ink}`, 1px `{colors.hairline}` border. Dark: Background `{colors.dark.surface-card}`, text `{colors.dark.ink}`, 1px `{colors.dark.hairline}` border. Type `{typography.code}`, rounded `{rounded.lg}`, padding 20px.

### Pricing

**`pricing-tier-card`** — Light: Background `{colors.surface-card}`, 1px `{colors.hairline}` border. Dark: Background `{colors.dark.surface-card}`, 1px `{colors.dark.hairline}` border. Rounded `{rounded.lg}`, padding 32px.

**`pricing-tier-featured`** — Featured tier inverts. Light: Background `{colors.ink}`, text `{colors.canvas}`. Dark: Background `{colors.dark.ink}`, text `{colors.dark.canvas}`. Same shape, inversion signals "highlighted" without colored ribbon.

### Forms & Tags

**`text-input`** — Light: Background `{colors.surface-card}`, text `{colors.ink}`. Dark: Background `{colors.dark.surface-card}`, text `{colors.dark.ink}`. Rounded `{rounded.md}` (8px), padding 12px × 16px, height 44px.

**`badge-pill`** — Small uppercase pill. Light: Background `{colors.surface-strong}`, text `{colors.ink}`. Dark: Background `{colors.dark.surface-strong}`, text `{colors.dark.ink}`. Type `{typography.caption-uppercase}`, rounded `{rounded.pill}`, padding 4px × 10px.

### CTA / Footer

**`cta-band`** — Pre-footer "Try Cursor now" band. Background `{colors.canvas}` / `{colors.dark.canvas}`, centered display headline in `{typography.display-lg}`, single Cursor Orange CTA. 96px vertical padding.

**`footer`** — Closing footer. Background `{colors.canvas}` / `{colors.dark.canvas}`, text `{colors.body}` / `{colors.dark.body}`. 5-column link list. 64×48px padding.

**`footer-link`** — Background transparent, text `{colors.body}` / `{colors.dark.body}`, type `{typography.body-sm}`.

---

## Do's and Don'ts

### Do

- Reserve `{colors.primary}` (Cursor Orange) for primary CTAs and brand wordmark — in both light and dark mode.
- Keep display weight at 400. The editorial voice depends on this.
- Use the cream `{colors.canvas}` page floor in light mode — never pure white. Use `{colors.dark.canvas}` (#1a1a1a) in dark mode — never pure black.
- Render every code surface (inline, blocks, IDE panes) in JetBrains Mono.
- Use timeline pastels only inside in-product agent visualizations — never as system action colors.
- In dark mode, use warm off-white `{colors.dark.ink}` (#e8e6e1) for primary text — never pure #ffffff.
- Maintain the same hairline-only depth philosophy in dark mode. No shadows, just subtle surface-value differences.

### Don't

- Don't introduce a secondary brand action color. Cursor Orange is the only one — in both modes.
- Don't drop display to bold weights (700+). Magazine voice depends on 400.
- Don't add drop shadows in either mode. Hairlines + surface contrast carry the depth.
- Don't use timeline pastels on non-timeline UI. They're scoped to the agent timeline only.
- Don't extract a CTA color from a third-party widget (cookie consent, OneTrust). The brand's CTA is what appears on actual product CTAs.
- Don't use pure black (#000000) as the dark-mode canvas. The system uses warm charcoal (#1a1a1a) to maintain the editorial warmth.
- Don't use pure white (#ffffff) as dark-mode text. Use the warm off-white `{colors.dark.ink}` (#e8e6e1).

---

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 640px | Hero h1 72→32px; IDE mockup collapses to single pane preview; feature grid 1-up; nav hamburger. |
| Tablet | 640–1024px | Hero h1 56px; IDE mockup compresses; feature grid 2-up. |
| Desktop | 1024–1280px | Full hero h1 72px; full multi-pane IDE mockup; feature grid 3-up. |
| Wide | > 1280px | Content caps at 1200px. |

### Touch Targets

- Primary CTA at 40px height — at WCAG AA, padded for AAA.
- Download CTA at 44px — at AAA.

### Collapsing Strategy

- Top nav switches to hamburger below 768px.
- IDE mockup multi-pane collapses to a single primary pane preview on mobile.
- Feature grid: 3-up → 2-up → 1-up.

---

## Iteration Guide

1. Focus on a single component at a time.
2. CTAs default to `{rounded.md}` (8px). Cards use `{rounded.lg}` (12px).
3. Variants live as separate entries inside `components:`.
4. Use `{token.refs}` everywhere — never inline hex.
5. Hover state never documented.
6. CursorGothic 400 for display, 400/500/600 for body. JetBrains Mono on every code surface.
7. Cursor Orange stays scarce — in both light and dark mode.
8. Timeline pastels stay scoped to in-product agent visualizations.
9. When building dark-mode components, swap the surface/text token set but keep shape, spacing, and typography identical.
10. Dark mode text uses warm off-white (#e8e6e1), not pure white. Dark mode canvas uses warm charcoal (#1a1a1a), not pure black.

---

## Known Gaps

- CursorGothic is a licensed typeface; Inter is the substitute.
- Animation timings (timeline pill entrance, IDE pane reveal) out of scope.
- In-app surfaces (code editor, chat panel, agent timeline) only partially captured via marketing IDE mockups.
- Form validation states beyond focus not visible on captured surfaces.
- Dark mode preference detection (system vs. manual toggle) is implementation-specific and not documented here.
- Dark mode contrast ratios should be verified against WCAG AA (4.5:1 for body text, 3:1 for large text) — the warm off-white on warm charcoal combination meets AA but should be tested at caption sizes.
