'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    buildDividendDiscoveryPath,
    calculateIllustrativeGrossDividend,
    dividendCashFlowEventDate,
    dividendCashFlowLimits,
    dividendEventDate,
    filterDividendCashFlowEvents,
    parseNasdaqDividendDiscoveryResponse,
    providerEvidenceFromEvent,
    removeDividendCashFlowEvent,
    upsertDividendCashFlowEvent,
} from '@/lib/portfolio/dividend-cashflow';
import {
    DIVIDEND_CASH_FLOW_CHANGE_EVENT,
    DIVIDEND_CASH_FLOW_STORAGE_KEY,
    loadDividendCashFlowSnapshot,
    saveDividendCashFlowSnapshot,
} from '@/lib/portfolio/dividend-cashflow-client';
import {
    loadPortfolioHoldingsSnapshot,
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    PORTFOLIO_HOLDINGS_STORAGE_KEY,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import {
    dividendCashFlowCategories,
    type DividendCashFlowCategory,
    type DividendCashFlowDirection,
    type DividendCashFlowEvent,
    type DividendCashFlowSnapshot,
    type DividendEventStatus,
    type NasdaqDividendEvent,
} from '@/lib/types/dividend-cashflow';
import type { PortfolioCurrency, PortfolioImportedHolding } from '@/lib/types/portfolio-holdings';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type ProviderState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly events: readonly NasdaqDividendEvent[]; readonly fetchedAt: string; readonly sourceUrl: string }
    | { readonly status: 'unavailable'; readonly message: string }
    | { readonly status: 'error'; readonly message: string };

type FormState = {
    readonly eventId: string | null;
    readonly expectedRevision: number;
    readonly kind: 'dividend' | 'cash-flow';
    readonly accountLabel: string;
    readonly currency: PortfolioCurrency;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly dividendStatus: DividendEventStatus;
    readonly declarationDate: string;
    readonly recordDate: string;
    readonly exDate: string;
    readonly paymentDate: string;
    readonly amountPerShare: string;
    readonly category: DividendCashFlowCategory;
    readonly direction: DividendCashFlowDirection;
    readonly plannedDate: string;
    readonly amount: string;
    readonly notes: string;
    readonly providerEvent: NasdaqDividendEvent | null;
};

const categoryLabels: Readonly<Record<DividendCashFlowCategory, string>> = {
    contribution: 'Contribution',
    withdrawal: 'Withdrawal',
    fee: 'Fee',
    tax: 'Tax',
    interest: 'Interest',
    other: 'Other cash movement',
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (
    snapshot: DividendCashFlowSnapshot,
    accountLabel: string,
    currency: PortfolioCurrency,
    holding: PortfolioImportedHolding | null,
): FormState => ({
    eventId: null,
    expectedRevision: snapshot.revision,
    kind: 'cash-flow',
    accountLabel,
    currency,
    symbol: holding?.symbol ?? '',
    market: holding?.market ?? 'US',
    dividendStatus: 'confirmed',
    declarationDate: '',
    recordDate: '',
    exDate: '',
    paymentDate: '',
    amountPerShare: '',
    category: 'contribution',
    direction: 'inflow',
    plannedDate: today(),
    amount: '',
    notes: '',
    providerEvent: null,
});

const money = (currency: PortfolioCurrency, value: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 4 }).format(value);

