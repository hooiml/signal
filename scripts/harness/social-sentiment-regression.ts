import { combineAvailableSentiment } from '../../src/lib/social-sentiment';

function assertNear(actual: number, expected: number, label: string) {
    if (Math.abs(actual - expected) > 0.0001) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
}

assertNear(
    combineAvailableSentiment([
        { score: 0.4, weight: 0.5, available: true },
        { score: -0.2, weight: 0.5, available: true },
    ]),
    0.1,
    'balanced available sources'
);

assertNear(
    combineAvailableSentiment([
        { score: 0.4, weight: 0.5, available: true },
        { score: 0, weight: 0.5, available: false },
    ]),
    0.4,
    'missing StockTwits does not dilute Reddit'
);

assertNear(
    combineAvailableSentiment([
        { score: 0, weight: 0.4, available: false },
        { score: -0.3, weight: 0.6, available: true },
    ]),
    -0.3,
    'missing Reddit does not dilute StockTwits'
);

assertNear(
    combineAvailableSentiment([
        { score: 0, weight: 0.5, available: false },
        { score: 0, weight: 0.5, available: false },
    ]),
    0,
    'no available sources stays neutral'
);

console.log('Social sentiment regression tests passed.');
