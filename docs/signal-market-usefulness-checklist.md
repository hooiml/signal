# Signal Market Usefulness Checklist

## Purpose

Use this checklist to judge whether the main Signal page contains information that is genuinely useful for stock-market decision support, not just visually polished.

This checklist is for evaluating the dashboard as a decision surface for market participants. It focuses on signal clarity, time relevance, risk context, interpretation quality, and actionability.

## Review Standard

A useful page should let a market-aware user answer these questions quickly:

1. What is the current read?
2. Over what time horizon is this read useful?
3. Why does the system believe this?
4. How trustworthy is it?
5. What would weaken or invalidate it?
6. How unusual are the underlying inputs?
7. Is the read tactical, regime-based, or noisy?

If the page cannot answer those questions clearly, it is still missing key market information.

## Priority Tiers

### Tier 1: Must Have

These are the highest-priority information needs. Without them, the page is not strong enough as a decision-support tool.

1. **Current signal**
   - Visible signal tier
   - Composite score
   - Mode context

2. **Signal horizon**
   - The page must say what time window the signal is intended for.
   - Examples:
     - intraday
     - 1-5 trading days
     - 1-4 weeks
     - swing / intermediate

3. **Trust definition**
   - Confidence must be defined clearly as agreement, not forecast probability.
   - Coverage and freshness must be visible.

4. **Primary driver**
   - The page must identify the main reason the current score exists.
   - This should be specific, not generic.

5. **Regime context**
   - The page must state the current market regime in plain terms.
   - Examples:
     - risk-on
     - risk-off
     - mixed breadth
     - high-volatility override
     - crowded optimism

6. **What changed**
   - Previous score
   - Current score
   - Delta
   - Snapshot timing

7. **Conflict or invalidation signal**
   - The page must show what currently challenges the thesis or what would weaken it.

### Tier 2: Strongly Recommended

These materially improve stock-market usefulness and should follow immediately after Tier 1.

8. **Input extremity / percentile context**
   - Major inputs should show whether they are normal, elevated, or extreme versus history.
   - Raw values alone are not enough.

9. **Recent score path**
   - A short multi-point history is more useful than delta alone.
   - Even a compact 5-point trend is valuable.

10. **Source freshness by importance**
   - The user should understand which stale input matters most.
   - Example:
     - AAII stale but expected
     - VIX live
     - breadth live

11. **Broad-market confirmation**
   - The page should clearly show whether breadth / index context supports the read.

12. **Mode consequence**
   - The UI should explain what the chosen mode implies right now.
   - Example:
     - Momentum: follow strength
     - Contrarian: chase risk elevated

13. **Decision framing**
   - Distinguish between:
     - strong bullish pressure
     - good long entry
     - crowded / overextended condition

### Tier 3: Enhancement-Level

These are valuable but not immediately blocking.

14. **Historical calibration**
   - Past behavior of similar signal states
   - Hit-rate or confidence calibration if available

15. **Scenario framing**
   - What happens if one key driver reverses?
   - What happens if volatility changes sharply?

16. **Tactical guidance framing**
   - Not advice, but orientation such as:
     - continuation setup
     - cautionary strength
     - early stabilization

17. **Cross-market relevance**
   - If the page covers `US` and `MY`, it should clearly surface which drivers matter differently by region.

## Checklist Questions

Use these questions during review.

### Signal Clarity

- Is the current signal obvious within the first viewport?
- Is the mode interpretation understandable?
- Is the score meaningful without reading the entire page?

### Time Relevance

- Does the page clearly state the expected decision horizon?
- Does the freshness view match that horizon?
- Would a user know whether the signal is tactical or slower-moving?

### Evidence Quality

- Are the main drivers visible and understandable?
- Are conflicting inputs clearly named?
- Does the page explain whether supporting evidence is broad or narrow?

### Market Context

- Is the current market regime visible?
- Is breadth or index confirmation easy to find?
- Are input values contextualized relative to history or normal range?

### Decision Usefulness

- Does the page distinguish opportunity from crowding risk?
- Does it show what would weaken the current read?
- Does it separate weighted evidence from context/news properly?

### Trustworthiness

- Is confidence defined correctly?
- Are stale inputs surfaced with the right level of urgency?
- Is source coverage shown honestly?

## Scoring Guide

Rate each item:

- `0` = missing
- `1` = present but weak
- `2` = clearly useful

Interpretation:

- `0-12`: visually improved but still weak for market decisions
- `13-22`: moderately useful, but still missing key market context
- `23-30`: strong decision-support surface
- `31+`: highly useful and information-dense for market interpretation

## Current Recommendation

For the current Signal page, the next most valuable additions should be prioritized in this order:

1. signal horizon
2. regime label
3. percentile / extremity context for key inputs
4. explicit conflict or invalidation summary
5. short recent score history

## Review Outcome Template

Use this format when reviewing the page:

### Strengths
- ...

### Missing Tier 1 Items
- ...

### Missing Tier 2 Items
- ...

### Most Valuable Next Additions
1. ...
2. ...
3. ...

### Final Judgment
- Is the page genuinely useful for market decision support?
- What is the biggest remaining gap?
