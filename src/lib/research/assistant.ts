import type { ResearchSnapshot } from '../types/research-snapshot';
import type {
    AssistedResearch,
    ResearchEvidence,
    ResearchFinding,
    ResearchFindingTarget,
    ResearchFindingTone,
} from '../types/research-assistant';
import { researchFindingTargets } from '../types/research-assistant';

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const percent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const money = (value: number) => `$${compactNumber.format(value)}`;

const sourceUrl = (snapshot: ResearchSnapshot, source: string) => {
    if (source === 'SEC EDGAR') return `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(snapshot.symbol)}`;
    const yahooSymbol = snapshot.market === 'MY' && !snapshot.symbol.endsWith('.KL') ? `${snapshot.symbol}.KL` : snapshot.symbol;
    return `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}`;
};

const evidenceItem = (
    snapshot: ResearchSnapshot,
    id: string,
    label: string,
    value: string,
    source: 'SEC EDGAR' | 'Yahoo Finance',
    reportingPeriod: string | null,
): ResearchEvidence => ({ id, label, value, source, sourceUrl: sourceUrl(snapshot, source), reportingPeriod });

export const buildResearchEvidence = (snapshot: ResearchSnapshot): readonly ResearchEvidence[] => {
    const evidence: ResearchEvidence[] = [];
    const period = snapshot.fundamentals.reportingPeriod;
    const fundamentals = snapshot.fundamentals;
    const valuation = snapshot.valuation;
    const technicals = snapshot.technicals;

    if (fundamentals.revenueGrowthPercent !== null) evidence.push(evidenceItem(snapshot, 'revenue-growth', 'Annual revenue growth', percent(fundamentals.revenueGrowthPercent), 'SEC EDGAR', period));
    if (fundamentals.operatingMarginPercent !== null) evidence.push(evidenceItem(snapshot, 'operating-margin', 'Operating margin', `${fundamentals.operatingMarginPercent.toFixed(1)}%`, 'SEC EDGAR', period));
    if (fundamentals.freeCashFlow !== null) evidence.push(evidenceItem(snapshot, 'free-cash-flow', 'Annual free cash flow', money(fundamentals.freeCashFlow), 'SEC EDGAR', period));
    if (valuation.netCash !== null) evidence.push(evidenceItem(snapshot, 'net-cash', valuation.netCash >= 0 ? 'Net cash' : 'Net debt', money(Math.abs(valuation.netCash)), 'SEC EDGAR', valuation.reportingPeriod));
    if (fundamentals.shareChangePercent !== null) evidence.push(evidenceItem(snapshot, 'share-change', 'Annual share-count change', percent(fundamentals.shareChangePercent), 'SEC EDGAR', period));
    if (valuation.priceEarnings !== null) evidence.push(evidenceItem(snapshot, 'price-earnings', 'Price / earnings', `${valuation.priceEarnings.toFixed(1)}x`, 'SEC EDGAR', valuation.reportingPeriod));
    if (valuation.freeCashFlowYieldPercent !== null) evidence.push(evidenceItem(snapshot, 'fcf-yield', 'Free-cash-flow yield', `${valuation.freeCashFlowYieldPercent.toFixed(1)}%`, 'SEC EDGAR', valuation.reportingPeriod));
    if (snapshot.quote.price !== null) evidence.push(evidenceItem(snapshot, 'price', 'Current price', `${snapshot.quote.currency ? `${snapshot.quote.currency} ` : ''}${snapshot.quote.price.toFixed(2)}`, 'Yahoo Finance', null));
    if (technicals.ma50 !== null) evidence.push(evidenceItem(snapshot, 'ma50', '50-day moving average', technicals.ma50.toFixed(2), 'Yahoo Finance', null));
    if (technicals.ma200 !== null) evidence.push(evidenceItem(snapshot, 'ma200', '200-day moving average', technicals.ma200.toFixed(2), 'Yahoo Finance', null));
    if (technicals.rsi14 !== null) evidence.push(evidenceItem(snapshot, 'rsi14', '14-day RSI', technicals.rsi14.toFixed(1), 'Yahoo Finance', null));
    return evidence;
};

