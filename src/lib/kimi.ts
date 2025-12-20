/**
 * Kimi K2 API Client (Moonshot AI)
 * OpenAI-compatible API for reasoning and summarization
 */

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

const KIMI_BASE_URL = 'https://api.moonshot.ai/v1';

interface KimiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface KimiResponse {
    id: string;
    choices: Array<{
        message: {
            content: string;
        };
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Call Kimi K2 API for market aura generation
 */
export const generateMarketAura = async (
    vixValue: number,
    vixAuraLevel: string,
    socialSentiment: number,
    redditPosts: string[],
    newsHeadlines: string[],
    stockTwits: string[]
): Promise<MarketAura> => {
    const apiKey = process.env.KIMI_API_KEY;

    if (!apiKey) {
        throw new Error('KIMI_API_KEY not configured');
    }

    const systemPrompt = `You are a senior market analyst generating daily "Market Aura" summaries. 
Your analysis should combine quantitative data (VIX, sentiment scores) with qualitative data (news, social chatter).
Always respond in valid JSON format matching the specified schema.
Be concise but insightful. Highlight contradictions and contrarian signals.`;

    const userPrompt = `Generate a Market Aura summary based on:

## Quantitative Data
- VIX Level: ${vixValue.toFixed(2)} (${vixAuraLevel})
- Social Sentiment Score: ${socialSentiment.toFixed(2)} (-1 bearish to +1 bullish)

## Top Reddit Posts (Past 24h)
${redditPosts.slice(0, 5).map((p, i) => `${i + 1}. ${p}`).join('\n')}

## News Headlines
${newsHeadlines.slice(0, 5).map((h, i) => `${i + 1}. ${h}`).join('\n')}

## StockTwits Sentiment
${stockTwits.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')}

## Required Output (JSON only, no markdown):
{
  "auraLevel": "EXTREME_GREED|GREED|NEUTRAL|FEAR|EXTREME_FEAR",
  "auraScore": 0-100,
  "summary": "2-3 paragraph market narrative",
  "keyDrivers": [
    {"factor": "...", "impact": "positive|negative|neutral", "description": "..."}
  ],
  "outlook": "1 sentence forward-looking statement"
}

Use VIX thresholds: <13=EXTREME_GREED, 13-17=GREED, 17-23=NEUTRAL, 23-30=FEAR, >30=EXTREME_FEAR
Score formula: 100 - (VIX * 2.5), adjusted by social sentiment`;

    const messages: KimiMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'moonshot-v1-8k',
            messages,
            temperature: 0.3,
            response_format: { type: 'json_object' }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Kimi API error:', errorText);
        throw new Error(`Kimi API error: ${response.status}`);
    }

    const data: KimiResponse = await response.json();

    console.log(`Kimi K2 usage: ${data.usage.total_tokens} tokens`);

    const content = data.choices[0]?.message?.content;

    if (!content) {
        throw new Error('Empty response from Kimi K2');
    }

    try {
        const parsed = JSON.parse(content) as MarketAura;
        return parsed;
    } catch (e) {
        console.error('Failed to parse Kimi response:', content);
        throw new Error('Invalid JSON from Kimi K2');
    }
};
