
export interface RedditPost {
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    url: string;
    permalink: string;
    created_utc: number;
    subreddit: string;
}

type RedditOAuthConfiguration = {
    readonly clientId: string;
    readonly clientSecret: string;
    readonly userAgent: string;
};

type RedditToken = {
    readonly value: string;
    readonly expiresAt: number;
};

let cachedToken: RedditToken | null = null;
let pendingToken: Promise<RedditToken> | null = null;
let warnedUnconfigured = false;

export const getRedditOAuthConfiguration = (
    env: Readonly<Record<string, string | undefined>> = process.env
): RedditOAuthConfiguration | null => {
    const clientId = env.REDDIT_CLIENT_ID?.trim();
    const clientSecret = env.REDDIT_CLIENT_SECRET?.trim();
    const userAgent = env.REDDIT_USER_AGENT?.trim();
    return clientId && clientSecret && userAgent ? { clientId, clientSecret, userAgent } : null;
};

const getRedditAccessToken = async (configuration: RedditOAuthConfiguration): Promise<string> => {
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.value;

    pendingToken ??= (async () => {
        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${Buffer.from(`${configuration.clientId}:${configuration.clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': configuration.userAgent,
            },
            body: 'grant_type=client_credentials',
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`OAuth token request failed: ${response.status}`);

        const payload: unknown = await response.json();
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('OAuth token response was invalid');
        const token = Object.fromEntries(Object.entries(payload));
        if (typeof token.access_token !== 'string' || !token.access_token || typeof token.expires_in !== 'number') {
            throw new Error('OAuth token response was incomplete');
        }
        return {
            value: token.access_token,
            expiresAt: now + Math.max(60, token.expires_in) * 1_000,
        };
    })();

    try {
        cachedToken = await pendingToken;
        return cachedToken.value;
    } finally {
        pendingToken = null;
    }
};

/**
 * Filter out low-signal posts (megathreads, discussion threads, questions, advice)
 */
const isSignalPost = (post: RedditPost, minScore = 20): boolean => {
    const title = post.title.toLowerCase();
    const isMYSub = ['bursabets', 'malaysianpf'].includes(post.subreddit.toLowerCase().replace('r/', ''));

    // Filter out megathreads and discussion posts
    const noisePatterns = [
        'discussion thread',
        'daily discussion',
        'weekend discussion',
        'weekly discussion',
        'monthly discussion',
        'daily thread',
        'weekend thread',
        'earnings thread',
        'quarterly thread',
        'ask r/',
    ];

    // Reject if matches noise patterns
    if (noisePatterns.some(pattern => title.includes(pattern))) {
        return false;
    }

    // RELAXED FILTER FOR MALAYSIA:
    // Malaysia subreddits are low volume and often discussion/question based.
    // We allow advice/questions for MY but keep it strict for WSB/US.
    if (!isMYSub) {
        const strictNoise = [
            'rate my portfolio', 'what are your moves', 'what is your',
            'rant thread', 'advice thread', 'newbie thread',
            'how much has your', 'do i belong', 'first time', 'first options',
            'should i', 'is it worth', 'help me', 'advice needed', 'need advice',
            'what would you', 'how do i', 'how can i', 'am i doing', 'did i make',
            'beginner question', 'eternal question', 'buy now or wait', 'sell or hold',
            'what stocks are you', 'which stocks', 'where to start', 'how and from where',
            'from where to start', 'best month yet', 'worst month', 'biggest mistake',
            'biggest stupid', 'my biggest', 'i made this year', 'my gains', 'my losses',
            'finally broke', 'thank you all for', 'portfolio:', 'my portfolio',
            'time horizon', 'is a 20', 'the next', 'is amazon', 'is tesla', 'is nvidia'
        ];

        if (strictNoise.some(pattern => title.includes(pattern))) {
            return false;
        }

        // Reject if it's a question (ends with ?) - with exceptions for rhetorical market questions
        if (title.endsWith('?')) {
            const questionWords = [
                'how much', 'how do', 'how can', 'how and',
                'should i', 'do i', 'am i', 'did i',
                'what stocks', 'which stock', 'where',
                'is a ', 'is it', 'will i'
            ];

            if (questionWords.some(q => title.includes(q))) {
                return false;
            }
        }
    }

    // Reject posts with very low scores (likely low quality)
    if (post.score < minScore) {
        return false;
    }

    return true;
};

/**
 * Fetch Reddit posts through application-only OAuth.
 */
export const fetchSubredditPosts = async (subreddit: string, limit = 10): Promise<RedditPost[]> => {
    const isMYSub = ['bursabets', 'malaysianpf'].includes(subreddit.toLowerCase());
    const configuration = getRedditOAuthConfiguration();
    if (!configuration) {
        if (!warnedUnconfigured) {
            warnedUnconfigured = true;
            console.warn('[Reddit] OAuth is not configured; Reddit sentiment is unavailable.');
        }
        return [];
    }

    try {
        const accessToken = await getRedditAccessToken(configuration);
        const url = `https://oauth.reddit.com/r/${encodeURIComponent(subreddit)}/hot?limit=${limit * 2}`;

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': configuration.userAgent,
                Accept: 'application/json',
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
            if (response.status === 401) cachedToken = null;
            console.warn(`[Reddit] Failed to fetch r/${subreddit}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        if (!data?.data?.children) return [];

        const allPosts = data.data.children.map((child: { data: Record<string, unknown> }) => ({
            title: child.data.title,
            selftext: child.data.selftext || '',
            score: child.data.score || 0,
            num_comments: child.data.num_comments || 0,
            url: child.data.url || '',
            permalink: child.data.permalink || '',
            created_utc: child.data.created_utc || Date.now() / 1000,
            subreddit: child.data.subreddit_name_prefixed || `r/${subreddit}`
        }));

        const minScore = isMYSub ? 0 : 25;
        const filteredPosts = allPosts.filter((p: RedditPost) => {
            if (isMYSub) return true;
            return isSignalPost(p, minScore);
        }).slice(0, limit);

        return filteredPosts;
    } catch (error) {
        console.error(`[Reddit] Error fetching r/${subreddit}:`, error);
        return [];
    }
};

/**
 * Fetch from multiple subreddits in parallel (with slight stagger)
 */
export const fetchMultipleSubreddits = async (subreddits: string[], limitPerSub = 10): Promise<RedditPost[]> => {
    if (!getRedditOAuthConfiguration()) {
        if (!warnedUnconfigured) {
            warnedUnconfigured = true;
            console.warn('[Reddit] OAuth is not configured; Reddit sentiment is unavailable.');
        }
        return [];
    }

    const promises = subreddits.map((sub, index) =>
        // Stagger start by 100ms per subreddit to be slightly nicer to Reddit
        new Promise<RedditPost[]>(resolve =>
            setTimeout(async () => {
                const posts = await fetchSubredditPosts(sub, limitPerSub);
                resolve(posts);
            }, index * 100)
        )
    );

    const results = await Promise.all(promises);
    return results.flat();
};
