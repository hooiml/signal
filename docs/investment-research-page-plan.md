# Investment Research Page Plan

## Purpose

Add a separate investment research page for long-term investing decisions. The existing Signal dashboard should remain focused on market regime, sentiment, momentum, positioning, and source-quality evidence. The new page should answer a different question:

> Is this company or ETF worth owning, watching, adding to, or avoiding over an investing time horizon?

This page is for investing, not trading. Technical indicators such as MACD, RSI, moving averages, and trend should be secondary context, not the main reason to buy.

## Recommended Route

- Add page: `src/app/research/page.tsx`
- Add route name in navigation: `Research`
- Keep current dashboard at `/`
- Optional future detail route: `src/app/research/[symbol]/page.tsx`

## Product Boundary

### Keep On The Current Signal Dashboard

- Composite market signal
- Momentum and contrarian interpretation
- Evidence matrix
- Source alignment, freshness, coverage, and conflicts
- Market breadth and macro context
- Non-scored market backdrop such as valuation regime

### Move To The New Research Page

- Ticker-level watchlist
- Company thesis and risk notes
- Fundamental metrics
- Valuation metrics
- Earnings calendar and recent earnings summary
- News, filings, and transcript context
- Long-term technical context
- Personal decision checklist

## MVP Page Sections

### 1. Watchlist Overview

Add a dense table for tickers the user is actively tracking.

Fields:

- Symbol
- Company name
- Market
- Current price
- Daily change
- Research status: `Owned`, `Watch`, `Waiting`, `Avoid`
- Target buy zone
- Valuation state: `Cheap`, `Fair`, `Expensive`, `Unknown`
- Thesis strength: `High`, `Medium`, `Low`
- Last reviewed date

Purpose:

- Make it easy to scan what deserves attention.
- Separate long-term watchlist status from short-term market signal status.

### 2. Company Snapshot

Show one selected ticker at a time from the watchlist.

Fields:

- Business description
- Sector and industry
- Market cap
- Revenue growth
- Gross margin
- Operating margin
- Free cash flow trend
- Debt level
- Cash position
- Dilution or share-count trend

Purpose:

- Quickly explain what the business is and whether the fundamentals are improving or weakening.

### 3. Thesis Card

Add a clear thesis panel that forces investment thinking.

Fields:

- Why I am interested
- Main bull case
- Main bear case
- What would make me buy
- What would make me sell or avoid
- What would prove the thesis wrong

Purpose:

- Prevent the page from becoming only a data viewer.
- Make the user write the actual investment reason.

### 4. Valuation Snapshot

Show valuation in a way that supports investing decisions.

Fields:

- P/E
- Forward P/E if available
- Price/sales
- EV/EBITDA if available
- Free cash flow yield
- Dividend yield if relevant
- 5-year valuation range if available
- Peer comparison placeholder

Purpose:

- Help answer whether the business is attractive at the current price.
- Keep valuation separate from market sentiment.

### 5. Earnings And Events

Track upcoming and recent company-specific events.

Fields:

- Next earnings date
- Last earnings date
- Revenue result
- EPS result
- Guidance change
- Important event notes
- Link to source when available

Purpose:

- Let the user see what could change the investment thesis soon.

### 6. News, Filings, And Transcript Context

Add a research feed for company-level information.

Fields:

- Latest news
- SEC/Bursa filing links when available
- Earnings transcript summary when available
- Sentiment or relevance label
- Source and publication date

Purpose:

- Surface what changed since the last review.
- Avoid mixing company news with the existing market-level article context.

### 7. Technical Context

Add technical indicators as secondary context.

Fields:

- Price vs 50-day moving average
- Price vs 200-day moving average
- 52-week range
- RSI
- MACD direction
- Volume trend
- Support and resistance notes

Purpose:

- Help with timing and risk awareness.
- Do not let technical indicators override fundamentals and valuation.

### 8. Investment Checklist

Add a checklist that produces a visible readiness state.

Questions:

- Do I understand the business?
- Is revenue growing or stable?
- Are margins healthy or improving?
- Is debt manageable?
- Is free cash flow positive or improving?
- Is valuation reasonable?
- Is there a clear catalyst or long-term compounding reason?
- Is the downside acceptable?
- Is this better than holding cash or an index fund?

