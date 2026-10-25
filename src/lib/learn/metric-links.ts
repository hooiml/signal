export const metricLessons = [
    { id: 'rsi', label: 'RSI' },
    { id: 'put-call', label: 'Put/call' },
    { id: 'naaim', label: 'NAAIM' },
    { id: 'pe', label: 'P/E' },
    { id: 'fcf-yield', label: 'FCF yield' },
] as const;

export type LearnMetric = typeof metricLessons[number]['id'];

/** Only known, single-valued concept links select a lesson. */
export function parseLearnMetric(value: string | string[] | undefined): LearnMetric | undefined {
    return metricLessons.find(lesson => lesson.id === value)?.id;
}

export function metricLessonHref(metric: LearnMetric): string {
    return `/learn?concept=${metric}`;
}