const inRange = (date: string | null, rangeDays: number) => {
    if (date === null) return true;
    const start = today();
    const end = new Date(`${start}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + rangeDays);
    return date >= start && date <= end.toISOString().slice(0, 10);
};

const providerMessage = async (response: Response): Promise<string> => {
    try {
        const payload: unknown = await response.json();
        if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
            const error = Object.fromEntries(Object.entries(payload)).error;
            if (typeof error === 'string') return error;
        }
    } catch {
        // A bounded generic message is safer than exposing an upstream body.
    }
    return response.status === 404
        ? 'No declared Nasdaq dividend metadata is available for this symbol.'
        : 'Official Nasdaq dividend metadata is temporarily unavailable.';
};

export const DividendCashFlowCalendarV6 = ({
    records,
    theme,
    rangeDays,
    view,
    eventKind,
}: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly rangeDays: 30 | 90;
    readonly view: 'list' | 'calendar';
    readonly eventKind: 'ALL' | 'dividend' | 'cash-flow';
}) => {
    const styles = getThemeV6(theme);
    const [holdingsState, setHoldingsState] = useState<PortfolioHoldingsLoadResult | null>(null);
    const [snapshot, setSnapshot] = useState<DividendCashFlowSnapshot | null>(null);
    const [storageMessage, setStorageMessage] = useState<string | null>(null);
    const [accountLabel, setAccountLabel] = useState('');
    const [currency, setCurrency] = useState<PortfolioCurrency>('USD');
    const [form, setForm] = useState<FormState | null>(null);
    const [formMessage, setFormMessage] = useState<string | null>(null);
    const [providerStates, setProviderStates] = useState<Readonly<Record<string, ProviderState>>>({});
    const [providerRefresh, setProviderRefresh] = useState(0);
    const [queueMessage, setQueueMessage] = useState<string | null>(null);

    useEffect(() => {
        const restore = () => {
            setHoldingsState(loadPortfolioHoldingsSnapshot());
            const result = loadDividendCashFlowSnapshot();
            if (result.snapshot) {
                setSnapshot(result.snapshot);
                setStorageMessage(null);
            } else {
                setSnapshot(null);
                setStorageMessage(result.message);
            }
        };
        const storage = (event: StorageEvent) => {
            if (event.key === PORTFOLIO_HOLDINGS_STORAGE_KEY || event.key === DIVIDEND_CASH_FLOW_STORAGE_KEY) restore();
        };
        restore();
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, restore);
        window.addEventListener(DIVIDEND_CASH_FLOW_CHANGE_EVENT, restore);
        window.addEventListener('storage', storage);
        return () => {
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, restore);
            window.removeEventListener(DIVIDEND_CASH_FLOW_CHANGE_EVENT, restore);
            window.removeEventListener('storage', storage);
        };
    }, []);

    const holdingsSnapshot = holdingsState?.status === 'ready' ? holdingsState.snapshot : null;
    const accountCurrencies = useMemo(() => {
        const fromHoldings = holdingsSnapshot ? [
            ...holdingsSnapshot.holdings.map((holding) => ({ accountLabel: holding.accountLabel, currency: holding.currency })),
            ...holdingsSnapshot.cashBalances.map((cash) => ({ accountLabel: cash.accountLabel, currency: cash.currency })),
        ] : [];
        return [...new Map(fromHoldings.map((item) => [`${item.accountLabel}\u0000${item.currency}`, item])).values()]
            .sort((left, right) => left.accountLabel.localeCompare(right.accountLabel) || left.currency.localeCompare(right.currency));
    }, [holdingsSnapshot]);

    useEffect(() => {
        if (accountCurrencies.length === 0) return;
        const exact = accountCurrencies.find((item) => item.accountLabel === accountLabel && item.currency === currency);
        if (exact) return;
        setAccountLabel(accountCurrencies[0]?.accountLabel ?? '');
        setCurrency(accountCurrencies[0]?.currency ?? 'USD');
    }, [accountCurrencies, accountLabel, currency]);

    const accountOptions = useMemo(() => [...new Set(accountCurrencies.map((item) => item.accountLabel))], [accountCurrencies]);
    const currencyOptions = useMemo(() => accountCurrencies
        .filter((item) => item.accountLabel === accountLabel)
        .map((item) => item.currency), [accountCurrencies, accountLabel]);
    const scopedHoldings = useMemo(() => holdingsSnapshot?.holdings.filter((holding) =>
        holding.accountLabel === accountLabel && holding.currency === currency) ?? [], [accountLabel, currency, holdingsSnapshot]);
    const recordKeys = useMemo(() => new Set(records.map((record) => `${record.market}:${record.symbol}`)), [records]);
    const matchedHoldings = useMemo(() => scopedHoldings.filter((holding) =>
        recordKeys.has(`${holding.market}:${holding.symbol}`)), [recordKeys, scopedHoldings]);
    const providerHoldings = useMemo(() => [...new Map(matchedHoldings
        .filter((holding) => holding.market === 'US')
        .map((holding) => [holding.symbol, holding])).values()]
        .slice(0, dividendCashFlowLimits.maxProviderSymbols), [matchedHoldings]);
    const providerSymbolsKey = providerHoldings.map((holding) => holding.symbol).join(',');

    useEffect(() => {
        const providerSymbols = providerSymbolsKey ? providerSymbolsKey.split(',') : [];
        if (providerSymbols.length === 0) {
            setProviderStates({});
            return;
        }
        const controller = new AbortController();
        setProviderStates(Object.fromEntries(providerSymbols.map((symbol) => [symbol, { status: 'loading' as const }])));
        void Promise.all(providerSymbols.map(async (symbol) => {
            try {
                const response = await fetch(buildDividendDiscoveryPath(symbol), { signal: controller.signal });
                if (!response.ok) {
                    const message = await providerMessage(response);
                    if (!controller.signal.aborted) setProviderStates((current) => ({
                        ...current,
                        [symbol]: { status: response.status === 404 ? 'unavailable' : 'error', message },
                    }));
                    return;
                }
                const discovery = parseNasdaqDividendDiscoveryResponse(await response.json());
                if (!controller.signal.aborted) setProviderStates((current) => ({
                    ...current,
                    [symbol]: {
                        status: 'ready',
                        events: discovery.events,
                        fetchedAt: discovery.fetchedAt,
                        sourceUrl: discovery.sourceUrl,
                    },
                }));
            } catch (error) {
                if (!controller.signal.aborted) setProviderStates((current) => ({
                    ...current,
                    [symbol]: {
                        status: 'error',
                        message: error instanceof Error ? error.message : 'Official Nasdaq dividend metadata is temporarily unavailable.',
                    },
                }));
            }
        }));
        return () => controller.abort();
    }, [providerRefresh, providerSymbolsKey]);

    const visibleEvents = useMemo(() => snapshot
        ? filterDividendCashFlowEvents(snapshot.events, accountLabel, currency)
            .filter((event) => eventKind === 'ALL' || event.kind === eventKind)
            .filter((event) => inRange(dividendCashFlowEventDate(event), rangeDays))
        : [], [accountLabel, currency, eventKind, rangeDays, snapshot]);
    const savedProviderIds = useMemo(() => new Set((snapshot?.events ?? []).flatMap((event) =>
        event.kind === 'dividend'
            && event.accountLabel === accountLabel
            && event.currency === currency
            && event.providerEvidence
            ? [event.providerEvidence.providerEventId] : [])), [accountLabel, currency, snapshot?.events]);

    const openManualForm = (kind: FormState['kind']) => {
        if (!snapshot) return;
        const base = emptyForm(snapshot, accountLabel, currency, scopedHoldings[0] ?? null);
        setForm({ ...base, kind });
        setFormMessage(null);
    };

    const openProviderForm = (event: NasdaqDividendEvent, holding: PortfolioImportedHolding) => {
        if (!snapshot) return;
        setForm({
            ...emptyForm(snapshot, holding.accountLabel, holding.currency, holding),
            kind: 'dividend',
            symbol: event.symbol,
            market: event.market,
            dividendStatus: 'confirmed',
            declarationDate: event.declarationDate ?? '',
            recordDate: event.recordDate ?? '',
            exDate: event.exDate ?? '',
            paymentDate: event.paymentDate ?? '',
            amountPerShare: event.amountPerShare?.toString() ?? '',
            providerEvent: event,
        });
        setFormMessage(null);
    };

    const openEditForm = (event: DividendCashFlowEvent) => {
        if (!snapshot) return;
        const holding = event.kind === 'dividend'
            ? scopedHoldings.find((item) => item.market === event.market && item.symbol === event.symbol) ?? null
            : scopedHoldings[0] ?? null;
        const base = emptyForm(snapshot, event.accountLabel, event.currency, holding);
        setForm(event.kind === 'dividend' ? {
            ...base,
            eventId: event.id,
            expectedRevision: snapshot.revision,
            kind: 'dividend',
            symbol: event.symbol,
            market: event.market,
            dividendStatus: event.status,
            declarationDate: event.declarationDate ?? '',
            recordDate: event.recordDate ?? '',
            exDate: event.exDate ?? '',
            paymentDate: event.paymentDate ?? '',
            amountPerShare: event.amountPerShare?.toString() ?? '',
            notes: event.notes,
            providerEvent: event.providerEvidence ? {
                ...event.providerEvidence,
                symbol: event.symbol,
                market: 'US',
            } : null,
        } : {
            ...base,
            eventId: event.id,
            expectedRevision: snapshot.revision,
            kind: 'cash-flow',
            category: event.category,
            direction: event.direction,
            plannedDate: event.plannedDate,
            amount: event.amount.toString(),
            notes: event.notes,
        });
        setFormMessage(null);
    };

    const saveForm = () => {
        if (!form || !snapshot) return;
        try {
            const latest = loadDividendCashFlowSnapshot();
            if (!latest.snapshot || latest.snapshot.revision !== form.expectedRevision) {
                throw new Error('Dividend and cash-flow data changed in another tab. Reload before saving.');
            }
            const now = new Date().toISOString();
            const common = {
                id: form.eventId ?? crypto.randomUUID(),
                revision: 1,
                accountLabel: form.accountLabel,
                currency: form.currency,
                notes: form.notes,
                createdAt: now,
                updatedAt: now,
            };
            const event: DividendCashFlowEvent = form.kind === 'dividend' ? {
                ...common,
                kind: 'dividend',
                symbol: form.symbol,
                market: form.market,
                status: form.dividendStatus,
                declarationDate: form.declarationDate || null,
                recordDate: form.recordDate || null,
                exDate: form.exDate || null,
                paymentDate: form.paymentDate || null,
                amountPerShare: form.amountPerShare ? Number(form.amountPerShare) : null,
                source: form.providerEvent ? 'provider-confirmed' : 'user-entered',
                providerEvidence: form.providerEvent ? providerEvidenceFromEvent(form.providerEvent) : null,
            } : {
                ...common,
                kind: 'cash-flow',
                category: form.category,
                status: 'planned',
                plannedDate: form.plannedDate,
                direction: form.direction,
                amount: Number(form.amount),
                source: 'user-entered',
            };
            const saved = saveDividendCashFlowSnapshot(upsertDividendCashFlowEvent(
                latest.snapshot,
                event,
                form.expectedRevision,
                now,
            ));
            setSnapshot(saved);
            setForm(null);
            setFormMessage(`Planning event saved at local revision ${saved.revision}. Actual holdings and cash were not changed.`);
        } catch (error) {
            setFormMessage(error instanceof Error ? error.message : 'Planning event could not be saved.');
        }
    };

    const removeEvent = (event: DividendCashFlowEvent) => {
        if (!snapshot) return;
        try {
            const latest = loadDividendCashFlowSnapshot();
            if (!latest.snapshot || latest.snapshot.revision !== snapshot.revision) {
                throw new Error('Dividend and cash-flow data changed in another tab. Reload before removing this event.');
            }
            const saved = saveDividendCashFlowSnapshot(removeDividendCashFlowEvent(
                latest.snapshot,
                event.id,
                snapshot.revision,
            ));
            setSnapshot(saved);
            setFormMessage(`Planning event removed at local revision ${saved.revision}. Its prior value remains in local revision history.`);
        } catch (error) {
            setFormMessage(error instanceof Error ? error.message : 'Planning event could not be removed.');
        }
    };

    const queueDividend = (event: Extract<DividendCashFlowEvent, { readonly kind: 'dividend' }>) => {
        const record = records.find((item) => item.market === event.market && item.symbol === event.symbol);
        if (!record) {
            setQueueMessage(`${event.symbol} is not an exact research-record match, so no Queue task was created.`);
            return;
        }
        const dueAt = dividendEventDate(event).date;
        const result = enqueueResearchWorkflowTaskClient({
            symbol: event.symbol,
            templateId: 'post-event',
            source: 'dividend-cashflow',
            dedupeKey: `dividend:${event.providerEvidence?.providerEventId ?? event.id}`,
            dueAt,
        });
        setQueueMessage(result.created
            ? `${event.symbol} dividend review added to Queue.`
            : `${event.symbol} already has this dividend review in Queue.`);
    };

    const inputClass = 'mt-1 min-h-10 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary;
    const unsupportedHoldings = scopedHoldings.filter((holding) =>
        holding.market !== 'US' || !recordKeys.has(`${holding.market}:${holding.symbol}`));

    if (holdingsState === null || snapshot === null && storageMessage === null) {
        return <section data-testid="dividend-cashflow-calendar" className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary}>
            <p role="status" className={'text-sm ' + styles.textMuted}>Loading browser-local holdings and planning events…</p>
        </section>;
    }

    return <section data-testid="dividend-cashflow-calendar" aria-labelledby="dividend-cashflow-title" className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Browser-local planning</p>
                <h2 id="dividend-cashflow-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Dividend and cash-flow calendar</h2>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>
                    Declared or confirmed dividends and explicit cash plans share this Calendar workspace. Exact accounts and currencies remain separate; there is no FX conversion, execution, balance mutation, entitlement ledger, tax adjustment, or forecast.
                </p>
            </div>
            <span className={'rounded border px-2 py-1 text-xs ' + styles.row}>Local revision {snapshot?.revision ?? 'unavailable'}</span>
        </div>

        {holdingsState?.status === 'empty' ? <div className={'mt-4 rounded border p-4 ' + styles.panelUtility}>
            <h3 className={'text-sm font-bold ' + styles.textPrimary}>Import an actual holdings or cash snapshot first</h3>
            <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Planning records require an exact browser-local account and currency. Open Portfolio to import the canonical CSV.</p>
        </div> : null}
        {holdingsState?.status === 'invalid' || holdingsState?.status === 'unavailable' ? <p role="alert" className={'mt-4 rounded border p-3 text-xs ' + styles.risk}>{holdingsState.message}</p> : null}
        {storageMessage ? <p role="alert" className={'mt-4 rounded border p-3 text-xs ' + styles.risk}>{storageMessage} Actual holdings and cash remain unchanged.</p> : null}

        {snapshot && accountCurrencies.length > 0 ? <>
            <div className={'mt-4 grid gap-3 rounded border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] ' + styles.panelSolid}>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Exact account
                    <select aria-label="Dividend cash-flow account" value={accountLabel} onChange={(event) => {
                        const nextAccount = event.target.value;
                        setAccountLabel(nextAccount);
                        setCurrency(accountCurrencies.find((item) => item.accountLabel === nextAccount)?.currency ?? 'USD');
                    }} className={inputClass}>
                        {accountOptions.map((account) => <option key={account} value={account}>{account}</option>)}
                    </select>
                </label>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Exact currency
                    <select aria-label="Dividend cash-flow currency" value={currency} onChange={(event) => setCurrency(event.target.value as PortfolioCurrency)} className={inputClass}>
                        {currencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                </label>
                <button type="button" onClick={() => openManualForm('dividend')} className={'min-h-10 self-end rounded border px-3 text-xs font-semibold ' + styles.row}>Add dividend</button>
                <button type="button" onClick={() => openManualForm('cash-flow')} className="min-h-10 self-end rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">Add cash flow</button>
            </div>

            {form ? <section className={'mt-4 rounded border p-4 ' + styles.panelUtility} aria-labelledby="dividend-cashflow-form-title">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id="dividend-cashflow-form-title" className={'text-sm font-bold ' + styles.textPrimary}>{form.eventId ? 'Edit' : 'Add'} {form.kind === 'dividend' ? 'dividend' : 'cash-flow'} event</h3>
                    <button type="button" onClick={() => setForm(null)} className={'min-h-10 px-3 text-xs font-semibold ' + styles.textMuted}>Cancel</button>
                </div>
                {form.providerEvent ? <p className={'mt-2 rounded border p-3 text-xs leading-5 ' + styles.panelAction + ' ' + styles.textSecondary}>
                    Nasdaq discovery fetched {new Date(form.providerEvent.fetchedAt).toLocaleString()}. You may confirm or edit the working fields; the original provider values and source remain frozen as evidence.
                </p> : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {form.kind === 'dividend' ? <>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Holding
                            <select aria-label="Dividend holding" value={`${form.market}:${form.symbol}`} onChange={(event) => {
                                const holding = scopedHoldings.find((item) => `${item.market}:${item.symbol}` === event.target.value);
                                if (holding) setForm({ ...form, symbol: holding.symbol, market: holding.market, providerEvent: null });
                            }} disabled={form.providerEvent !== null} className={inputClass}>
                                {scopedHoldings.map((holding) => <option key={`${holding.market}:${holding.symbol}`} value={`${holding.market}:${holding.symbol}`}>{holding.symbol} · {holding.market}</option>)}
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Event status
                            <select value={form.dividendStatus} onChange={(event) => setForm({ ...form, dividendStatus: event.target.value as DividendEventStatus })} className={inputClass}>
                                <option value="declared">Declared</option><option value="confirmed">Confirmed by user</option>
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Amount per share <span className="font-normal">(optional)</span>
                            <input type="number" min="0.000001" max={dividendCashFlowLimits.maxAmountPerShare} step="any" value={form.amountPerShare} onChange={(event) => setForm({ ...form, amountPerShare: event.target.value })} className={inputClass} />
                        </label>
                        {([
                            ['Declaration date', 'declarationDate'],
                            ['Record date', 'recordDate'],
                            ['Ex-date', 'exDate'],
                            ['Payment date', 'paymentDate'],
                        ] as const).map(([label, key]) => <label key={key} className={'text-xs font-semibold ' + styles.textMuted}>{label} <span className="font-normal">(when supplied)</span>
                            <input type="date" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className={inputClass} />
                        </label>)}
                    </> : <>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Movement
                            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as DividendCashFlowCategory })} className={inputClass}>
                                {dividendCashFlowCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Direction
                            <select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as DividendCashFlowDirection })} className={inputClass}>
                                <option value="inflow">Inflow</option><option value="outflow">Outflow</option>
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Planned date
                            <input type="date" required value={form.plannedDate} onChange={(event) => setForm({ ...form, plannedDate: event.target.value })} className={inputClass} />
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Amount
                            <input type="number" required min="0.01" max={dividendCashFlowLimits.maxAmount} step="any" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className={inputClass} />
                        </label>
                    </>}
                    <label className={'text-xs font-semibold sm:col-span-2 lg:col-span-3 ' + styles.textMuted}>Notes <span className="font-normal">(local only, {dividendCashFlowLimits.maxNotesLength} characters)</span>
                        <textarea maxLength={dividendCashFlowLimits.maxNotesLength} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={inputClass} />
                    </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={saveForm} className="min-h-10 rounded bg-emerald-500 px-4 text-xs font-bold text-slate-950">Save local event</button>
                    <p className={'text-xs ' + styles.textMuted}>Expected local revision {form.expectedRevision}; stale edits fail instead of overwriting.</p>
                </div>
            </section> : null}
            {formMessage ? <p role="status" className={'mt-3 rounded border p-3 text-xs ' + (formMessage.includes('changed in another tab') || formMessage.includes('could not') ? styles.risk : styles.positive)}>{formMessage}</p> : null}
            {queueMessage ? <p role="status" className={'mt-3 rounded border p-3 text-xs ' + styles.textSecondary}>{queueMessage}</p> : null}

            <section className={'mt-4 rounded border p-4 ' + styles.panelUtility} aria-labelledby="provider-discoveries-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h3 id="provider-discoveries-title" className={'text-sm font-bold ' + styles.textPrimary}>Official provider discoveries</h3>
                        <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Only exact matched US tickers are sent to the existing Nasdaq provider boundary. No account, quantity, currency filter, balance, note, or calculated income leaves the browser.</p>
                    </div>
                    <button type="button" onClick={() => setProviderRefresh((value) => value + 1)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Refresh metadata</button>
                </div>
                {providerHoldings.length === 0 ? <p className={'mt-3 text-sm ' + styles.textMuted}>No exact matched US holding is available for provider discovery in this account and currency.</p> : (
                    <div className="mt-3 space-y-3">
                        {providerHoldings.map((holding) => {
                            const provider = providerStates[holding.symbol] ?? { status: 'loading' as const };
                            if (provider.status === 'loading') return <div key={holding.symbol} role="status" className={'rounded border p-3 text-xs ' + styles.row}>{holding.symbol}: loading declared Nasdaq dividend metadata…</div>;
                            if (provider.status === 'unavailable' || provider.status === 'error') return <div key={holding.symbol} className={'rounded border p-3 ' + styles.row}>
                                <p className={'text-xs font-bold ' + styles.textPrimary}>{holding.symbol} · {provider.status === 'unavailable' ? 'Unavailable' : 'Provider error'}</p>
                                <p className={'mt-1 text-xs ' + styles.risk}>{provider.message}</p>
                                <button type="button" onClick={() => openManualForm('dividend')} className={'mt-2 min-h-9 rounded border px-3 text-xs font-semibold ' + styles.row}>Enter manually</button>
                            </div>;
                            const candidates = provider.events.filter((event) => event.currency === currency && inRange(event.paymentDate ?? event.exDate ?? event.declarationDate, rangeDays));
                            return <div key={holding.symbol} className={'rounded border p-3 ' + styles.row}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className={'text-xs font-bold ' + styles.textPrimary}>{holding.symbol} · {candidates.length} declared event{candidates.length === 1 ? '' : 's'} in view</p>
                                    <a href={provider.sourceUrl} target="_blank" rel="noreferrer" className={'text-xs underline underline-offset-4 ' + styles.positive}>Nasdaq source</a>
                                </div>
                                <p className={'mt-1 text-[11px] ' + styles.textMuted}>Fetched {new Date(provider.fetchedAt).toLocaleString()} · declared status only · missing fields remain unavailable</p>
                                {candidates.length === 0 ? <p className={'mt-2 text-xs ' + styles.textMuted}>No supplied declared event date falls within this {rangeDays}-day view.</p> : <ul className={'mt-2 divide-y ' + styles.divider}>{candidates.map((event) => {
                                    const saved = savedProviderIds.has(event.providerEventId);
                                    return <li key={event.providerEventId} className="flex flex-wrap items-center justify-between gap-3 py-2">
                                        <div>
                                            <p className={'text-xs font-semibold ' + styles.textPrimary}>{event.amountPerShare === null ? 'Amount unavailable' : `${money(event.currency, event.amountPerShare)} per share`} · declared {event.declarationDate ?? 'date unavailable'}</p>
                                            <p className={'mt-1 text-[11px] ' + styles.textMuted}>Ex-date {event.exDate ?? 'not supplied'} · payment {event.paymentDate ?? 'not supplied'} · record {event.recordDate ?? 'not supplied'}</p>
                                        </div>
                                        <button type="button" disabled={saved} onClick={() => openProviderForm(event, holding)} className={'min-h-9 rounded border px-3 text-xs font-semibold disabled:opacity-50 ' + styles.row}>{saved ? 'Already confirmed' : 'Confirm / edit'}</button>
                                    </li>;
                                })}</ul>}
                            </div>;
                        })}
                    </div>
                )}
                {unsupportedHoldings.length > 0 ? <div className={'mt-3 rounded border p-3 ' + styles.panelSolid}>
                    <p className={'text-xs font-bold ' + styles.textPrimary}>Manual-only holdings</p>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{unsupportedHoldings.map((holding) => `${holding.symbol} (${holding.market}${recordKeys.has(`${holding.market}:${holding.symbol}`) ? ', provider unsupported' : ', unmatched'})`).join(' · ')}. Signal does not scrape or guess provider symbols or dates.</p>
                </div> : null}
                {matchedHoldings.filter((holding) => holding.market === 'US').length > dividendCashFlowLimits.maxProviderSymbols ? <p role="status" className={'mt-3 text-xs ' + styles.risk}>Provider discovery is bounded to the first {dividendCashFlowLimits.maxProviderSymbols} exact matched US symbols in this account and currency.</p> : null}
            </section>

            <section className="mt-5" aria-labelledby="planned-events-title">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div><h3 id="planned-events-title" className={'text-sm font-bold ' + styles.textPrimary}>Scoped calendar events</h3><p className={'mt-1 text-xs ' + styles.textMuted}>{accountLabel} · {currency} · {rangeDays}-day view · {visibleEvents.length} event{visibleEvents.length === 1 ? '' : 's'}</p></div>
                    <span className={'text-xs ' + styles.textMuted}>{view === 'list' ? 'Chronological list' : 'Date-grouped calendar'}</span>
                </div>
                {visibleEvents.length === 0 ? <div className={'mt-3 rounded border p-6 text-center ' + styles.panelUtility}><h4 className={'text-sm font-bold ' + styles.textPrimary}>No dividend or cash-flow events in this exact scope</h4><p className={'mt-1 text-xs ' + styles.textMuted}>Add a manual planning record or confirm a declared provider discovery. Other accounts and currencies remain hidden, not aggregated.</p></div> : (
                    <div className={view === 'calendar' ? 'mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'mt-3 space-y-3'}>
                        {visibleEvents.map((event) => {
                            const date = dividendCashFlowEventDate(event);
                            const illustration = event.kind === 'dividend' && holdingsSnapshot
                                ? calculateIllustrativeGrossDividend(event, holdingsSnapshot) : null;
                            return <article key={event.id} data-dividend-cashflow-event className={'rounded border p-4 ' + styles.row}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + styles.panelSolid}>{event.kind === 'dividend' ? 'Dividend' : categoryLabels[event.category]}</span>
                                            <span className={'text-xs font-semibold ' + styles.textPrimary}>{event.kind === 'dividend' ? `${event.symbol} · ${event.status}` : `${event.direction} · planned`}</span>
                                            <span className={'text-[11px] ' + styles.textMuted}>{date ?? 'Date unavailable'}</span>
                                        </div>
                                        {event.kind === 'dividend' ? <>
                                            <p className={'mt-2 text-xs leading-5 ' + styles.textSecondary}>Ex-date {event.exDate ?? 'not supplied'} · payment {event.paymentDate ?? 'not supplied'} · amount/share {event.amountPerShare === null ? 'unavailable' : money(event.currency, event.amountPerShare)}</p>
                                            <p className={'mt-1 text-[11px] ' + styles.textMuted}>{event.source === 'provider-confirmed' ? 'Nasdaq discovery · user confirmed/edited' : 'User-entered'} · revision {event.revision}</p>
                                            {event.providerEvidence ? <p className={'mt-1 text-[11px] ' + styles.textMuted}>Original evidence fetched {new Date(event.providerEvidence.fetchedAt).toLocaleString()} · declared {event.providerEvidence.declarationDate ?? 'date unavailable'} · <a href={event.providerEvidence.sourceUrl} target="_blank" rel="noreferrer" className={'underline underline-offset-4 ' + styles.positive}>Nasdaq source</a></p> : null}
                                            {illustration ? <div className={'mt-2 rounded border p-2 text-xs leading-5 ' + styles.panelAction}>
                                                <p className={'font-semibold ' + styles.textPrimary}>Illustrative gross: {money(event.currency, illustration.grossAmount)}</p>
                                                <p className={styles.textSecondary}>{illustration.arithmetic} using the actual snapshot dated {illustration.snapshotDate}.</p>
                                                <p className={styles.textMuted}>Not tax-adjusted, not an entitlement ledger, not a forecast, and not based on inferred historical quantity.</p>
                                            </div> : <p className={'mt-2 text-xs ' + styles.textMuted}>Illustrative gross amount unavailable: current exact quantity or declared amount per share is unavailable.</p>}
                                        </> : <>
                                            <p className={'mt-2 text-xs leading-5 ' + styles.textSecondary}>{money(event.currency, event.amount)} {event.direction} on {event.plannedDate}</p>
                                            <p className={'mt-1 text-[11px] ' + styles.textMuted}>User-entered planning record · revision {event.revision} · does not alter imported cash</p>
                                        </>}
                                        {event.notes ? <p className={'mt-2 whitespace-pre-wrap text-xs leading-5 ' + styles.textMuted}>{event.notes}</p> : null}
                                    </div>
                                    <div className="flex shrink-0 flex-wrap gap-2">
                                        {event.kind === 'dividend' ? <button type="button" onClick={() => queueDividend(event)} className={'min-h-9 rounded border px-3 text-xs font-semibold ' + styles.row}>Queue review</button> : null}
                                        <button type="button" onClick={() => openEditForm(event)} className={'min-h-9 rounded border px-3 text-xs font-semibold ' + styles.row}>Edit</button>
                                        <button type="button" onClick={() => removeEvent(event)} className={'min-h-9 px-2 text-xs font-semibold ' + styles.risk}>Remove</button>
                                    </div>
                                </div>
                            </article>;
                        })}
                    </div>
                )}
            </section>
        </> : null}

        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>Privacy boundary: holdings, quantities, account names, cash balances, notes, calculated income, and local revisions are excluded from product analytics, logs, URLs, research persistence, backups, sync, and external requests.</p>
    </section>;
};
