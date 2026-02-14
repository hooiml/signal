'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { RedditPost } from '@/lib/reddit';

interface RedditFeedProps {
    initialPosts: RedditPost[];
    subreddits: string[];
    market: 'US' | 'MY';
}

const RedditFeed: React.FC<RedditFeedProps> = ({ initialPosts, subreddits, market }) => {
    const [posts, setPosts] = useState<RedditPost[]>(initialPosts);
    const [isLoading, setIsLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);

    const fetchClientSideReddit = useCallback(async () => {
        setIsLoading(true);
        try {
            const allFetchedPosts: RedditPost[] = [];

            for (const sub of subreddits) {
                // Use allorigins proxy to bypass CORS and avoid 403 blocks on Vercel
                const url = `https://www.reddit.com/r/${sub}/hot.json?limit=15`;
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

                try {
                    const response = await fetch(proxyUrl);
                    if (!response.ok) continue;

                    const wrapper = await response.json();
                    const data = JSON.parse(wrapper.contents);

                    if (data?.data?.children) {
                        const subPosts = data.data.children.map((child: { data: { title: string; selftext: string; score: number; num_comments: number; url: string; permalink: string; created_utc: number; subreddit_name_prefixed?: string } }) => ({
                            title: child.data.title,
                            selftext: child.data.selftext || '',
                            score: child.data.score || 0,
                            num_comments: child.data.num_comments || 0,
                            url: child.data.url || '',
                            permalink: child.data.permalink || '',
                            created_utc: child.data.created_utc || Date.now() / 1000,
                            subreddit: child.data.subreddit_name_prefixed || `r/${sub}`
                        }));

                        allFetchedPosts.push(...subPosts);
                    }
                } catch (subErr) {
                    console.error(`[RedditFeed] Error fetching r/${sub}:`, subErr);
                }
            }

            // Basic filtering (equivalent to isSignalPost)
            const isMY = market === 'MY';
            const filtered = allFetchedPosts.filter(p => {
                if (isMY) return true; // Show more for Malaysia to guarantee signal
                const title = p.title.toLowerCase();
                // Basic noise filter for US
                const noise = ['discussion', 'daily', 'weekly', 'ask r/', 'question'];
                if (noise.some(n => title.includes(n))) return false;
                return p.score >= 10; // Lower threshold slightly for better UX
            });

            if (filtered.length > 0) {
                // Sort by score and take top 10
                const sorted = filtered.sort((a, b) => b.score - a.score).slice(0, 10);
                setPosts(sorted);
            }
        } catch (error) {
            console.error("[RedditFeed] Global client fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    }, [subreddits, market]);

    useEffect(() => {
        setIsClient(true);
        // Always attempt re-sync on client mount to bypass Vercel server 403s
        void fetchClientSideReddit();
    }, [fetchClientSideReddit]);
    fragments:

    // Prevent hydration mismatch by only showing certain states after mount
    if (!isClient && (initialPosts.length === 0 || initialPosts[0].subreddit === 'r/System')) {
        return <div className="p-4 text-center rounded-xl bg-white/[0.01] border border-white/5 text-gray-600 text-[10px] italic animate-pulse">Establishing Signal Relay...</div>;
    }

    return (
        <div className="space-y-3">
            {posts.length > 0 ? (
                <>
                    {posts.slice(0, 5).map((post, i) => {
                        const postTitle = post.title || '';
                        const isBullish = postTitle.toLowerCase().match(/bull|call|moon|buy|long|surge/);
                        const isBearish = postTitle.toLowerCase().match(/bear|put|crash|sell|short|dump/);
                        const borderColor = isBullish ? 'border-emerald-500/50' : isBearish ? 'border-rose-500/50' : 'border-transparent';

                        return (
                            <a
                                key={i}
                                href={`https://www.reddit.com${post.permalink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`block p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors border-l-2 ${borderColor} hover:border-white/10 group animate-in fade-in slide-in-from-bottom-2 duration-500`}
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">{post.subreddit}</span>
                                    <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full text-[10px] text-orange-500 border border-orange-500/10">
                                        <span>⬆</span>
                                        <span className="font-mono font-bold">
                                            {post.score > 1000 ? `${(post.score / 1000).toFixed(1)}k` : post.score}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-300 leading-snug group-hover:text-white line-clamp-2">{postTitle}</div>
                            </a>
                        );
                    })}
                    {isLoading && (
                        <div className="text-[9px] text-gray-600 text-center animate-pulse pt-2">
                            ⚡ Live syncing reddit signals...
                        </div>
                    )}
                </>
            ) : (
                <div className="p-4 text-center rounded-xl bg-white/[0.01] border border-white/5 text-gray-500 text-[10px] italic">
                    {isLoading ? "Syncing with Reddit Relay..." : "No active signals detected in subreddits."}
                </div>
            )}
        </div>
    );
};

export default RedditFeed;
