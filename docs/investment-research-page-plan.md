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

- `Ready to research deeper`
- `Wait for better price`
- `Too uncertain`
- `Avoid`

Purpose:

- Turn scattered data into a decision-support workflow.

## Data And Integration Needs

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

### Phase 1: Static Research Page Shell

Add:

- `/research` route
- Navigation link
- Static watchlist sample data
- Page layout and empty states
- No backend changes yet

Acceptance criteria:

- User can open `/research`.
- Page clearly feels separate from the market signal cockpit.
- Watchlist and selected-symbol panels render on desktop and mobile.

### Phase 2: Live Quote And Basic Fundamentals

Add:

- Research types
- Symbol API route
- Quote data
- Basic company profile fields
- Fundamental metric cards

Acceptance criteria:

- Selecting a ticker loads live or clearly timestamped quote data.
- Missing data renders as `Unknown`.
- External request parameters are validated at route boundaries.

### Phase 3: Thesis, Notes, And Checklist

Add:

- Thesis fields
- Checklist state
- Local persistence first, or Neon persistence if server-side storage is preferred
- Last reviewed timestamp

Acceptance criteria:

- User can record why a ticker is interesting.
- Checklist produces a clear readiness label.
- Notes are not mixed into fetched data objects.

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
- Prefer `Worth deeper research`, `Wait`, `Avoid`, and `Too uncertain`.

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

1. Add `src/app/research/page.tsx`.
2. Add `src/components/research/ResearchDashboard.tsx`.
3. Add a static watchlist table and selected-symbol detail shell.
4. Add navigation from the existing header.
5. Keep all research data mocked or static for this first slice.

This keeps the change reversible and avoids mixing data-source work with UI structure.
