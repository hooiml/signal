import { neon } from '@neondatabase/serverless';

const apply = process.argv.includes('--apply');
const longRange = process.argv.includes('--long-range');
const startDate = process.argv.find((value) => value.startsWith('--start='))?.split('=')[1] ?? (longRange ? '2020-01-01' : '2026-04-25');
const endDate = process.argv.find((value) => value.startsWith('--end='))?.split('=')[1] ?? (longRange ? '2026-02-13' : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = neon(process.env.DATABASE_URL);

const dateRange = (start, end) => {
    const values = [];
    for (const date = new Date(`${start}T00:00:00Z`); date <= new Date(`${end}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) values.push(date.toISOString().slice(0, 10));
    return values;
};
const weeklyDates = (rows, start, end) => Object.values(rows.filter((row) => row.date >= start && row.date <= end).reduce((weeks, row) => {
    const monday = new Date(`${row.date}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    weeks[monday.toISOString().slice(0, 10)] = row.date;
    return weeks;
}, {})).sort();
const latest = (rows, date) => rows.filter((row) => row.date <= date).at(-1) ?? null;
const vixScore = (value) => Math.max(0, Math.min(100, Math.round((100 / (1 + Math.exp((value - 24) / 6))) * 100) / 100));
const putCallScore = (value) => Math.round(((1.25 - Math.max(0.55, Math.min(1.25, value))) / 0.70) * 100);
const naaimScore = (value) => Math.round(((Math.max(40, Math.min(90, value)) - 40) / 50) * 100);
const aaiiScore = (value) => Math.min(Math.max(((value - 20) / 30) * 100, 0), 100);
const tierFor = (score, mode) => score >= 85 ? (mode === 'contrarian' ? 'strong-sell' : 'strong-buy')
    : score >= 65 ? (mode === 'contrarian' ? 'sell' : 'buy')
        : score >= 40 ? 'neutral'
            : score >= 20 ? (mode === 'contrarian' ? 'buy' : 'sell')
                : mode === 'contrarian' ? 'strong-buy' : 'strong-sell';
const actionFor = (tier) => tier.includes('buy') ? 'BUY' : tier.includes('sell') ? 'SELL' : 'NEUTRAL';
const weightsFor = (vix) => vix > 30 ? { vix: 0.85, social: 0.15 } : { vix: 0.35, social: 0.20, put_call: 0.10, aaii: 0.20, naaim: 0.10, bofa: 0.05 };

const calculate = ({ date, mode, enableSocial, inputs }) => {
    const weights = weightsFor(inputs.vix.value);
    const definitions = [
        ['vix', 'VIX Index', inputs.vix.value, vixScore(inputs.vix.value), inputs.vix.date],
        ...(enableSocial ? [['social', 'Social Sentiment', inputs.social?.value ?? 0, inputs.social ? (Math.max(-1, Math.min(1, inputs.social.value)) + 1) * 50 : 50, inputs.social?.date ?? date]] : []),
        ...(inputs.putCall ? [['put_call', 'Put/call ratio', inputs.putCall.value, putCallScore(inputs.putCall.value), inputs.putCall.date]] : []),
        ...(inputs.aaii ? [['aaii', 'AAII Sentiment', inputs.aaii.value, aaiiScore(inputs.aaii.value), inputs.aaii.date]] : []),
        ...(inputs.naaim ? [['naaim', 'Manager exposure (NAAIM)', inputs.naaim.value, naaimScore(inputs.naaim.value), inputs.naaim.date]] : []),
    ];
    const components = Object.fromEntries(definitions.filter(([key]) => (weights[key] ?? 0) > 0).map(([key, name, raw, score, sourceDate]) => [key, {
        raw_value: raw, score, weight: weights[key], signal: tierFor(score, mode), last_updated: sourceDate, display_name: name,
    }]));
    const active = Object.values(components);
    const activeWeight = active.reduce((sum, item) => sum + item.weight, 0);
    const score = Math.round(active.reduce((sum, item) => sum + item.score * item.weight, 0) + (1 - activeWeight) * 50);
    const tier = tierFor(score, mode);
    const majority = actionFor(tier);
    const agreement = active.length ? Math.round(active.filter((item) => actionFor(item.signal) === majority).length / active.length * 100) : 0;
    const confidence = active.length < 3 || agreement < 50 ? 'low' : agreement >= 80 ? 'high' : 'moderate';
    const drivers = Object.entries(components).map(([key, item]) => ({ key, name: item.display_name, contribution: item.score * item.weight, score: item.score, weight: item.weight, raw_value: item.raw_value, last_updated: item.last_updated, impact: actionFor(item.signal) === majority ? 'positive' : 'negative', detail: 'Reconstructed historical input' })).sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution));
    const coverage = ['VIX historical close', enableSocial ? (inputs.social ? `social historical reading from ${inputs.social.date}` : 'social neutral fallback (raw 0)') : 'social disabled', inputs.putCall ? `put/call carried from ${inputs.putCall.date}` : 'put/call neutral reserve', inputs.aaii ? `AAII carried from ${inputs.aaii.date}` : 'AAII neutral reserve', inputs.naaim ? `NAAIM ${inputs.naaim.date}` : 'NAAIM neutral reserve', 'BofA neutral reserve'].join('; ');
    return { score, tier, majority, agreement, confidence, components, drivers, coverage };
};

