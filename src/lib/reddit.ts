export interface RedditPost {
    title: string;
    selftext: string;
    score: number;
    num_comments: number;
    url: string;
    created_utc: number;
    subreddit: string;
}

/**
 * Filter out low-signal posts (megathreads, discussion threads, questions, advice)
 */
const isSignalPost = (post: RedditPost): boolean => {
    const title = post.title.toLowerCase();

    // Filter out megathreads and discussion posts
    const noisePatterns = [
        'discussion thread',
        'daily discussion',
        'weekend discussion',
        'weekly discussion',
        'monthly discussion',
        'rate my portfolio',
        'what are your moves',
        'daily thread',
        'weekend thread',
        'earnings thread',
        'what is your',
        'quarterly thread',
        'ask r/',
        'rant thread',
        'advice thread',
        'newbie thread',
        // Question/advice seeking posts
        'how much has your',
        'do i belong',
        'first time',
        'first options',
        'should i',
        'is it worth',
        'help me',
        'advice needed',
        'need advice',
        'what would you',
        'how do i',
        'how can i',
        'am i doing',
        'did i make',
        'beginner question',
        'eternal question',
        'buy now or wait',
        'sell or hold',
        'what stocks are you',
        'which stocks',
        'where to start',
        'how and from where',
        'from where to start',
        // Personal brags/reflections (no market signal)
        'best month yet',
        'worst month',
        'biggest mistake',
        'biggest stupid',
        'my biggest',
        'i made this year',
        'my gains',
        'my losses',
        'finally broke',
        'thank you all for',
        // Portfolio-specific questions
        'portfolio:',
        'my portfolio',
        'time horizon',
        'is a 20',
        // Speculative comparison questions
        'the next',
        'is amazon',
        'is tesla',
        'is nvidia'
    ];

    // Reject if matches noise patterns
    if (noisePatterns.some(pattern => title.includes(pattern))) {
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

    // Reject posts with very low scores (likely low quality)
    if (post.score < 20) {
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
        // Fetch more than needed since we'll filter some out
        const fetchLimit = limit * 2;
        const url = `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=${fetchLimit}`;

        console.log(`Fetching from: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            next: { revalidate: 0 }
        });

        console.log(`Reddit response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Reddit API error ${response.status}:`, errorText);
            throw new Error(`Reddit API error: ${response.status} - ${errorText.substring(0, 200)}`);
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
            created_utc: child.data.created_utc,
            subreddit: child.data.subreddit_name_prefixed
        }));

        // Filter out noise posts
        const filteredPosts = allPosts.filter(isSignalPost).slice(0, limit);

        console.log(`Fetched ${allPosts.length} posts, filtered to ${filteredPosts.length} signal posts from r/${subreddit}`);

        return filteredPosts;
    } catch (error) {
        console.error(`Error fetching from r/${subreddit}:`, error);
        return [];
    }
};

/**
 * Fetch from multiple subreddits in parallel
 */
export const fetchMultipleSubreddits = async (subreddits: string[], limitPerSub = 10): Promise<RedditPost[]> => {
    const results: RedditPost[] = [];

    // Fetch sequentially with delay to avoid rate limits
    for (const sub of subreddits) {
        const posts = await fetchSubredditPosts(sub, limitPerSub);
        results.push(...posts);

        // Wait 1 second between requests to avoid rate limiting
        if (subreddits.indexOf(sub) < subreddits.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    return results;
};
