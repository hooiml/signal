export type HomeSessionId = 'my-session' | 'us-session' | 'us-wrap' | 'weekend';

export type HomeSessionContext = {
    readonly session: HomeSessionId;
    readonly primaryMarket: 'US' | 'MY';
    readonly secondaryMarket: 'US' | 'MY';
    readonly sessionLabel: string;
    readonly secondaryLabel: string;
    readonly isWeekend: boolean;
};

const mytParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
});

/**
 * Derive which market is actively in focus based on Malaysia Time (MYT, UTC+8):
 * - Sat/Sun: Weekend review mode (balanced recap + upcoming week reviews)
 * - Mon-Fri 08:00-17:30 MYT: Malaysia / Bursa primary, US overnight close secondary
 * - Mon-Fri 17:30-05:00 MYT: US primary, Bursa close secondary
 * - Mon-Fri 05:00-08:00 MYT: US closing wrap primary (sets up Bursa open), prior Bursa secondary
 */
export function getHomeSessionContext(now: Date = new Date()): HomeSessionContext {
    const parts = mytParts.formatToParts(now);
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
    const rawHour = Number(parts.find(p => p.type === 'hour')?.value ?? '12');
    const hour = rawHour === 24 ? 0 : rawHour;
    const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
    const minutesOfDay = hour * 60 + minute;

    if (weekday === 'Sat' || weekday === 'Sun') {
        return {
            session: 'weekend',
            primaryMarket: 'US',
            secondaryMarket: 'MY',
            sessionLabel: 'Weekend review · MYT',
            secondaryLabel: 'Malaysia week-end recap',
            isWeekend: true,
        };
    }

    if (minutesOfDay >= 8 * 60 && minutesOfDay < 17 * 60 + 30) {
        return {
            session: 'my-session',
            primaryMarket: 'MY',
            secondaryMarket: 'US',
            sessionLabel: 'Bursa session · MYT',
            secondaryLabel: 'US overnight close',
            isWeekend: false,
        };
    }

    if (minutesOfDay >= 5 * 60 && minutesOfDay < 8 * 60) {
        return {
            session: 'us-wrap',
            primaryMarket: 'US',
            secondaryMarket: 'MY',
            sessionLabel: 'US closing wrap · MYT',
            secondaryLabel: 'Prior Bursa close',
            isWeekend: false,
        };
    }

    return {
        session: 'us-session',
        primaryMarket: 'US',
        secondaryMarket: 'MY',
        sessionLabel: 'US session · MYT',
        secondaryLabel: 'Bursa close',
        isWeekend: false,
    };
}

export function formatHeadlineAge(pubDate: string | undefined, nowMs: number = Date.now()): string | null {
    if (!pubDate) return null;
    const parsed = Date.parse(pubDate);
    if (!Number.isFinite(parsed)) return null;
    const diffMinutes = Math.max(0, Math.round((nowMs - parsed) / 60_000));
    if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 48) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays}d ago`;
}
