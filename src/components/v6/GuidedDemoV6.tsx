'use client';

import Link from 'next/link';
import { useState } from 'react';
import { watchlist } from '@/components/research/ResearchDashboardV2';
import { AppNavV6 } from './AppNavV6';
import { getThemeV6 } from './research-v6';
import { useThemeV6 } from './ThemeProviderV6';

type DemoArea = 'market' | 'research' | 'portfolio';

const demoAreas: readonly { readonly id: DemoArea; readonly label: string; readonly prompt: string }[] = [
    { id: 'market', label: 'Market', prompt: 'See how source coverage and limitations frame a market read.' },
    { id: 'research', label: 'Research', prompt: 'Inspect one example thesis without saving or changing it.' },
    { id: 'portfolio', label: 'Portfolio', prompt: 'See evidence-limited planning with currencies kept separate.' },
];

const demoRecord = watchlist[0];
const benchmarkRecord = watchlist.find((item) => item.symbol === 'VOO') ?? watchlist[1];

export const GuidedDemoV6 = () => {
    const { theme, toggleTheme } = useThemeV6();
    const styles = getThemeV6(theme);
    const [area, setArea] = useState<DemoArea>('market');
    const [visited, setVisited] = useState<readonly DemoArea[]>(['market']);

    const chooseArea = (next: DemoArea) => {
        setArea(next);
        setVisited((current) => current.includes(next) ? current : [...current, next]);
    };

    const restart = () => {
        setArea('market');
        setVisited(['market']);
        window.setTimeout(() => document.getElementById('guided-demo-title')?.focus(), 0);
    };

    return (
        <div className={'min-h-screen ' + styles.page}>
            <AppNavV6 active="research" theme={theme} onThemeToggle={toggleTheme} commands={[
                {
                    id: 'demo-restart',
                    label: 'Restart guided demo',
                    group: 'Demo',
                    keywords: ['example reset'],
                    run: restart,
                },
                {
                    id: 'demo-exit',
                    label: 'Exit demo to Research',
                    group: 'Demo',
                    keywords: ['setup real data'],
                    run: () => window.location.assign('/research?setup=1'),
                },
            ]} />
            <main className="mx-auto w-full max-w-[1280px] px-4 py-5 min-[700px]:px-6 min-[700px]:py-8">
                <section data-testid="guided-demo" aria-labelledby="guided-demo-title" className={'rounded-[10px] border p-4 min-[700px]:p-6 ' + styles.panelPrimary}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className={'text-xs font-bold uppercase tracking-[0.14em] ' + styles.risk}>Demo · example data · not live</p>
                            <h1 id="guided-demo-title" tabIndex={-1} className={'mt-1 text-2xl font-bold outline-none ' + styles.textPrimary}>Explore Signal without changing your data</h1>
                            <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>Everything on this page is a fixed, read-only example. It makes no provider request, writes no Research, Portfolio, Queue, analytics, backup, or sync data, and disappears when you leave.</p>
                        </div>
                        <span className={'rounded-full border px-3 py-1 text-xs font-bold ' + styles.row}>{visited.length}/3 areas visited</span>
                    </div>

                    <div className="mt-5 grid gap-2 min-[700px]:grid-cols-3" role="tablist" aria-label="Demo areas">
                        {demoAreas.map((item) => (
                            <button
                                key={item.id}
                                id={`demo-tab-${item.id}`}
                                type="button"
                                role="tab"
                                aria-selected={area === item.id}
                                aria-controls={`demo-panel-${item.id}`}
                                onClick={() => chooseArea(item.id)}
                                onKeyDown={(event) => {
                                    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                                    event.preventDefault();
                                    const index = demoAreas.findIndex((candidate) => candidate.id === area);
                                    const offset = event.key === 'ArrowRight' ? 1 : -1;
                                    const next = demoAreas[(index + offset + demoAreas.length) % demoAreas.length];
                                    chooseArea(next.id);
                                    window.setTimeout(() => document.getElementById(`demo-tab-${next.id}`)?.focus(), 0);
                                }}
                                className={'min-h-12 rounded-lg border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + (area === item.id ? styles.selectedRow : styles.row)}
                            >
                                <span className={'block text-sm font-bold ' + styles.textPrimary}>{item.label}</span>
                                <span className={'mt-1 block text-xs leading-5 ' + styles.textMuted}>{item.prompt}</span>
                            </button>
                        ))}
                    </div>

                    {area === 'market' ? (
                        <section id="demo-panel-market" role="tabpanel" aria-labelledby="demo-tab-market" className="mt-5">
                            <DemoLabel />
                            <div className="mt-3 grid gap-3 min-[900px]:grid-cols-[0.8fr_1.2fr]">
                                <article className={'rounded-lg border p-5 ' + styles.panelAction}>
                                    <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.textMuted}>Example US market posture</p>
                                    <p className={'mt-3 font-mono text-5xl font-bold tabular-nums ' + styles.textPrimary}>62</p>
                                    <p className={'mt-2 text-lg font-bold ' + styles.textPrimary}>Mixed · momentum mode</p>
                                    <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>Volatility is calm, but positioning evidence is incomplete. The score describes indicator agreement, not a forecast.</p>
                                </article>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {[
                                        ['Volatility', '48 / 100', 'Example daily input · available'],
                                        ['Breadth', 'Supportive', 'Example context · non-scored'],
                                        ['Manager exposure', 'Unavailable', 'No value is guessed for the demo'],
                                        ['Source health', 'Partial', 'One missing input remains visible'],
                                    ].map(([title, value, detail]) => (
                                        <article key={title} className={'rounded-lg border p-4 ' + styles.panelSolid}>
                                            <p className={'text-xs font-semibold ' + styles.textMuted}>{title}</p>
                                            <p className={'mt-2 text-lg font-bold ' + styles.textPrimary}>{value}</p>
                                            <p className={'mt-1 text-xs leading-5 ' + styles.textSecondary}>{detail}</p>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ) : area === 'research' ? (
                        <section id="demo-panel-research" role="tabpanel" aria-labelledby="demo-tab-research" className="mt-5">
                            <DemoLabel />
                            <div className="mt-3 grid gap-3 min-[900px]:grid-cols-[0.7fr_1.3fr]">
                                <aside className={'rounded-lg border p-4 ' + styles.panelSolid}>
                                    <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.textMuted}>Example watchlist</p>
                                    {[demoRecord, benchmarkRecord].map((item) => (
                                        <div key={item.symbol} className={'mt-3 rounded border p-3 ' + styles.row}>
                                            <div className="flex justify-between gap-3"><strong className="font-mono">{item.symbol}</strong><span className={'text-xs ' + styles.textMuted}>Example</span></div>
                                            <p className={'mt-1 text-xs ' + styles.textSecondary}>{item.name}</p>
                                        </div>
                                    ))}
                                </aside>
                                <article className={'rounded-lg border p-5 ' + styles.panelSecondary}>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div><h2 className={'text-xl font-bold ' + styles.textPrimary}>{demoRecord.symbol} · {demoRecord.name}</h2><p className={'text-xs ' + styles.textMuted}>Example saved-review shape · read only</p></div>
                                        <span className={'rounded-full border px-3 py-1 text-xs font-bold ' + styles.row}>Watch</span>
                                    </div>
                                    <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                                        {[
                                            ['Why interested', demoRecord.whyInterested],
                                            ['Bull case', demoRecord.bullCase],
                                            ['Bear case', demoRecord.bearCase],
                                            ['Next action', 'Verify current evidence before any real review.'],
                                        ].map(([label, value]) => (
                                            <div key={label}><dt className={'text-xs font-semibold ' + styles.textMuted}>{label}</dt><dd className={'mt-1 text-sm leading-6 ' + styles.textSecondary}>{value}</dd></div>
                                        ))}
                                    </dl>
                                    <p className={'mt-5 border-t pt-4 text-xs leading-5 ' + styles.textMuted + ' ' + styles.divider}>No button on this demo can save, acknowledge, schedule, create a rule, or copy this example into real Research.</p>
                                </article>
                            </div>
                        </section>
                    ) : (
                        <section id="demo-panel-portfolio" role="tabpanel" aria-labelledby="demo-tab-portfolio" className="mt-5">
                            <DemoLabel />
                            <div className="mt-3 grid gap-3 sm:grid-cols-2 min-[1000px]:grid-cols-3">
                                {[
                                    ['Example USD account', '$12,400 known value', 'USD remains separate; no FX conversion.'],
                                    ['Example MYR account', 'RM 8,000 known value', 'MYR remains separate; no combined total.'],
                                    ['Coverage', '2 of 3 positions', 'One missing price stays unavailable.'],
                                ].map(([title, value, detail]) => (
                                    <article key={title} className={'rounded-lg border p-5 ' + styles.panelSolid}>
                                        <h2 className={'text-sm font-bold ' + styles.textPrimary}>{title}</h2>
                                        <p className={'mt-3 text-xl font-bold ' + styles.textPrimary}>{value}</p>
                                        <p className={'mt-2 text-xs leading-5 ' + styles.textSecondary}>{detail}</p>
                                    </article>
                                ))}
                            </div>
                            <div className={'mt-3 rounded-lg border p-4 ' + styles.panelUtility}>
                                <p className={'text-sm font-bold ' + styles.textPrimary}>Planning boundary</p>
                                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>These illustrative positions are not holdings, transactions, broker balances, advice, or performance. Nothing is imported or stored.</p>
                            </div>
                        </section>
                    )}

                    <div className={'mt-6 flex flex-col gap-3 border-t pt-4 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between ' + styles.divider}>
                        <p className={'text-xs leading-5 ' + styles.textMuted}>{visited.length === 3 ? 'You visited all three example areas. Continue to setup when you are ready to create your own state.' : 'Use the tabs to visit each example area. Progress exists only in this mounted page.'}</p>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={restart} className={'min-h-10 rounded border px-4 text-xs font-bold ' + styles.row}>Restart demo</button>
                            <Link href="/research?setup=1" prefetch={false} className={'inline-flex min-h-10 items-center rounded border px-4 text-xs font-bold ' + styles.selectedRow}>Exit to setup</Link>
                            <Link href="/research" prefetch={false} className={'inline-flex min-h-10 items-center rounded border px-4 text-xs font-bold ' + styles.row}>Exit to Research</Link>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

const DemoLabel = () => (
    <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-500">Demo · fixed example · not current market data</p>
);