const finding = (
    id: string,
    title: string,
    summary: string,
    target: ResearchFindingTarget,
    tone: ResearchFindingTone,
    evidenceIds: readonly string[],
): ResearchFinding => ({ id, title, summary, target, tone, evidenceIds });

export const buildEvidenceFindings = (snapshot: ResearchSnapshot, evidence: readonly ResearchEvidence[]): readonly ResearchFinding[] => {
    const available = new Set(evidence.map((item) => item.id));
    const findings: ResearchFinding[] = [];
    const fundamentals = snapshot.fundamentals;
    const valuation = snapshot.valuation;
    const technicals = snapshot.technicals;

    if (fundamentals.revenueGrowthPercent !== null) {
        const growth = fundamentals.revenueGrowthPercent;
        findings.push(finding(
            'revenue-direction',
            growth >= 0 ? 'Revenue is expanding' : 'Revenue is contracting',
            `Reported annual revenue growth is ${percent(growth)} for ${fundamentals.reportingPeriod ?? 'the latest available period'}.`,
            growth >= 0 ? 'bullCase' : 'bearCase',
            growth >= 0 ? 'positive' : 'risk',
            ['revenue-growth'],
        ));
    }
    if (fundamentals.freeCashFlow !== null) {
        const positive = fundamentals.freeCashFlow > 0;
        findings.push(finding(
            'cash-generation',
            positive ? 'Free cash flow is positive' : 'Free cash flow is negative',
            `Annual free cash flow is ${money(fundamentals.freeCashFlow)} in the latest available filing period.`,
            positive ? 'bullCase' : 'bearCase',
            positive ? 'positive' : 'risk',
            ['free-cash-flow'],
        ));
    }
    if (valuation.netCash !== null) {
        const netCash = valuation.netCash >= 0;
        findings.push(finding(
            'balance-sheet',
            netCash ? 'Balance sheet carries net cash' : 'Balance sheet carries net debt',
            `${netCash ? 'Net cash' : 'Net debt'} is ${money(Math.abs(valuation.netCash))} using the latest available annual facts.`,
            netCash ? 'bullCase' : 'bearCase',
            netCash ? 'positive' : 'risk',
            ['net-cash'],
        ));
    }
    if (fundamentals.shareChangePercent !== null && Math.abs(fundamentals.shareChangePercent) >= 1) {
        const dilution = fundamentals.shareChangePercent > 0;
        findings.push(finding(
            'share-count',
            dilution ? 'Share count increased' : 'Share count declined',
            `Annual share count changed ${percent(fundamentals.shareChangePercent)}. Confirm the cause in the filing before treating it as dilution or repurchase activity.`,
            dilution ? 'bearCase' : 'bullCase',
            dilution ? 'risk' : 'positive',
            ['share-change'],
        ));
    }
    if (snapshot.quote.price !== null && technicals.ma50 !== null && technicals.ma200 !== null) {
        const aboveBoth = snapshot.quote.price > technicals.ma50 && snapshot.quote.price > technicals.ma200;
        findings.push(finding(
            'price-context',
            aboveBoth ? 'Price is above both trend averages' : 'Price is below at least one trend average',
            `Price is ${snapshot.quote.price.toFixed(2)} versus a 50-day average of ${technicals.ma50.toFixed(2)} and 200-day average of ${technicals.ma200.toFixed(2)}. This is market context, not evidence of business quality.`,
            'notes',
            aboveBoth ? 'positive' : 'neutral',
            ['price', 'ma50', 'ma200'].filter((id) => available.has(id)),
        ));
    }
    if (valuation.priceEarnings !== null || valuation.freeCashFlowYieldPercent !== null) {
        const parts = [
            valuation.priceEarnings === null ? null : `P/E ${valuation.priceEarnings.toFixed(1)}x`,
            valuation.freeCashFlowYieldPercent === null ? null : `FCF yield ${valuation.freeCashFlowYieldPercent.toFixed(1)}%`,
        ].filter((value): value is string => value !== null);
        findings.push(finding(
            'valuation-context',
            'Valuation evidence is available',
            `${parts.join(' and ')} based on current price and latest annual filing inputs. Compare with history and peers before assigning a valuation state.`,
            'notes',
            'neutral',
            ['price-earnings', 'fcf-yield'].filter((id) => available.has(id)),
        ));
    }
    return findings.slice(0, 8);
};

