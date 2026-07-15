export type YieldCurveContext = {
    readonly spread_pct: number;
    readonly state: 'normal' | 'inverted';
    readonly report_date: string;
    readonly source_url: string;
};

export type FinancialConditionsContext = {
    readonly value: number;
    readonly stance: 'tighter' | 'looser' | 'near-average';
    readonly report_date: string;
    readonly source_url: string;
};

export type BreadthContext = {
    readonly equal_weight_return_pct: number;
    readonly cap_weight_return_pct: number;
    readonly relative_return_pct: number;
    readonly period_label: string;
    readonly report_date: string;
    readonly source_urls: readonly string[];
};

export type MalaysiaRatesContext = {
    readonly mgs_3y_pct: number;
    readonly mgs_10y_pct: number;
    readonly curve_spread_pct: number;
    readonly opr_pct: number;
    readonly myor_pct: number;
    readonly short_term_bill_3m_pct: number | null;
    readonly short_term_bill_name: string | null;
    readonly report_date: string;
    readonly opr_report_date: string;
    readonly source_url: string;
};

export type UsMarketContext = {
    readonly market: 'US';
    readonly yield_curve: YieldCurveContext | null;
    readonly financial_conditions: FinancialConditionsContext | null;
    readonly breadth: BreadthContext | null;
};

export type MalaysiaMarketContext = {
    readonly market: 'MY';
    readonly malaysia_rates: MalaysiaRatesContext | null;
};

export type MarketContextData = UsMarketContext | MalaysiaMarketContext;
