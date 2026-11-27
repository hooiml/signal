# Signal V9 Design Concepts

Signal opens the V9 workspace at `/v9`. Its default view is Market Pulse. The older
`?view=home` link also opens Market Pulse. For UI work, start with the
[workspace component](../../src/components/v9/V9Workspace.tsx) and its
[stylesheet](../../src/components/v9/v9-workspace.module.css). The [route guide](../ARCHITECTURE.md#user-facing-routes)
describes the available views, and [`docs/V9_ENHANCEMENT_ROADMAP.md`](../V9_ENHANCEMENT_ROADMAP.md)
tracks the prioritized V9 enhancements and refinements. The HTML prototypes below record earlier design decisions.

## Archived Versions

| Version | File | Summary |
| :--- | :--- | :--- |
| **v9.0** | [`signal-v9.0-flagship.html`](./signal-v9.0-flagship.html) | Frozen flagship baseline introducing elevated surfaces, ambient posture lighting, luminous semi-circle arc gauge, smooth gradient area charts, brand ticker squircles, Discover & Compare, and Quick-Peek drawer. |
| **v9.0.1** | [`signal-v9.0.1-flagship.html`](./signal-v9.0.1-flagship.html) | Complete V9 design specification: WCAG AA/AAA text contrast overhaul (Light & Dark), softened Calm Monochrome chrome (zero OLED glare), hairline-divided lists replacing nested boxes, live `Momentum`/`Contrarian` + `Include Social` + Partial Data (`65%`) states, Chart Review Pins + click-to-measure range, Financials `Quality` tab (share count/buybacks, cash-vs-debt cushion, 5Y P/E range), collapsible Decision Journal, Portfolio `USD`/`MYR` toggle, top-bar Alerts popover & unified Settings drawer, and `0px`-overflow `390px` mobile layouts with stacked bottom-nav icons. |

## Rollout history

1. **Phase 1 (Merged in PR #68):** Archived `v9.0` + `v9.0.1` specs; upgraded V8 tokens to `v9.0.1` Calm Monochrome + WCAG AA/AAA contrast; added `⌘K` Quick Jump palette; upgraded Market Hero with luminous semi-circle arc gauge, ambient posture lighting, 3-column Latest Market Brief grid, segmented coverage bar, hover-scrubbing score chart, and local What-If VIX Stress Test.
2. **Phase 2 (`feat/v9-main-workspace`):** Live-data V9.0.1 Flagship Workspace at `/v9` (set as the default route for `/`), featuring the collapsible desktop sidebar, mobile icon-over-text bottom navigation, Morning Briefing Home hub (live US/MY pulse cards, Daily Brief, Today’s Focus, Watchlist Pulse, saved portfolio summary), Market Pulse, Portfolio, Discover, and Stock Research (interactive hover-scrub SVG price chart, key metrics, Target Entry Guardrail, inline guest notes, and annual financials). Classic `/main-v8` and `/research-v8` remain intact alongside `/v9`.
