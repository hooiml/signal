/** Presentation only: does not alter statistical eligibility or sample counts. */
export function outcomeWindow(dates: readonly unknown[], days: number) {
    let latest: string | null = null;
    let excluded = 0;
    for (const value of dates) {
        const time = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? Date.parse(`${value}T12:00:00Z`) : NaN;
        if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
            excluded++;
            continue;
        }
        if (latest === null || value > latest) latest = value as string;
    }
    if (!latest) return { date: null, excluded };
    const target = new Date(`${latest}T12:00:00Z`);
    target.setUTCDate(target.getUTCDate() + days);
    return { date: target.toISOString().slice(0, 10), excluded };
}
