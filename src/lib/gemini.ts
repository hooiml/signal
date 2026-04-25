/**
 * Gemini API Client (Google AI)
 * Uses Gemini 1.5 Flash for fast, free summarization
 */

import type { MarketType } from "./signal";

export interface MarketAura {
    auraLevel: 'EXTREME_GREED' | 'GREED' | 'NEUTRAL' | 'FEAR' | 'EXTREME_FEAR';
    auraScore: number;
    summary: string;
    keyDrivers: Array<{
        factor: string;
        impact: 'positive' | 'negative' | 'neutral';
        description: string;
    }>;
    outlook: string;
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
    candidates: Array<{
        content: {
            parts: Array<{
                text: string;
            }>;
        };
    }>;
    usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
    };
}

/**
 * Call Gemini API for market aura generation
 */
export const generateMarketAura = async (
    market: MarketType,
    vixValue: number,
    vixAuraLevel: string,
    socialSentiment: number,
    redditPosts: string[],
    newsHeadlines: string[],
    stockTwits: string[]
): Promise<MarketAura> => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    // Convert raw sentiment to display score (0-100)
    const scaledSentiment = Math.round(((socialSentiment + 1) / 2) * 100);

    const marketName = market === 'MY' ? 'Malaysia' : 'United States';
    const marketContext = market === 'MY'
        ? "Focus on Bursa Malaysia (KLSE) and local macroeconomic factors. Ignore US-specific tickers like $NVDA, $TSLA, etc., unless they directly impact global sentiment for MY."
        : "Focus on US markets (S&P 500, Nasdaq, Dow).";

    const prompt = `You are a senior market analyst generating daily "Market Aura" summaries for the ${marketName} market.
 
 ${marketContext}

 Generate a Market Aura summary based on:

## Quantitative Data
- VIX Level: ${vixValue.toFixed(2)} (${vixAuraLevel})
- Social Sentiment Score: ${scaledSentiment}/100 (Where 0 is Extreme Bearish, 100 is Extreme Bullish)

## Top Reddit Posts (Past 24h)
${redditPosts.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n')}

## News Headlines
${newsHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h}`).join('\n')}

## StockTwits Sentiment
${stockTwits.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Instructions
- Use VIX thresholds: <13=EXTREME_GREED, 13-17=GREED, 17-23=NEUTRAL, 23-30=FEAR, >30=EXTREME_FEAR
- When referencing "Social Sentiment", ALWAYS use the 0-100 score provided (e.g. "Sentiment is strong at 78/100"). DO NOT refer to 0.xx decimals.
- Be concise but insightful
- Highlight contradictions and contrarian signals

## Required Output (JSON only, no markdown code blocks):
{
  "auraLevel": "EXTREME_GREED|GREED|NEUTRAL|FEAR|EXTREME_FEAR",
  "auraScore": 0-100,
  "summary": "2-3 paragraph market narrative",
  "keyDrivers": [
    {"factor": "...", "impact": "positive|negative|neutral", "description": "..."}
  ],
  "outlook": "1 sentence forward-looking statement"
}`;

    const response = await fetch(
        `${GEMINI_BASE_URL}/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ],
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                    responseMimeType: 'application/json'
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', errorText);
        throw new Error(`Gemini API error: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();

    console.log(`Gemini usage: ${data.usageMetadata?.totalTokenCount || 'N/A'} tokens`);

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
        throw new Error('Empty response from Gemini');
    }

    try {
        // Clean up potential markdown code blocks
        const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedContent) as MarketAura;
        return parsed;
    } catch {
        console.error('Failed to parse Gemini response:', content);
        throw new Error('Invalid JSON from Gemini');
    }
};
