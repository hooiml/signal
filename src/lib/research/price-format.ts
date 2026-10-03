/** Preserve provider units (including GBp) and never infer currency from a market. */
export const researchPriceCurrency = (value: unknown): string | null =>
    typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim() : null;

export const formatResearchPrice = (value: number | null, currency: unknown): string => {
    if (value === null || !Number.isFinite(value)) return 'Unavailable';
    const amount = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
    return `${amount} ${researchPriceCurrency(currency) ?? '(currency not recorded)'}`;
};
