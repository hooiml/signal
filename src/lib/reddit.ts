
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
 * Fetch Reddit posts using public JSON API (no auth required)
 * Rate limit: 10 requests/minute (sufficient for daily cron jobs)
 */
export const fetchSubredditPosts = async (subreddit: string, limit = 10): Promise<RedditPost[]> => {
    const isMYSub = ['bursabets', 'malaysianpf'].includes(subreddit.toLowerCase());

    try {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit * 2}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            next: { revalidate: 30 }
        });

        if (!response.ok) {
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
    // Fetch ALL subreddits in parallel (Reddit public API is rate-limited but tolerant for small bursts)
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