Output labels:

- `Ready`
- `Wait for better price`
- `Too uncertain`
- `Avoid`

Purpose:

- Turn scattered data into a decision-support workflow.

## Data And Integration Needs

## Resolved Implementation Decisions

These decisions are locked for the first production implementation pass.

### Data Source

Use EODHD as the primary provider for fundamental, valuation, quote, earnings, and technical-context data.

- Primary provider: EODHD Fundamentals API v1.1
- Provider symbol format: `{SYMBOL}.{EXCHANGE_CODE}`, for example `AAPL.US` and `1818.KLSE`
- Use EODHD for: company profile, market cap, revenue, margins, balance-sheet fields, cash-flow fields, valuation metrics, dividend yield, 52-week range, moving averages, earnings, and exchange symbol lookup
- Required environment variable: `EODHD_API_TOKEN`

Use Twelve Data as the fallback provider when EODHD is unavailable or does not cover a field needed by the UI.

- Fallback provider: Twelve Data Fundamentals
- Use Twelve Data for: profile, statistics, income statement, balance sheet, cash flow, earnings, market cap, and Malaysia `XKLS` coverage checks
- Required environment variable: `TWELVE_DATA_API_KEY`

Do not use Yahoo Finance as the production source for fundamentals or valuation. The existing Yahoo helper may remain for legacy market-signal price context, but the research page should normalize provider responses through a dedicated research data layer.

Provider failures must degrade by field. If price succeeds but valuation fails, render price and show `Unknown` for valuation. Do not block the whole page unless the selected symbol cannot be resolved.

### Persistence

Use Neon Postgres for persisted research state.

Persist these user-owned fields server-side:

- Watchlist metadata
- Research status
- Target buy zone
- Thesis fields
- Checklist booleans
- Last-reviewed timestamp
- User notes

Use `localStorage` only for unsaved draft text and UI preferences such as theme. Do not use a flat JSON file for app state because it will not work reliably in a deployed Vercel environment and will not scale to multi-device use.

Recommended tables:

- `research_watchlist`
- `research_theses`
- `research_checklists`
- `research_provider_snapshots`

Fetched provider data and user-authored research state must stay separate. Provider snapshots may be cached in Postgres with `provider`, `source_url`, `provider_symbol`, and `fetched_at`, but they must not overwrite user notes.

### Checklist Scoring Logic

The checklist has exactly nine boolean inputs:

```ts
type InvestmentChecklist = {
    understandBusiness: boolean;
    revenueGrowingOrStable: boolean;
    marginsHealthyOrImproving: boolean;
    debtManageable: boolean;
    freeCashFlowPositiveOrImproving: boolean;
    valuationReasonable: boolean;
    catalystOrCompoundingReason: boolean;
    downsideAcceptable: boolean;
    betterThanCashOrIndex: boolean;
};
```

Map those inputs to the output label with this logic:

```ts
function getReadiness(
    checklist: InvestmentChecklist,
): 'Ready' | 'Wait for better price' | 'Too uncertain' | 'Avoid' {
    const trueCount = Object.values(checklist).filter(Boolean).length;

    if (!checklist.downsideAcceptable) return 'Avoid';
    if (!checklist.debtManageable && !checklist.freeCashFlowPositiveOrImproving) return 'Avoid';

    if (!checklist.understandBusiness) return 'Too uncertain';
    if (trueCount <= 5) return 'Too uncertain';

    if (!checklist.valuationReasonable && trueCount >= 6) return 'Wait for better price';

    if (
        trueCount >= 8 &&
        checklist.valuationReasonable &&
        checklist.downsideAcceptable &&
        checklist.betterThanCashOrIndex
    ) {
        return 'Ready';
    }

    return 'Too uncertain';
}
```

Rules:

- `Avoid` is a hard risk gate.
- `Wait for better price` only appears when the business case is mostly intact but valuation is the blocker.
- `Ready` requires a strong checklist and must still be phrased as research readiness, not financial advice.
- Technical indicators must not feed this label.

### Mobile Watchlist Behavior

