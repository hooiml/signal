export const readPolicies = {
    score: { attemptMs: 15000, budgetMs: 30000 },
    archive: { attemptMs: 10000, budgetMs: 20000 },
    watchlist: { attemptMs: 10000, budgetMs: 20000 },
    provider: { attemptMs: 20000, budgetMs: 30000 },
} as const;

class ReadFailure extends Error {
    constructor(readonly status: number) { super(`Data request failed (${status}).`); }
}

/** Two attempts maximum; transport recovery never retries parsed-data validation. */
export async function readData(url: string, signal: AbortSignal, policy: { attemptMs: number; budgetMs: number } = readPolicies.score): Promise<unknown> {
    const operation = new AbortController();
    const cancel = () => operation.abort(signal.reason);
    if (signal.aborted) cancel();
    signal.addEventListener('abort', cancel, { once: true });
    const budget = setTimeout(() => operation.abort(new DOMException('Request deadline exceeded. Retry when ready.', 'TimeoutError')), policy.budgetMs);
    try {
        for (let attempt = 0; attempt < 2; attempt++) {
            operation.signal.throwIfAborted();
            const controller = new AbortController();
            const abort = () => controller.abort(operation.signal.reason);
            operation.signal.addEventListener('abort', abort, { once: true });
            const timer = setTimeout(() => controller.abort(new DOMException('Request timed out.', 'TimeoutError')), policy.attemptMs);
            try {
                const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
                if (!response.ok) throw new ReadFailure(response.status);
                return await response.json();
            } catch (error) {
                operation.signal.throwIfAborted();
                const retryable = error instanceof TypeError || (error instanceof DOMException && error.name === 'TimeoutError')
                    || (error instanceof ReadFailure && [408, 502, 503, 504].includes(error.status));
                if (attempt === 1 || !retryable) throw error;
            } finally {
                clearTimeout(timer); operation.signal.removeEventListener('abort', abort);
            }
            await new Promise<void>((resolve, reject) => {
                const onAbort = () => { clearTimeout(delay); reject(operation.signal.reason); };
                const delay = setTimeout(() => { operation.signal.removeEventListener('abort', onAbort); resolve(); }, 250);
                operation.signal.addEventListener('abort', onAbort, { once: true });
            });
        }
        throw new Error('Data unavailable.');
    } finally { clearTimeout(budget); signal.removeEventListener('abort', cancel); }
}
