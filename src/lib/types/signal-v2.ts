
// Phase 1: Core Type Definitions for Signal v2.0 DSS
// ==================================================

import type { MarketContextData } from './market-context';

/**
 * Normalized Indicator Data Structure
 * Standardizes inputs from VIX, Social, AAII, etc. into a common format
 */
export interface IndicatorData {
    name: string;           // 'vix', 'social', 'aaii', 'bofa'
    display_name: string;   // 'Volatility Index', 'Social Sentiment', etc.
    value: number;          // Raw value (e.g. 18.5 for VIX, 0.42 for AAII)
    score: number;          // Normalized 0-100 score
    weight: number;         // 0-1 contribution to composite score
    signal: SignalTier;
    enabled: boolean;       // Is this indicator currently active?
    last_updated: string;   // ISO timestamp
    percentile?: number;    // Optional: historical percentile (0-100)

    // Metadata for debugging/transparency
    metadata?: {
        raw_source?: unknown;   // Original source data (optional)
        confidence?: number; // 0-1 confidence in this specific data point
        source_breakdown?: Record<string, number>; // e.g. { reddit: 0.6, twitter: 0.4 }
        source_url?: string;
        cadence?: string;
        horizon?: string;
        mode_note?: string;
    };
}

/**
 * Generic Signal Actions (Categorized from tiers)
 */
export type SignalAction = 'BUY' | 'NEUTRAL' | 'SELL';

/**
 * Confidence Metrics for Signal Confluence
 */
export interface ConfidenceMetrics {
    agreement_pct: number;       // % of active indicators agreeing with majority signal
    level: 'high' | 'moderate' | 'low';
    majority_signal: SignalAction;
    conflicting_indicators: string[]; // Names of indicators disagreeing with majority
    warning?: string;            // E.g. "Single source mode: confidence reduced"
    source_count?: number;
    cap_reason?: string;
}

/**
 * Full Market Signal (v2 Output)
 */
export interface MarketSignal {
    composite_score: number;     // 0-100 master score
    tier: SignalTier;           // 5-tier classification
    mode: 'standard' | 'contrarian';

    // Interpretation logic
    interpretation: {
        action: string;          // "Strong Buy", "Caution", etc.
        reasoning: string;       // Generated text explaining the signal
        color: string;           // Hex color code for UI
        emoji: string;           // 🚀, 🐻, ⚠️, etc.
    };

    // Component breakdown
    components: {
        [key: string]: IndicatorData;
    };

