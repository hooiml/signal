# Signal V9 Design Concepts

Standalone, interactive HTML reference prototypes capturing the V9 visual and interaction direction before and during incremental implementation into Next.js.

## Archived Versions

| Version | File | Summary |
| :--- | :--- | :--- |
| **v9.0** | [`signal-v9.0-flagship.html`](./signal-v9.0-flagship.html) | Frozen flagship baseline introducing elevated surfaces, ambient posture lighting, luminous semi-circle arc gauge, smooth gradient area charts, brand ticker squircles, Discover & Compare, and Quick-Peek drawer. |
| **v9.0.1** | [`signal-v9.0.1-flagship.html`](./signal-v9.0.1-flagship.html) | Complete V9 design specification: WCAG AA/AAA text contrast overhaul (Light & Dark), softened Calm Monochrome chrome (zero OLED glare), hairline-divided lists replacing nested boxes, live `Momentum`/`Contrarian` + `Include Social` + Partial Data (`65%`) states, Chart Review Pins + click-to-measure range, Financials `Quality` tab (share count/buybacks, cash-vs-debt cushion, 5Y P/E range), collapsible Decision Journal, Portfolio `USD`/`MYR` toggle, top-bar Alerts popover & unified Settings drawer, and `0px`-overflow `390px` mobile layouts with stacked bottom-nav icons. |

## Phased Rollout Into Signal

1. **Phase 1 (Current branch):** Archive `v9.0` + `v9.0.1` specs; upgrade V8 tokens to `v9.0.1` Calm Monochrome + WCAG AA/AAA contrast; upgrade shared App Shell header + `⌘K` Quick Jump palette; upgrade Market Hero with luminous semi-circle arc gauge, ambient posture lighting, 3-column Latest Market Brief grid, sleek segmented coverage bar, gradient hover-scrubbing score chart, and interactive local What-If VIX Stress Test.
2. **Phase 2:** Upgrade Research workspace (`Quality` tab for share dilution/buybacks & cash cushion, live Target Entry dashed line on price chart, chart review pins + range measure, collapsible Decision Journal).
3. **Phase 3:** Unified Morning Command Home + Portfolio `USD ↔ MYR` FX toggle + Discover head-to-head comparison modal.