The desktop watchlist remains a dense 9-column table at `lg` and wider.

For tablet widths, use a compact table:

- Merge symbol, company, and market into one identity column.
- Merge status and readiness into one decision column.
- Keep price, buy zone, valuation, thesis strength, and reviewed date visible.

For mobile widths below `md`, replace the table with cards. Do not rely on horizontal scrolling as the main mobile experience.

Each mobile card must show:

- Symbol, company, and market
- Price and daily change
- Readiness label
- Research status
- Valuation state
- Thesis strength
- Last reviewed date

Move target buy zone and short thesis note into an expanded or selected detail area so card height stays scannable.

### Phase Priority Change

Move the Thesis Card and Checklist into the first persisted implementation slice. The research page is not differentiated by showing another finance data table; it is differentiated by forcing a clear personal thesis, risk case, invalidation condition, and review state.

### Reuse Existing Code Where Possible

Existing candidates:

- `src/lib/yahoo-finance.ts` for prices, quote-style data, and market data helpers
- `src/lib/rss-feeds.ts` for news-style context
- `src/lib/db.ts` if watchlist or notes should persist server-side
- `src/components/v2/cockpit-utils.ts` only for formatting helpers that are genuinely shared

Do not reuse the V2 market signal score as a stock buy score. The market signal can appear as background context, but it should not become the ticker research verdict.

### New Code Likely Needed

Types:

- `src/lib/types/research.ts`

Services:

- `src/lib/research/watchlist.ts`
- `src/lib/research/fundamentals.ts`
- `src/lib/research/valuation.ts`
- `src/lib/research/technical-context.ts`

API routes:

- `src/app/api/research/watchlist/route.ts`
- `src/app/api/research/symbol/[symbol]/route.ts`

Components:

- `src/components/research/ResearchDashboard.tsx`
- `src/components/research/WatchlistTable.tsx`
- `src/components/research/CompanySnapshot.tsx`
- `src/components/research/ThesisCard.tsx`
- `src/components/research/ValuationSnapshot.tsx`
- `src/components/research/EarningsEvents.tsx`
- `src/components/research/ResearchFeed.tsx`
- `src/components/research/TechnicalContext.tsx`
- `src/components/research/InvestmentChecklist.tsx`

## Data Source Rules

- Do not depend on TradingView as a data-export source.
- Use supported data sources or APIs.
- Store source URLs and update timestamps for every external data point where possible.
- Show `Unknown` instead of guessing when data is missing.
- Keep personal notes separate from fetched market data.

## Suggested Data Model

```ts
export interface ResearchWatchlistItem {
    symbol: string;
    name: string;
    market: 'US' | 'MY';
    status: 'owned' | 'watch' | 'waiting' | 'avoid';
    targetBuyPrice?: number;
    fairValueEstimate?: number;
    thesisStrength: 'high' | 'medium' | 'low' | 'unknown';
    lastReviewedAt?: string;
    notes?: string;
}

export interface InvestmentResearchSnapshot {
    symbol: string;
    quote: ResearchQuote;
    fundamentals: ResearchFundamentals;
    valuation: ResearchValuation;
    technicalContext: ResearchTechnicalContext;
    events: ResearchEvent[];
    feed: ResearchFeedItem[];
    checklist: InvestmentChecklistState;
    updatedAt: string;
}
```

## Implementation Phases

### Phase 1: Persisted Thesis Workspace And Research Shell

Add:

- `/research` route
- Navigation link
- Research types in `src/lib/types/research.ts`
- Neon tables for watchlist metadata, thesis fields, checklist state, notes, and last-reviewed timestamps
- Editable Thesis Card
- Editable Investment Checklist with the explicit readiness logic above
- Static provider sample data for quote, fundamentals, valuation, events, and technical context

Acceptance criteria:

- User can open `/research`.
- Page clearly feels separate from the market signal cockpit.
- Watchlist and selected-symbol panels render on desktop and mobile.
- User can save thesis fields and checklist state.
- Refreshing `/research` preserves saved personal research state.
- Readiness label is computed from checklist state, not manually assigned.
- Last-reviewed timestamp updates when the user saves the research state.

### Phase 2: Watchlist UX, Mobile Cards, And Theme Support

