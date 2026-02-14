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
    try {
        const fetchLimit = limit * 2;
        // USE 'hot' instead of 'top' to get fresher content on low-volume days
        // Switch to www.reddit.com which is sometimes preferred by Vercel edge
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${fetchLimit}`;

        console.log(`Fetching from: ${url}`);

        const response = await fetch(url, {
            headers: {
                // Use a standard browser User-Agent to avoid generic blocking
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
            next: { revalidate: 60 } // Reduce cache to 1 min to help debugging/stale data
        });

        console.log(`Reddit (${subreddit}) status: ${response.status}`);

        if (!response.ok) {
            // If old.reddit is blocked, try sh.reddit as fallback
            if (response.status === 403 || response.status === 429) {
                console.warn(`Reddit blocked old.reddit, attempting fallback...`);
            }
            throw new Error(`Reddit API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data?.data?.children) {
            console.error('Invalid Reddit response structure:', JSON.stringify(data).substring(0, 200));
            return [];
        }

        const allPosts = data.data.children.map((child: { data: any }) => ({
            title: child.data.title,
            selftext: child.data.selftext,
            score: child.data.score,
            num_comments: child.data.num_comments,
            url: child.data.url,
            permalink: child.data.permalink,
            created_utc: child.data.created_utc,
            subreddit: child.data.subreddit_name_prefixed
        }));

        // Filter out noise posts
        // For Malaysia, we set minScore to 0 because volume is low and we want to see ANY signal.
        const minScore = ['bursabets', 'malaysianpf'].includes(subreddit.toLowerCase()) ? 0 : 25;
        const filteredPosts = allPosts.filter((p: RedditPost) => isSignalPost(p, minScore)).slice(0, limit);

        console.log(`Fetched ${allPosts.length} posts, filtered to ${filteredPosts.length} signal posts from r/${subreddit} (minScore: ${minScore})`);

        return filteredPosts;
    } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
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