    // Meta-analysis
    confidence: ConfidenceMetrics;
    metadata: {
        market: 'US' | 'MY';
        data_freshness: Record<string, string>; // { vix: '2026-02-15T...', social: '...' }
        weight_distribution: Record<string, number>; // { vix: 0.65, social: 0.35 }
        coverage_adjustment?: {
            active_weight: number;
            missing_weight: number;
            neutral_baseline: number;
            active_points: number;
            neutral_points: number;
        };
        stocks?: Array<{
            symbol: string;
            price: number;
            change: number;
            changePercent: number;
        }>;
        articles?: Array<{
            title: string;
            source: string;
            url?: string;
            pubDate?: string;
            sentiment?: 'bullish' | 'bearish' | 'neutral';
        }>;
        signal_quality?: {
            freshness: 'fresh' | 'mixed' | 'stale';
            source_coverage: 'strong' | 'moderate' | 'limited';
            noise_level: 'low' | 'moderate' | 'elevated';
            market_regime: string;
            warnings: string[];
            confidence_explanation?: string;
        };
        score_drivers?: Array<{
            key: string;
            name: string;
            impact: 'positive' | 'negative' | 'neutral';
            contribution: number;
            score: number;
            weight: number;
            raw_value: number;
            last_updated: string;
            detail: string;
            mode_note?: string;
        }>;
        index_trend?: Array<{
            symbol: string;
            price: number;
            changePercent: number;
            trend: 'positive' | 'negative' | 'flat';
        }>;
        interpretation_context?: {
            regime: string;
            agreeing_signals: string[];
            conflicting_signals: string[];
            disagreement_note?: string;
            limitation: string;
            mode_note: string;
            aaii_note?: string;
            article_feed_role: string;
            breadth_note?: string;
        };
        valuation_backdrop?: {
            name: string;
            ratio_pct: number;
            market_value_billions: number;
            gdp_billions: number;
            report_date: string;
            label: string;
            detail: string;
            source_url: string;
        };
        market_context?: MarketContextData;
        score_delta?: {
            previous_score: number | null;
            delta: number | null;
            previous_date: string | null;
            snapshot_date: string;
            label: string;
        };
        score_history?: Array<{
            date: string;
            score: number;
            tier: SignalTier;
            origin?: 'observed' | 'reconstructed';
            coverage_note?: string | null;
        }>;
        driver_changes?: Array<{
            key: string;
            name: string;
            current_contribution: number;
            previous_contribution: number;
            delta: number;
        }>;
        driver_changes_available?: boolean;
        trend_context?: {
            score_trend: string;
            last_signal_change: string;
            note: string;
        };
        historical_validation?: {
            benchmark_symbol: string;
            benchmark_name: string;
            mode: 'standard' | 'contrarian';
            model_version: string;
            generated_at: string;
            data_start_date: string | null;
            data_through_date: string | null;
            snapshot_count: number;
            timeline_only_snapshot_count: number;
            observed_snapshot_count: number;
            reconstructed_snapshot_count: number;
            minimum_sample_size: number;
            directional_sample_size: number;
            reconstruction_note: string | null;
            horizons: Array<{
                days: 7 | 30;
                observations: Array<{
                    date: string;
                    score: number;
                    tier: SignalTier;
                    forward_return_pct: number;
                    origin: 'observed' | 'reconstructed';
                }>;
                baseline: {
                    sample_count: number;
                    observed_count: number;
                    reconstructed_count: number;
                    median_forward_return_pct: number | null;
                    positive_return_rate_pct: number | null;
                };
                cohorts: Array<{
                    zone: 'negative' | 'mixed' | 'positive' | 'strong-positive';
                    label: string;
                    sample_count: number;
                    observed_count: number;
                    reconstructed_count: number;
                    average_forward_return_pct: number | null;
                    median_forward_return_pct: number | null;
                    positive_return_rate_pct: number | null;
                    worst_forward_return_pct: number | null;
                    best_forward_return_pct: number | null;
                    alignment_rate_pct: number | null;
                    evidence_level: 'insufficient' | 'preliminary' | 'established';
                }>;
            }>;
            timeline: Array<{
                date: string;
                score: number;
                tier: SignalTier;
                origin: 'observed' | 'reconstructed';
                benchmark_rebased: number;
                model_version: string | null;
                coverage_note: string | null;
            }>;
            limitation: string;
        };
        counterfactuals?: {
            source_toggle?: {
                source: 'social' | 'news';
                source_label: string;
                active: boolean;
                current_score: number;
                with_source_score: number | null;
                without_source_score: number | null;
                delta_without_source: number | null;
                summary: string;
                unavailable_reason?: string;
            };
        };
    };
}

/**
 * 5-Tier Signal Classification
 * Maps to existing bucket ranges: 0-19, 20-39, 40-64, 65-84, 85-100
 */
export type SignalTier = 'strong-buy' | 'buy' | 'neutral' | 'sell' | 'strong-sell';

/**
 * Comparison with V1 Types (Migration Helper)
 * 
 * V1: SentimentOutput { value: number; description: string; sentiment: AuraLevel; ... }
 * V2: MarketSignal { composite_score: number; tier: SignalTier; ... }
 */

/**
 * Application State & Configuration
 */
export interface AppState {
    config: {
        mode: 'standard' | 'contrarian';
        active_sources: string[]; // ['vix', 'social', 'aaii']
        market: 'US' | 'MY';
        custom_weights?: Record<string, number>; // Optional overrides
        version: string; // '2.0.0'
    };
    data: {
        current_signal: MarketSignal;
        historical_signals: MarketSignal[];
        raw_indicators: Record<string, unknown>;
    };
    ui: {
        loading: boolean;
        error: string | null;
        expanded_panels: string[];
    };
}