type AiFinding = {
    readonly title: string;
    readonly summary: string;
    readonly target: ResearchFindingTarget;
    readonly tone: ResearchFindingTone;
    readonly evidenceIds: readonly string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isTarget = (value: unknown): value is ResearchFindingTarget => typeof value === 'string' && researchFindingTargets.includes(value as ResearchFindingTarget);
const isTone = (value: unknown): value is ResearchFindingTone => value === 'positive' || value === 'risk' || value === 'neutral';

const parseAiFindings = (value: unknown, evidenceIds: ReadonlySet<string>): readonly AiFinding[] => {
    if (!isRecord(value) || !Array.isArray(value.findings)) throw new Error('AI returned an invalid research response.');
    return value.findings.flatMap((item): AiFinding[] => {
        if (!isRecord(item) || typeof item.title !== 'string' || typeof item.summary !== 'string'
            || !isTarget(item.target) || !isTone(item.tone) || !Array.isArray(item.evidenceIds)) return [];
        const ids = item.evidenceIds.filter((id): id is string => typeof id === 'string' && evidenceIds.has(id));
        if (ids.length === 0 || item.title.trim().length === 0 || item.summary.trim().length === 0) return [];
        return [{ title: item.title.trim().slice(0, 120), summary: item.summary.trim().slice(0, 700), target: item.target, tone: item.tone, evidenceIds: ids }];
    }).slice(0, 6);
};

const generateAiFindings = async (snapshot: ResearchSnapshot, evidence: readonly ResearchEvidence[]): Promise<readonly ResearchFinding[]> => {
    const apiKey = process.env.KIMI_API_KEY?.trim();
    if (!apiKey || evidence.length === 0) return [];
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
            model: 'moonshot-v1-8k',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'You draft an investment research journal from supplied evidence only. Never invent facts, forecasts, causation, recommendations, or missing context. Return concise JSON. Separate positive evidence, risks, and neutral observations.',
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        task: 'Return up to 6 findings. Each finding requires title, summary, target, tone, and one or more evidenceIds. Targets: whyInterested, bullCase, bearCase, thesisBreak, buyTrigger, sellTrigger, notes. Tones: positive, risk, neutral. Do not tell the user to buy or sell.',
                        company: { symbol: snapshot.symbol, market: snapshot.market, name: snapshot.quote.name },
                        evidence,
                        schema: { findings: [{ title: 'string', summary: 'string', target: 'notes', tone: 'neutral', evidenceIds: ['price'] }] },
                    }),
                },
            ],
        }),
    });
    if (!response.ok) throw new Error(`AI research request failed (${response.status}).`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.choices) || !isRecord(payload.choices[0])
        || !isRecord(payload.choices[0].message) || typeof payload.choices[0].message.content !== 'string') {
        throw new Error('AI returned an invalid response envelope.');
    }
    const parsed: unknown = JSON.parse(payload.choices[0].message.content);
    return parseAiFindings(parsed, new Set(evidence.map((item) => item.id))).map((item, index) => ({ ...item, id: `ai-${index + 1}` }));
};

export const generateAssistedResearch = async (snapshot: ResearchSnapshot): Promise<AssistedResearch> => {
    const evidence = buildResearchEvidence(snapshot);
    const warnings = [...snapshot.warnings];
    try {
        const aiFindings = await generateAiFindings(snapshot, evidence);
        if (aiFindings.length > 0) return { symbol: snapshot.symbol, market: snapshot.market, generatedAt: new Date().toISOString(), mode: 'ai', findings: aiFindings, evidence, warnings };
    } catch (error) {
        warnings.push(error instanceof Error ? `${error.message} Evidence-based findings are shown instead.` : 'AI assistance is unavailable. Evidence-based findings are shown instead.');
    }
    return {
        symbol: snapshot.symbol,
        market: snapshot.market,
        generatedAt: new Date().toISOString(),
        mode: 'evidence',
        findings: buildEvidenceFindings(snapshot, evidence),
        evidence,
        warnings,
    };
};
