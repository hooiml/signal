export const metricLessons = [
    { id: 'rsi', label: 'RSI', definition: 'Relative Strength Index compares recent gains and losses on a 0–100 scale. An elevated reading can persist in a trend; it is not an automatic sell signal.' },
    { id: 'put-call', label: 'Put/call', definition: 'Put option volume divided by call option volume. Activity can reflect hedging as well as directional views; the ratio alone does not predict price direction.' },
    { id: 'naaim', label: 'NAAIM', definition: 'The NAAIM Exposure Index reports surveyed active managers’ equity exposure. It describes positioning, not a forecast or an intraday signal.' },
    { id: 'pe', label: 'P/E', definition: 'Price relative to positive earnings per share for a stated period. It is not meaningful with non-positive earnings and never proves cheap or expensive alone.' },
    { id: 'fcf-yield', label: 'FCF yield', definition: 'Annual cash left after capital spending, expressed as a percentage of market capitalization. This is not a dividend yield or promised return.' },
] as const;

export type LearnMetric = typeof metricLessons[number]['id'];

/** The only Market indicator IDs covered by the G2 lessons and G3 glossary. */
export function metricForIndicator(key: string): LearnMetric | undefined {
    return key === 'put_call' ? 'put-call' : key === 'naaim' ? 'naaim' : undefined;
}

/** Only known, single-valued concept links select a lesson. */
export function parseLearnMetric(value: string | string[] | undefined): LearnMetric | undefined {
    return metricLessons.find(lesson => lesson.id === value)?.id;
}

export function metricLessonHref(metric: LearnMetric): string {
    return `/learn?concept=${metric}`;
}
