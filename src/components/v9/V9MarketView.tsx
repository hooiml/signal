'use client';

import type { MarketSignal } from '@/lib/types/signal-v2';
import { EmbeddedMarketView } from '@/components/v8/MarketV8Connected';
import { marketSourceToggleStatus } from '@/components/v8/MarketV8ConnectedData';
import type { MarketExposureWorkspace } from '@/components/v8/MarketV8Exposure';
import type { Market, Mode } from '@/components/v8/market-v8-fixtures';
import base from '@/components/v8/market-v8.module.css';
import styles from './v9-workspace.module.css';

export function V9MarketView({
    market,
    mode,
    social,
    signal,
    loading,
    error,
    receivedAt,
    isDark,
    exposureWorkspace,
    onMarketChange,
    onModeChange,
    onSocialChange,
    onReload,
}: {
    readonly market: Market;
    readonly mode: Mode;
    readonly social: boolean;
    readonly signal: MarketSignal | null;
    readonly loading: boolean;
    readonly error: string;
    readonly receivedAt?: string;
    readonly isDark?: boolean;
    readonly exposureWorkspace?: MarketExposureWorkspace;
    readonly onMarketChange: (next: Market) => void;
    readonly onModeChange: (next: Mode) => void;
    readonly onSocialChange: (next: boolean) => void;
    readonly onReload: () => void;
}) {
    return <EmbeddedMarketView
        config={{ market, mode, enableSocial: social }}
        signal={signal}
        loading={loading}
        error={error}
        receivedAt={receivedAt}
        isDark={isDark}
        exposureWorkspace={exposureWorkspace}
        onReload={onReload}
        renderToolbar={(advanced, toggleAdvanced) => (
            <div className={styles.marketToolbar}>
                <div className={styles.marketControlGroup}>
                    <div className={styles.segWrap} role="group" aria-label="Select market">
                        <button type="button" className={styles.segBtn} aria-pressed={market === 'US'} onClick={() => onMarketChange('US')}>US Market</button>
                        <button type="button" className={styles.segBtn} aria-pressed={market === 'MY'} onClick={() => onMarketChange('MY')}>Malaysia · Bursa</button>
                    </div>
                    <div className={styles.segWrap} role="group" aria-label="Interpretation lens">
                        <button type="button" className={styles.segBtn} aria-pressed={mode === 'standard'} onClick={() => onModeChange('standard')}>Momentum</button>
                        <button type="button" className={styles.segBtn} aria-pressed={mode === 'contrarian'} onClick={() => onModeChange('contrarian')}>Contrarian</button>
                    </div>
                    <label className={base.sourceToggle}>
                        <input type="checkbox" checked={social} onChange={event => onSocialChange(event.target.checked)} />
                        <span>{market === 'MY' ? 'Include news in score' : 'Include social in score'}</span>
                    </label>
                    <details>
                        <summary>About these settings</summary>
                        <p>{mode === 'standard' ? 'Momentum reads higher scores as stronger trend confirmation.' : 'Contrarian reads higher scores as crowding risk and lower scores as potential opportunity.'}</p>
                        <p>{marketSourceToggleStatus(market, social, signal, loading, error)}</p>
                    </details>
                </div>
                <div className={styles.marketControlGroup}>
                    <button type="button" className={styles.ghostBtn} aria-pressed={advanced} onClick={toggleAdvanced}>Advanced Market</button>
                    <button type="button" className={styles.ghostBtn} onClick={onReload} disabled={loading}>
                        {loading ? 'Refreshing…' : 'Reload data'}
                    </button>
                </div>
            </div>
        )}
    />;
}
