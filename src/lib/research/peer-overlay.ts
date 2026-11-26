export type CloseSeriesPoint = {
    readonly time: string;
    readonly close: number;
};

export type RebasedPoint = {
    readonly index: number;
    readonly date: string;
    readonly pct: number;
    readonly close: number;
};

export type PeerOverlayInput = {
    readonly symbol: string;
    readonly points: readonly CloseSeriesPoint[];
};

export type PeerOverlaySeries = {
    readonly symbol: string;
    readonly points: readonly RebasedPoint[];
    readonly latestPct: number | null;
    readonly available: boolean;
};

export type RebasedOverlayResult = {
    readonly subject: readonly RebasedPoint[];
    readonly peers: readonly PeerOverlaySeries[];
    readonly minPct: number;
    readonly maxPct: number;
};

const dayKey = (raw: string): string => raw.slice(0, 10);
const isValidClose = (value: number): boolean => typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Rebases the subject stock and up to two overlaid peers to 0.0% at the first
 * valid observation within the visible range. Currencies are never combined or converted.
 */
export function buildRebasedPeerOverlay(
    subjectPoints: readonly CloseSeriesPoint[],
    peers: readonly PeerOverlayInput[],
): RebasedOverlayResult | null {
    const validSubject = subjectPoints.filter(pt => isValidClose(pt.close));
    if (validSubject.length < 2) return null;

    const subjectStart = validSubject[0].close;
    const subject: RebasedPoint[] = validSubject.map((pt, index) => ({
        index,
        date: dayKey(pt.time),
        close: pt.close,
        pct: ((pt.close - subjectStart) / subjectStart) * 100,
    }));

    const peerSeries: PeerOverlaySeries[] = peers.slice(0, 2).map(peer => {
        const byDay = new Map<string, number>();
        for (const pt of peer.points) {
            if (isValidClose(pt.close)) byDay.set(dayKey(pt.time), pt.close);
        }

        const matched: { readonly index: number; readonly date: string; readonly close: number }[] = [];
        for (let i = 0; i < subject.length; i += 1) {
            const close = byDay.get(subject[i].date);
            if (close !== undefined) matched.push({ index: i, date: subject[i].date, close });
        }

        if (matched.length < 2) {
            return { symbol: peer.symbol, points: [], latestPct: null, available: false };
        }

        const baseClose = matched[0].close;
        const points: RebasedPoint[] = matched.map(row => ({
            index: row.index,
            date: row.date,
            close: row.close,
            pct: ((row.close - baseClose) / baseClose) * 100,
        }));
        return {
            symbol: peer.symbol,
            points,
            latestPct: points[points.length - 1]?.pct ?? null,
            available: true,
        };
    });

    const allPcts = [
        0,
        ...subject.map(pt => pt.pct),
        ...peerSeries.flatMap(series => series.points.map(pt => pt.pct)),
    ];
    const rawMin = Math.min(...allPcts);
    const rawMax = Math.max(...allPcts);
    const span = rawMax - rawMin || 2;

    return {
        subject,
        peers: peerSeries,
        minPct: rawMin - span * 0.08,
        maxPct: rawMax + span * 0.08,
    };
}
