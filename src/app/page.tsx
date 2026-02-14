import { getSmartSignal } from "@/lib/signal";
import MarketTabs from "@/components/MarketTabs";
import Link from 'next/link';
import type { MarketData } from "@/lib/yahoo-finance";
import type { RedditPost } from "@/lib/reddit";


interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Cache page data for 30 seconds (ISR)
export const revalidate = 30;

const getRelativeTime = (dateStr: string) => {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch { return ''; }
};

const Sparkline = ({ data, color, opacity = "opacity-20" }: { data?: number[], color: string, opacity?: string }) => {
  if (!data || data.length < 5) return null;

  const width = 100;
  const height = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Create SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={opacity}>
      <path d={`M ${points}`} fill="none" stroke="currentColor" strokeWidth="2" className={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default async function Home(props: PageProps) {
  const searchParams = await props.searchParams;
  const market = (searchParams?.market as 'US' | 'MY') || 'US';
  const data = await getSmartSignal(market);
  const { meta, marketAura, rawMetrics, sources } = data;

  // Handle error state gracefully
  if (meta?.status === 'ERROR' || !marketAura || !rawMetrics) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">⚠️ Service Temporarily Unavailable</h1>
          <p className="text-gray-500">Market data is currently unavailable. Please try again in a few minutes.</p>
          <p className="text-xs text-gray-700 mt-4">Error: {meta?.error || 'Unknown'}</p>
        </div>
      </main>
    );
  }

  const getAuraColor = (level: string) => {
    switch (level) {
      case 'EXTREME_GREED': return 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]';
      case 'GREED': return 'text-emerald-500';
      case 'NEUTRAL': return 'text-blue-400';
      case 'FEAR': return 'text-rose-500';
      case 'EXTREME_FEAR': return 'text-rose-600 drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]';
      default: return 'text-gray-400';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-emerald-600';
    if (score >= 40) return 'bg-blue-500';
    if (score >= 20) return 'bg-rose-500';
    return 'bg-rose-600';
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="flex justify-between items-center mb-12 max-w-7xl mx-auto w-full border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tighter bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">
              SIGNAL
            </h1>

            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider ${market === 'US' ? 'bg-blue-900/30 text-blue-400 border-blue-800/50' : 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50'
              }`}>
              {market === 'US' ? '🇺🇸 US MARKET' : '🇲🇾 MY MARKET'}
            </span>

            {/* Market Switcher */}
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
              <Link
                href="/?market=US"
                className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors ${market === 'US' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                🇺🇸 US
              </Link>
              <Link
                href="/?market=MY"
                className={`px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors ${market === 'MY' ? 'bg-yellow-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                🇲🇾 MY
              </Link>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-widest">Market Intelligence Terminal</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-1">MARKET AURA</div>
          <div className={`text-2xl font-black tracking-wide ${getAuraColor(marketAura.auraLevel)} shadow-lg drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]`}>
            {marketAura.auraLevel.replace('_', ' ')}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: HERO METRICS (4 cols) */}
        <section className="lg:col-span-4 space-y-8">
          {/* AURA SCORE CARD */}
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 relative group hover:border-white/20 transition-colors">
            <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <h2 className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-wider">Composite Signal Score</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none">
                {marketAura.auraScore ? Math.round(marketAura.auraScore) : '--'}
              </span>
              <span className="text-xl text-gray-400 font-medium pb-2">/ 100</span>
              <span className="relative group/tooltip cursor-help pb-2">
                <span className="text-gray-500 hover:text-gray-300 transition-colors text-sm">ⓘ</span>
                <span className="absolute left-0 top-full mt-2 w-56 p-3 bg-black/95 border border-white/10 rounded-lg text-xs text-gray-300 font-normal normal-case tracking-normal opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                  <span className="font-bold text-white block mb-2">Score Guide:</span>
                  <span className="flex justify-between"><span className="text-emerald-400">85-100</span> Extreme Greed</span>
                  <span className="flex justify-between"><span className="text-emerald-500">65-84</span> Greed (Risk-On)</span>
                  <span className="flex justify-between"><span className="text-blue-400">40-64</span> Neutral</span>
                  <span className="flex justify-between"><span className="text-rose-500">20-39</span> Fear (Risk-Off)</span>
                  <span className="flex justify-between"><span className="text-rose-400">0-19</span> Extreme Fear</span>
                </span>
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-gray-900 rounded-full mt-6 overflow-hidden border border-white/5">
              <div
                className={`h-full ${getScoreColor(marketAura.auraScore)} transition-all duration-1000 ease-out`}
                style={{ width: `${marketAura.auraScore || 0}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/5">
              <div>
                <div className="text-xs text-gray-400 font-bold mb-1 flex items-center gap-1">
                  <span>{market === 'MY' ? 'GLOBAL VIX (US)' : 'VIX INDEX'}</span>
                  <div className="tooltip-container cursor-help">
                    <span className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-gray-600 text-gray-500 text-[9px] font-bold">i</span>
                    <span className="tooltip-text">
                      <span className="font-bold text-white block mb-1">VIX Guide (Fear Gauge):</span>
                      <span className="flex justify-between gap-4"><span>&lt; 13</span> <span className="text-emerald-400">Low Vol (Complacency)</span></span>
                      <span className="flex justify-between gap-4"><span>17 - 23</span> <span className="text-blue-400">Neutral / Typical</span></span>
                      <span className="flex justify-between gap-4"><span>23 - 30</span> <span className="text-yellow-400">Anxiety / Elevated</span></span>
                      <span className="flex justify-between gap-4"><span>&gt; 30</span> <span className="text-rose-500">Panic / Crisis</span></span>
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-mono text-white">{rawMetrics.vix.toFixed(2)}</div>
                  <div className={`text-sm font-mono ${rawMetrics.vixChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {rawMetrics.vixChange >= 0 ? '+' : ''}{rawMetrics.vixChange.toFixed(2)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{rawMetrics.vixAuraLevel}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-bold mb-1">{market === 'MY' ? 'NEWS SENTIMENT' : 'SOCIAL SENTIMENT'}</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-2xl font-mono text-white">
                    {rawMetrics.components?.socialScore ? rawMetrics.components.socialScore.toFixed(0) : '--'}
                    <span className="text-sm text-gray-500 font-normal ml-1">/100</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  {market === 'MY'
                    ? `${sources.news.length} Articles`
                    : `${sources.reddit.length + (sources.stocktwits?.length || 0)} Posts`
                  }
                </div>
              </div>
            </div>

            {/* Component Weights Visual (The Split Bar) */}
            {rawMetrics.components && (
              <div className="mt-8 pt-6 border-t border-white/5">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs uppercase tracking-wider text-gray-500 font-bold">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                      <span>VIX Weight</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Social Weight</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                    </div>
                  </div>

                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-900 border border-white/5">
                    <div
                      className="bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                      style={{ width: `${Math.round(rawMetrics.components.vixWeight * 100)}%` }}
                    ></div>
                    <div
                      className="bg-blue-600 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                      style={{ width: `${Math.round((1 - rawMetrics.components.vixWeight) * 100)}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-emerald-400 font-bold">{Math.round(rawMetrics.components.vixWeight * 100)}%</span>
                    <span className="text-blue-400 font-bold">{Math.round((1 - rawMetrics.components.vixWeight) * 100)}%</span>
                  </div>

                  {/* Source Attribution Breakdown */}
                  <div className="pt-2 flex items-center justify-between text-[10px] text-gray-600 uppercase tracking-tighter">
                    <div className="flex gap-3">
                      <span>Reddit: {Math.round(rawMetrics.breakdown.reddit * 100)}%</span>
                      <span>StockTwits: {Math.round(rawMetrics.breakdown.stocktwits * 100)}%</span>
                    </div>
                    <span className="text-gray-500 italic">Verified Signal Terminal v1.0</span>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-purple-400">
              <span>{rawMetrics.scoreDescription}</span>
              <div className="tooltip-container cursor-help">
                <span className="w-4 h-4 inline-flex items-center justify-center rounded-full border border-purple-500/50 text-purple-400 text-[10px] font-bold">i</span>
                <span className="tooltip-text">
                  {rawMetrics.scoreDescription.includes('Euphoria') ? "Prices are rising on hype, not fundamentals. High risk of correction." :
                    rawMetrics.scoreDescription.includes('Bullish') ? "Strong uptrend supported by confidence. Risk is engaged." :
                      rawMetrics.scoreDescription.includes('Panic') ? "Prices crashing on fear. Potential buying opportunity for brave investors." :
                        rawMetrics.scoreDescription.includes('Bearish') ? "Investors are cautious or selling. Downside momentum." :
                          "Market is undecided. Signals are mixed or conflicting."}
                </span>
              </div>
            </div>
          </div>

          {/* KEY DRIVERS */}
          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-colors">
            <h3 className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-wider">Key Market Drivers</h3>
            <div className="space-y-4">
              {marketAura.keyDrivers.map((driver: { factor: string; description: string; impact: string }, i: number) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${driver.impact === 'positive' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                    driver.impact === 'negative' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-blue-500'
                    }`} />
                  <div>
                    <div className="font-bold text-gray-100 group-hover:text-white transition-colors text-sm">{driver.factor}</div>
                    <div className="text-sm text-gray-400 leading-relaxed mt-1">{driver.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MIDDLE COLUMN: NARRATIVE (4 cols) */}
        <section className="lg:col-span-4 space-y-6">

          {/* Market Pulse (Indices & Stocks) */}
          <div className="grid grid-cols-1 gap-4">
            {/* Indices Row */}
            <div className="grid grid-cols-3 gap-2">
              {data.marketPulse?.indices.map((idx: MarketData, i: number) => (
                <div key={i} className="bg-[#111] border border-white/10 rounded-2xl p-4 flex flex-col justify-center items-center hover:border-white/20 transition-colors relative overflow-hidden group">
                  {/* Sparkline Background */}
                  {idx.sparkline && (
                    <div className="absolute inset-x-0 bottom-0 h-12 z-0 pointer-events-none px-2 pb-2">
                      <Sparkline
                        data={idx.sparkline}
                        color={idx.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                        opacity={idx.change >= 0 ? "opacity-20" : "opacity-40"} // Boost visibility for red lines
                      />
                    </div>
                  )}

                  <div className="relative z-10 flex flex-col items-center">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                      {market === 'MY' ? idx.symbol.replace('^', '') : idx.symbol.replace('^', '')}
                    </div>
                    <div className="text-lg font-bold text-white tracking-tight leading-none mb-1">
                      {idx.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${idx.change >= 0 ? 'bg-emerald-500/30 text-emerald-50 border border-emerald-500/30' : 'bg-rose-500/30 text-rose-50 border border-rose-500/30'}`}>
                      {idx.change >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Market Tabs Component (Movers/Gainers/Losers) */}
            <MarketTabs stocks={[...(data.marketPulse?.popular || []), ...(data.marketPulse?.active || [])]} />
          </div>

          <div className="bg-[#111] border border-white/10 rounded-3xl p-8 min-h-[400px] hover:border-white/20 transition-colors">
            <h3 className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-wider flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
                AI Market Analysis
              </div>
              {marketAura.generatedAt && (
                <span className="text-[9px] text-gray-600 font-mono font-normal normal-case tracking-tight">
                  Generated {getRelativeTime(marketAura.generatedAt)}
                </span>
              )}
            </h3>
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="font-mono text-xs md:text-sm text-gray-400 leading-7 md:leading-8 whitespace-pre-line tracking-tight">{marketAura.summary}</p>
            </div>

            <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/5">
              <span className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-2 block">Outlook</span>
              <p className="text-sm text-gray-300 italic">&quot;{marketAura.outlook}&quot;</p>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: FEEDS (4 cols) */}
        <section className="lg:col-span-4 space-y-8 flex flex-col h-full">
          {/* News Feed */}
          <div className="bg-[#111] border border-white/10 rounded-3xl p-6 h-[700px] overflow-hidden flex flex-col hover:border-white/20 transition-colors flex-1">
            <h3 className="text-gray-400 text-xs font-bold mb-4 uppercase tracking-wider sticky top-0 bg-[#111] py-2 z-10 border-b border-white/5 flex justify-between">
              <span>Market Intelligence</span>
              <span className="text-emerald-500">
                {(sources?.news?.length || 0) + (sources?.reddit?.length || 0)} Signals
              </span>
            </h3>

            <div className="overflow-y-auto space-y-6 pr-2 scrollbar-thin">
              {/* Error State Overlay */}
              {!sources && (
                <div className="p-8 text-center bg-rose-500/5 rounded-2xl border border-rose-500/10 text-rose-500 text-xs font-medium">
                  ⚠️ Critical Sync Fault: Source API Unreachable.
                </div>
              )}
              <div>
                <h4 className="text-xs font-bold text-gray-600 mb-3 px-1">HEADLINES</h4>
                <div className="space-y-4">
                  {sources?.news?.slice(0, 5).map((news: { link: string; source: string; title: string; pubDate: string }, i: number) => (
                    <a key={i} href={news.link} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/10 group">
                      <div className="text-xs text-blue-400 mb-1 font-medium">{news.source}</div>
                      <div className="text-sm text-gray-300 leading-snug group-hover:text-white">{news.title}</div>
                      <div className="text-[10px] text-gray-500 mt-2">{getRelativeTime(news.pubDate)}</div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Reddit */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 mb-3 px-1 mt-6">REDDIT SIGNALS</h4>
                <div className="space-y-3">
                  {sources?.reddit?.length ? sources.reddit.slice(0, 5).map((post: RedditPost, i: number) => {
                    const postTitle = post.title || '';
                    const isBullish = postTitle.toLowerCase().match(/bull|call|moon|buy|long|surge/);
                    const isBearish = postTitle.toLowerCase().match(/bear|put|crash|sell|short|dump/);
                    const borderColor = isBullish ? 'border-emerald-500/50' : isBearish ? 'border-rose-500/50' : 'border-transparent';

                    return (
                      <a key={i} href={`https://www.reddit.com${post.permalink}`} target="_blank" rel="noopener noreferrer" className={`block p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors border-l-2 ${borderColor} hover:border-white/10 group`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">{post.subreddit}</span>
                          <div className="flex items-center gap-1 bg-orange-500/10 px-2 py-0.5 rounded-full text-[10px] text-orange-500 border border-orange-500/10">
                            <span>⬆</span>
                            <span className="font-mono font-bold">{post.score > 1000 ? `${(post.score / 1000).toFixed(1)}k` : post.score}</span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-300 leading-snug group-hover:text-white line-clamp-2">{postTitle}</div>
                      </a>
                    )
                  }) : (
                    <div className="p-4 text-center rounded-xl bg-white/[0.01] border border-white/5 text-gray-500 text-[10px] italic">
                      No active signals detected in r/BursaBets / r/MalaysianPF.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Footer: Data Quality & Timestamp */}
      <footer className="max-w-7xl mx-auto w-full mt-12 pt-6 border-t border-white/5 flex flex-wrap justify-between items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-4 text-gray-500 text-[11px] select-none">
          <span className={`px-2 py-0.5 rounded text-[10px] ${meta.dataQuality === 'GOOD' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-yellow-900/30 text-yellow-500'}`}>
            Data: {meta.dataQuality} | V2.5.7-DIAGNOSTIC
          </span>
          <span>Updated: {getRelativeTime(meta.lastUpdated)}</span>
          <span className="text-gray-600">Velocity: {meta.sentimentVelocity}</span>
          <span className="text-gray-600">Latency: {(meta.fetchDurationMs / 1000).toFixed(1)}s</span>
        </div>
        {
          meta.vixDisclaimer && (
            <div className="text-yellow-600 italic">
              ⚠️ {meta.vixDisclaimer}
            </div>
          )
        }
      </footer>
    </main>
  );
}
