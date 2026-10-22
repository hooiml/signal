/** Preserve provider units (including GBp) and never infer currency from a market. */
export const researchPriceCurrency = (value: unknown): string | null =>
    typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim()) ? value.trim() : null;

/** Normalize user-entered codes, preserving explicitly spelled provider minor units. */
export const normalizeCurrencyCode = (value: string): string | null => {
    const trimmed = value.trim();
    if (!/^[A-Za-z]{3}$/.test(trimmed)) return null;
    return ['GBp', 'ZAc', 'ILa'].includes(trimmed) ? trimmed : trimmed.toUpperCase();
};

export const formatResearchPrice = (value: number | null, currency: unknown): string => {
    if (value === null || !Number.isFinite(value)) return 'Unavailable';
    const amount = new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
    return `${amount} ${researchPriceCurrency(currency) ?? '(currency not recorded)'}`;
};
