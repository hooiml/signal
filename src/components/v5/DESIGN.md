# Signal V5 Design System

## 1. Atmosphere & Identity

An editorial market-intelligence console: high-contrast, data-led, and immediately recognizable without becoming noisy. The signature is the **signal field**: an ink workspace, acid-lime identity mark, faint analytical grid, and semantic rails that move the eye from posture to score, evidence, risk, and next action.

## 2. Color

| Role | Token | Value | Usage |
|---|---|---:|---|
| Canvas | --v5-canvas | #F2F4EF | App background |
| Surface | --v5-surface | #FFFFFF | Primary working surfaces |
| Surface soft | --v5-surface-soft | #F4F6F2 | Secondary facts and controls |
| Ink | --v5-ink | #17201D | Headlines and primary text |
| Muted ink | --v5-muted | #71717A | Supporting text |
| Border | --v5-border | #E4E4E7 | Dividers and panel boundaries |
| Signal | --v5-signal | #17745A | Positive decisions, selected states, focus |
| Signal soft | --v5-signal-soft | #E8F3EF | Positive decision atmosphere |
| Info | --v5-info | #2F62D5 | Owned/DCA and informational actions |
| Warning | --v5-warning | #B86E00 | Wait, change conditions, caution |
| Risk | --v5-risk | #C73C35 | Avoid, thesis breaks, risk |
| Console ink | --v5-dark | #151916 | Navigation, market hero, research queue |
| Identity lime | --v5-lime | #B8F14B | Brand mark, selected navigation, focus identity |

Semantic colors remain tied to data. Identity lime is reserved for navigation, selected dossiers, and the live posture label so it never competes with investment meaning.

## 3. Typography

- Primary: Source Sans 3, system sans-serif.
- Data: Roboto Mono, monospace.
- Decision headline: 32-36px desktop / 24px mobile, 900, tight line height.
- Section heading: 14px, 700.
- Body: 14px minimum for new prominent copy; dense evidence may remain 12px.
- Overline: 10-11px mono, 700, uppercase, normal letter spacing where space is tight.
- Letter spacing remains 0 except existing compact overlines.

## 4. Spacing & Layout

- Base unit: 4px.
- App canvas: max-width 1240px with 16px mobile gutters.
- Panel padding: 24-32px desktop, 20-24px mobile.
- Section gaps: 24px.
- Repeated evidence rows: 12-16px vertical rhythm.
- Fixed-format metrics use stable grid tracks and never resize on hover.
- Mobile preserves the order: decision, next action, confidence, evidence, risk.

## 5. Components & Primitives

### Signal Hero
- Variants: positive, neutral, warning, risk.
- Anatomy: semantic rail, decision headline, compact status metadata, confidence visual.
- States: loading uses opacity plus an explicit status label; error replaces the hero.

### Action Pill
- Variants: Ready, DCA, Wait, Watch, Avoid.
- Compact metadata only; never substitutes for the plain-language recommendation.

### Evidence Driver
- Anatomy: label, score/weight context, contribution value, proportional contribution bar.
- Bars explain relative magnitude and use semantic direction color.

### Decision Summary
- Anatomy: recommendation rail, next action band, three key facts, why/risk columns.
- The next action always appears above detailed evidence.

### Tabs and Filter Controls
- Selected state uses ink or signal color, visible underline, and stable dimensions.
- Horizontal sets swipe on mobile with hidden scrollbars and partially visible continuation.

## 6. Motion & Interaction

- Micro transitions: 150ms ease-out for color/opacity.
- Panel/tab entry: immediate to preserve a crisp operational feel.
- Loading feedback uses opacity and explicit text, never layout movement.
- No decorative motion; current V5 interactions do not require motion fallbacks.

## 7. Depth & Surface

Mixed contrast strategy: ink console surfaces establish the primary hierarchy, white working surfaces preserve readability, and semantic tonal panels isolate decision context. Shadows are reserved for the main signal field; repeated operational content remains bordered and flat.

## 8. Accessibility Constraints & Accepted Debt

### Constraints
- Target WCAG 2.2 AA.
- Body contrast floor 4.5:1 and large text 3:1.
- All controls remain keyboard reachable with semantic buttons/links.
- Color is always paired with text labels, direction, or values.
- Horizontal content remains touch-scrollable without misleading non-interactive controls.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
|---|---|---|---|
| Existing 12px dense evidence copy | Evidence/detail tabs | Operational density inherited from V5; prominent actions are larger | Revisit only if user testing shows readability friction |
