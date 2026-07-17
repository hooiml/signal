import type { ResearchChartPoint } from '../types/research-snapshot';

export type VwapAnchor = 'range-start' | 'swing-low' | 'swing-high';

export type VolumeProfileBin = {
    readonly high: number;
    readonly low: number;
    readonly midpoint: number;
    readonly volume: number;
    readonly share: number;
    readonly isPointOfControl: boolean;
};

const round = (value: number, decimals = 4) => Number(value.toFixed(decimals));

export const anchoredVwap = (
    points: readonly ResearchChartPoint[],
    anchor: VwapAnchor,
): readonly { readonly time: string; readonly value: number }[] => {
    if (points.length === 0) return [];
    const anchorIndex = anchor === 'range-start'
        ? 0
        : points.reduce((selected, point, index) => {
            const selectedPoint = points[selected];
            if (!selectedPoint) return index;
            return anchor === 'swing-low'
                ? point.low < selectedPoint.low ? index : selected
                : point.high > selectedPoint.high ? index : selected;
        }, 0);
    let priceVolume = 0;
    let volume = 0;
    return points.slice(anchorIndex).flatMap((point) => {
        if (point.volume === null || point.volume <= 0) return [];
        const typicalPrice = (point.high + point.low + point.close) / 3;
        priceVolume += typicalPrice * point.volume;
        volume += point.volume;
        return [{ time: point.time, value: round(priceVolume / volume) }];
    });
};

export const volumeProfile = (
    points: readonly ResearchChartPoint[],
    binCount = 16,
): readonly VolumeProfileBin[] => {
    if (points.length === 0 || binCount < 2) return [];
    const low = Math.min(...points.map((point) => point.low));
    const high = Math.max(...points.map((point) => point.high));
    if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return [];
    const width = (high - low) / binCount;
    const volumes = Array<number>(binCount).fill(0);
    for (const point of points) {
        if (point.volume === null || point.volume <= 0) continue;
        const typicalPrice = (point.high + point.low + point.close) / 3;
        const index = Math.min(binCount - 1, Math.max(0, Math.floor((typicalPrice - low) / width)));
        volumes[index] += point.volume;
    }
    const total = volumes.reduce((sum, value) => sum + value, 0);
    const maximum = Math.max(...volumes);
    if (total <= 0 || maximum <= 0) return [];
    const pointOfControlIndex = volumes.reduce((selected, value, index) => value > volumes[selected] ? index : selected, 0);
    return volumes.map((value, index) => ({
        low: round(low + width * index),
        high: round(low + width * (index + 1)),
        midpoint: round(low + width * (index + 0.5)),
        volume: Math.round(value),
        share: value / maximum,
        isPointOfControl: index === pointOfControlIndex,
    })).reverse();
};

export const relativeStrengthSeries = (
    points: readonly ResearchChartPoint[],
    benchmark: readonly ResearchChartPoint[],
): readonly { readonly time: string; readonly value: number }[] => {
    const benchmarkByTime = new Map(benchmark.map((point) => [point.time, point.close]));
    const shared = points.flatMap((point) => {
        const benchmarkClose = benchmarkByTime.get(point.time);
        if (benchmarkClose === undefined || benchmarkClose <= 0 || point.close <= 0) return [];
        return [{ time: point.time, ratio: point.close / benchmarkClose }];
    });
    const baseline = shared[0]?.ratio;
    if (baseline === undefined || baseline <= 0) return [];
    return shared.map((point) => ({ time: point.time, value: round((point.ratio / baseline) * 100, 2) }));
};