const yahoo = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=${longRange ? '10y' : '1y'}`, { headers: { 'user-agent': 'SignalDashboard/1.0' } }).then(async (response) => {
    if (!response.ok) throw new Error(`Yahoo VIX history failed: ${response.status}`);
    return response.json();
});
const chart = yahoo.chart?.result?.[0];
const closes = chart?.indicators?.quote?.[0]?.close ?? [];
const vixRows = (chart?.timestamp ?? []).flatMap((timestamp, index) => Number.isFinite(closes[index]) ? [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), value: closes[index] }] : []);

const naaimHtml = longRange ? '' : await fetch('https://naaim.org/programs/naaim-exposure-index/', { headers: { 'user-agent': 'SignalDashboard/1.0' } }).then((response) => response.text());
const fetchedNaaimRows = [...naaimHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').matchAll(/(\d{2})\/(\d{2})\/(\d{4})\s+([0-9]+(?:\.[0-9]+)?)/g)]
    .map((match) => ({ date: `${match[3]}-${match[1]}-${match[2]}`, value: Number(match[4]) }))
    .filter((row, index, rows) => rows.findIndex((candidate) => candidate.date === row.date) === index)
    .sort((left, right) => left.date.localeCompare(right.date));

const observed = await sql`SELECT mode, enable_social, snapshot_date::text AS date, composite_score, components, COALESCE(origin, 'observed') AS origin FROM signal_snapshots WHERE market_type = 'US' ORDER BY snapshot_date`;
const institutional = await sql`SELECT indicator_name, report_date::text AS date, value::float AS value FROM institutional_data ORDER BY report_date`;
const historicalSocialRows = await sql`SELECT signal_date::text AS date, social_sentiment_score::float AS value FROM market_signals WHERE market_type = 'US' AND social_sentiment_score IS NOT NULL ORDER BY signal_date`;
const componentSeries = (key) => observed.filter((row) => row.origin === 'observed').flatMap((row) => {
    const item = row.components?.[key];
    return item && Number.isFinite(Number(item.raw_value)) ? [{ date: String(item.last_updated ?? row.date).slice(0, 10), value: Number(item.raw_value) }] : [];
}).filter((row, index, rows) => rows.findIndex((candidate) => candidate.date === row.date && candidate.value === row.value) === index).sort((left, right) => left.date.localeCompare(right.date));
const putCallRows = componentSeries('put_call');
const aaiiRows = [...institutional.filter((row) => row.indicator_name === 'aaii').map((row) => ({ date: row.date, value: Number(row.value) })), ...componentSeries('aaii')].sort((left, right) => left.date.localeCompare(right.date));
const naaimRows = [...fetchedNaaimRows, ...componentSeries('naaim')].sort((left, right) => left.date.localeCompare(right.date));
const observedKeys = new Set(observed.filter((row) => row.origin === 'observed').map((row) => `${row.mode}:${row.enable_social}:${row.date}`));
const candidates = [];
const targetDates = longRange ? weeklyDates(vixRows, startDate, endDate) : dateRange(startDate, endDate);

const observedScoreMismatches = observed.flatMap((row) => {
    const components = Object.values(row.components ?? {});
    const activeWeight = components.reduce((sum, item) => sum + Number(item.weight ?? 0), 0);
    const recalculated = Math.round(components.reduce((sum, item) => sum + Number(item.score ?? 0) * Number(item.weight ?? 0), 0) + Math.max(0, 1 - activeWeight) * 50);
    return recalculated === Number(row.composite_score) ? [] : [{ date: row.date, mode: row.mode, enableSocial: row.enable_social, stored: Number(row.composite_score), recalculated }];
});

for (const date of targetDates) {
    const inputs = longRange
        ? { vix: latest(vixRows, date), social: null, putCall: null, aaii: null, naaim: null }
        : { vix: latest(vixRows, date), social: historicalSocialRows.find((row) => row.date === date) ?? null, putCall: latest(putCallRows, date), aaii: latest(aaiiRows, date), naaim: latest(naaimRows, date) };
    if (!inputs.vix) continue;
    for (const mode of ['standard', 'contrarian']) for (const enableSocial of [true, false]) {
        if (!observedKeys.has(`${mode}:${enableSocial}:${date}`)) candidates.push({ date, mode, enableSocial, ...calculate({ date, mode, enableSocial, inputs }) });
    }
}

const byTarget = Object.values(candidates.reduce((summary, row) => {
    const key = `${row.mode}/social-${row.enableSocial ? 'on' : 'off'}`;
    summary[key] ??= { target: key, count: 0 };
    summary[key].count += 1;
    return summary;
}, {}));
console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    profile: longRange ? 'weekly-limited-timeline' : 'daily-backfill',
    range: [startDate, endDate],
    candidateCount: candidates.length,
    byTarget,
    sourceCoverage: {
        vix: [vixRows.at(0)?.date, vixRows.at(-1)?.date],
        putCall: [putCallRows.at(0)?.date, putCallRows.at(-1)?.date],
        aaii: [aaiiRows.at(0)?.date, aaiiRows.at(-1)?.date],
        naaim: [naaimRows.at(0)?.date, naaimRows.at(-1)?.date],
        historicalSocial: [historicalSocialRows.at(0)?.date, historicalSocialRows.at(-1)?.date],
    },
    socialCoverage: {
        historical: candidates.filter((row) => row.enableSocial && row.coverage.includes('social historical reading')).length,
        neutralFallback: candidates.filter((row) => row.enableSocial && row.coverage.includes('social neutral fallback')).length,
    },
    observedScoreValidation: { checked: observed.length, mismatches: observedScoreMismatches.slice(0, 10), mismatchCount: observedScoreMismatches.length },
    samples: candidates.slice(0, 4).map((row) => ({ date: row.date, mode: row.mode, enableSocial: row.enableSocial, score: row.score, tier: row.tier, majority: row.majority, agreement: row.agreement, confidence: row.confidence, coverage: row.coverage })),
}, null, 2));

if (apply) {
    await sql`ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'observed'`;
    await sql`ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS coverage_note TEXT`;
    for (const row of candidates) {
        await sql`INSERT INTO signal_snapshots (market_type, mode, enable_social, snapshot_date, composite_score, tier, confidence_level, agreement_pct, majority_signal, components, score_drivers, index_trend, signal_quality, interpretation_context, metadata_snapshot, origin, coverage_note)
            VALUES ('US', ${row.mode}, ${row.enableSocial}, ${row.date}, ${row.score}, ${row.tier}, ${row.confidence}, ${row.agreement}, ${row.majority}, ${JSON.stringify(row.components)}, ${JSON.stringify(row.drivers)}, '[]'::jsonb, ${JSON.stringify({ freshness: 'reconstructed', source_coverage: 'partial', warnings: [row.coverage] })}, ${JSON.stringify({ limitation: longRange ? 'Weekly long-range context reconstructed from historical VIX with unavailable inputs held neutral; excluded from forward validation.' : 'Reconstructed with the current model; not an observed point-in-time snapshot.' })}, ${JSON.stringify(longRange ? { reconstruction_version: 1, long_range_reconstruction_version: 1, scoring_model_version: '2.0.0', validation_eligible: false, cadence: 'weekly' } : { reconstruction_version: 1, scoring_model_version: '2.0.0', validation_eligible: true })}, 'reconstructed', ${longRange ? `Limited weekly reconstruction; ${row.coverage}` : row.coverage})
            ON CONFLICT (market_type, mode, enable_social, snapshot_date) DO UPDATE SET
                composite_score = EXCLUDED.composite_score,
                tier = EXCLUDED.tier,
                confidence_level = EXCLUDED.confidence_level,
                agreement_pct = EXCLUDED.agreement_pct,
                majority_signal = EXCLUDED.majority_signal,
                components = EXCLUDED.components,
                score_drivers = EXCLUDED.score_drivers,
                signal_quality = EXCLUDED.signal_quality,
                interpretation_context = EXCLUDED.interpretation_context,
                metadata_snapshot = EXCLUDED.metadata_snapshot,
                coverage_note = EXCLUDED.coverage_note,
                updated_at = NOW()
            WHERE signal_snapshots.origin = 'reconstructed'`;
    }
    console.log(`Inserted or refreshed ${candidates.length} backfilled snapshots.`);
}
