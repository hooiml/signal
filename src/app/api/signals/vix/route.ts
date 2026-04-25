import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchVIX } from '@/lib/yahoo-finance';

export const runtime = 'nodejs';

/**
 * VIX Thresholds based on Kimi K2's analysis (post-2008 regime-adjusted)
 * Sources: CBOE VIX White Paper (2023), CNN Fear & Greed Index
 */
const VIX_THRESHOLDS = {
  EXTREME_GREED: 13,  // VIX < 13: Exceptionally low volatility, extreme complacency
  GREED: 17,          // VIX 13-17: Low volatility, overconfident investors
  NEUTRAL: 23,        // VIX 17-23: Normal conditions, near historical median
  FEAR: 30,           // VIX 23-30: Elevated volatility, market anxiety
  EXTREME_FEAR: 40,   // VIX 30-40: Crisis-level volatility, panic conditions
  // VIX 40+: PANIC - Rare, extreme events (COVID, 2008)
} as const;

type AuraLevel = 'EXTREME_GREED' | 'GREED' | 'NEUTRAL' | 'FEAR' | 'EXTREME_FEAR';

const calculateAuraLevel = (vix: number): AuraLevel => {
  if (vix < VIX_THRESHOLDS.EXTREME_GREED) return 'EXTREME_GREED';
  if (vix < VIX_THRESHOLDS.GREED) return 'GREED';
  if (vix < VIX_THRESHOLDS.NEUTRAL) return 'NEUTRAL';
  if (vix < VIX_THRESHOLDS.FEAR) return 'FEAR';
  return 'EXTREME_FEAR';
};

/**
 * Aura Score: 0-100 scale (inverted VIX)
 * Formula: 100 - (vix * 2.5)
 * - VIX 0 → Score 100 (maximum greed)
 * - VIX 40 → Score 0 (maximum fear)
 */
const calculateAuraScore = (vix: number): number => {
  return Math.max(0, Math.min(100, Math.round(100 - (vix * 2.5))));
};

const generateSummary = (vix: number, auraLevel: AuraLevel): string => {
  const summaries: Record<AuraLevel, string> = {
    EXTREME_GREED: `VIX at ${vix.toFixed(2)} indicates extreme complacency. Markets are unusually calm—historically, this often precedes corrections. Exercise caution.`,
    GREED: `VIX at ${vix.toFixed(2)} shows low volatility. Investors are confident and buying aggressively. The market mood is optimistic.`,
    NEUTRAL: `VIX at ${vix.toFixed(2)} reflects normal market conditions. Volatility is near the historical median. Balanced sentiment.`,
    FEAR: `VIX at ${vix.toFixed(2)} signals elevated anxiety. Investors are nervous, and hedging activity is increasing.`,
    EXTREME_FEAR: `VIX at ${vix.toFixed(2)} indicates crisis-level volatility. Panic is setting in—historically a contrarian buying opportunity.`,
  };
  return summaries[auraLevel];
};

export const GET = async (): Promise<NextResponse> => {
  try {
    const vixData = await fetchVIX();
    const auraLevel = calculateAuraLevel(vixData.price);
    const auraScore = calculateAuraScore(vixData.price);
    const summary = generateSummary(vixData.price, auraLevel);

    const keyDrivers = [{
      factor: 'VIX',
      impact: vixData.price < VIX_THRESHOLDS.NEUTRAL ? 'positive' : 'negative',
      description: vixData.change !== null
        ? `VIX ${vixData.change > 0 ? 'up' : 'down'} ${Math.abs(vixData.changePercent ?? 0).toFixed(2)}%`
        : `VIX at ${vixData.price.toFixed(2)}`
    }];

    await sql`
            INSERT INTO market_signals (
                market_type,
                aura_level,
                aura_score,
                summary,
                key_drivers,
                vix_value,
                data_sources,
                model_version,
                signal_date
            ) VALUES (
                'US',
                ${auraLevel},
                ${auraScore},
                ${summary},
                ${JSON.stringify(keyDrivers)},
                ${vixData.price},
                ${JSON.stringify(['yahoo-finance'])},
                'v0.2-kimi-k2-thresholds',
                CURRENT_DATE
            )
            ON CONFLICT (market_type, signal_date)
            DO UPDATE SET
                aura_level = EXCLUDED.aura_level,
                aura_score = EXCLUDED.aura_score,
                summary = EXCLUDED.summary,
                key_drivers = EXCLUDED.key_drivers,
                vix_value = EXCLUDED.vix_value,
                updated_at = NOW()
        `;

    return NextResponse.json({
      success: true,
      data: {
        ...vixData,
        auraLevel,
        auraScore,
        summary,
        thresholds: VIX_THRESHOLDS
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};