Add:

- Desktop 9-column table
- Tablet compact table
- Mobile watchlist cards
- Light and dark mode support for the research page
- Theme preference stored in `localStorage`
- Shared visual language with the main Signal cockpit without copying its hero treatment

Acceptance criteria:

- Desktop keeps the dense scan table.
- Mobile uses cards with no required horizontal scrolling.
- Light mode and dark mode both have readable contrast, visible borders, and clear selected states.
- The first viewport shows watchlist, selected ticker state, and thesis/readiness context.

### Phase 3: Live Quote And Basic Fundamentals

Add:

- Research types
- Symbol API route
- Quote data
- Basic company profile fields
- Fundamental metric cards
- EODHD provider adapter
- Twelve Data fallback adapter

Acceptance criteria:

- Selecting a ticker loads live or clearly timestamped quote data.
- Missing data renders as `Unknown`.
- External request parameters are validated at route boundaries.
- US and Bursa symbols both resolve through provider-specific symbols.
- Provider name, source URL, and fetched timestamp are available in the normalized snapshot.

### Phase 4: Valuation, Earnings, And Research Feed

Add:

- Valuation snapshot
- Earnings and event section
- Company-specific news/feed section
- Filing or transcript links when available

Acceptance criteria:

- Page shows what changed since the last review.
- Valuation is presented as context, not as a guaranteed target.
- Each feed item includes source and date.

### Phase 5: Technical Context

Add:

- Moving average context
- RSI
- MACD direction
- 52-week range
- Volume trend

Acceptance criteria:

- Technical context is visually secondary to fundamentals and thesis.
- MACD is labeled as momentum context, not an investing verdict.
- The page does not imply chart signals are financial advice.

## UX Direction

- Use a work-focused research layout, not a landing page.
- Prefer dense but readable panels.
- Keep the first viewport focused on watchlist, selected ticker, and decision state.
- Avoid duplicating the existing Signal dashboard hero.
- Use tabs or segmented controls for `Overview`, `Thesis`, `Valuation`, `Events`, and `Technicals` if the page becomes crowded.
- Use `Unknown`, `Unavailable`, and `Last updated` labels generously.

## Risks

### Data Quality Risk

Fundamental and valuation data may be incomplete or inconsistent across markets.

Mitigation:

- Show data freshness and source.
- Do not calculate a final buy/sell score until source quality is reliable.

### Scope Creep Risk

The page can become a full portfolio tracker, stock screener, and charting platform.

Mitigation:

- Start with watchlist research only.
- Do not add trading execution, brokerage integration, or advanced charting in MVP.

### Misleading Advice Risk

The app could appear to recommend investments.

Mitigation:

- Use decision-support language.
- Avoid labels like `Buy now`.
- Prefer `Ready`, `Wait for better price`, `Avoid`, and `Too uncertain`.

## Out Of Scope For MVP

- Brokerage connection
- Trading execution
- Portfolio P&L tracking
- Options data
- Real-time intraday charting
- TradingView data extraction
- AI-generated final buy/sell recommendation
- Backtested stock-picking performance claims

## Verification Plan

For a doc-only plan:

- Confirm the markdown file exists.
- Review the diff for scope and clarity.

For implementation later:

- Run `npm run lint`.
- Run `npm run typecheck`.
- Run `npm run harness`.
- Run `npm run build` after adding routes or framework-level changes.
- Browser-check `/` and `/research` at desktop and mobile widths.
- API smoke-check any new `/api/research/*` routes with valid and invalid inputs.

## Suggested First Build Slice

The first implementation slice should be:

1. Add or update `src/lib/types/research.ts`.
2. Add Neon-backed research state tables for watchlist metadata, thesis, checklist, notes, and last-reviewed timestamps.
3. Convert `src/components/research/ResearchDashboard.tsx` into a theme-aware workspace with desktop table, tablet compact table, and mobile cards.
4. Move Thesis Card and Investment Checklist into the first viewport or directly adjacent selected-ticker panel.
5. Keep quote, fundamentals, valuation, events, feed, and technical data mocked until the provider adapter phase.

This keeps the change focused on the core product behavior before data-provider integration.
