import { getSmartSignal } from "@/lib/signal";
import MarketTabs from "@/components/MarketTabs";


import Link from 'next/link';


interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

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
          <div className="text-xs text-gray-500">MARKET AURA</div>
          <div className={`text-2xl font-black ${getAuraColor(marketAura.auraLevel)}`}>
            {marketAura.auraLevel.replace('_', ' ')}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: HERO METRICS (4 cols) */}
        <section className="lg:col-span-4 space-y-8">
          {/* AURA SCORE CARD */}
          <div className="bg-[#111] border border-[#222] rounded-3xl p-8 relative overflow-hidden group hover:border-[#333] transition-colors">
            <div className="absolute top-0 right-0 p-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <h2 className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-wider">Composite Signal Score</h2>
            <div className="flex items-end gap-4">
              <span className="text-8xl font-black tracking-tighter text-white">
                {Math.round(marketAura.auraScore)}
              </span>
              <span className="text-xl text-gray-500 mb-4">/100</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-gray-900 rounded-full mt-6 overflow-hidden">
              <div
                className={`h-full ${getScoreColor(marketAura.auraScore)} transition-all duration-1000 ease-out`}
                style={{ width: `${marketAura.auraScore}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/5">
              <div>
                <div className="text-xs text-gray-500 mb-1">{market === 'MY' ? 'GLOBAL VIX (US)' : 'VIX INDEX'}</div>
                <div className="text-2xl font-mono">{rawMetrics.vix.toFixed(2)}</div>
                <div className="text-xs text-gray-600">{rawMetrics.vixAuraLevel}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{market === 'MY' ? 'NEWS SENTIMENT' : 'SOCIAL SENTIMENT'}</div>
                <div className={`text-2xl font-mono ${rawMetrics.socialSentiment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {rawMetrics.socialSentiment > 0 ? '+' : ''}{rawMetrics.socialSentiment.toFixed(2)}
                </div>
                <div className="text-xs text-gray-600">
                  {market === 'MY' ? 'The Edge, Star, NST' : 'Reddit + StockTwits'}
                </div>
              </div>
            </div>

            {/* Component Weights */}
            {rawMetrics.components && (
              <div className="mt-6 pt-6 border-t border-white/5">
                <div className="text-xs text-gray-500 mb-3">SCORE COMPONENTS</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{market === 'MY' ? 'VIX (Proxy)' : 'VIX'} Weight:</span>
                    <span className="text-gray-300 font-mono">{(rawMetrics.components.vixWeight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{market === 'MY' ? 'News' : 'Social'} Weight:</span>
                    <span className="text-gray-300 font-mono">{(rawMetrics.components.socialWeight * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">VIX Score:</span>
                    <span className="text-gray-300 font-mono">{rawMetrics.components.vixScore.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{market === 'MY' ? 'News' : 'Social'} Score:</span>
                    <span className="text-gray-300 font-mono">{rawMetrics.components.socialScore.toFixed(0)}</span>
                  </div>
                </div>
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
            )}
          </div>

          {/* KEY DRIVERS */}
          <div className="bg-[#111] border border-[#222] rounded-3xl p-8">
            <h3 className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-wider">Key Market Drivers</h3>
            <div className="space-y-4">
              {marketAura.keyDrivers.map((driver: { factor: string; description: string; impact: string }, i: number) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${driver.impact === 'positive' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' :
                    driver.impact === 'negative' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-blue-500'
                    }`} />
                  <div>
                    <div className="font-bold text-gray-200 group-hover:text-white transition-colors">{driver.factor}</div>
                    <div className="text-sm text-gray-500 leading-relaxed mt-1">{driver.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MIDDLE COLUMN: NARRATIVE (5 cols) */}
        <section className="lg:col-span-5 space-y-6">

          {/* Market Pulse (Indices & Stocks) */}
          <div className="grid grid-cols-1 gap-4">
            {/* Indices Row */}
            <div className="grid grid-cols-3 gap-2">
              {data.marketPulse?.indices.map((idx: any, i: number) => (
                <div key={i} className="bg-[#111] border border-[#222] rounded-2xl p-4 flex flex-col justify-center items-center">
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                    {market === 'MY' ? idx.symbol.replace('^', '') : idx.symbol.replace('^', '')}
                  </div>
                  <div className="text-lg font-bold text-white tracking-tight">{idx.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className={`text-xs font-mono font-medium ${idx.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {idx.change >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Market Tabs Component (Movers/Gainers/Losers) */}
            <MarketTabs stocks={[...(data.marketPulse?.popular || []), ...(data.marketPulse?.active || [])]} />
          </div>

          <div className="bg-[#111] border border-[#222] rounded-3xl p-8 min-h-[400px]">
            <h3 className="text-gray-400 text-sm font-medium mb-6 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></span>
              AI Market Analysis
            </h3>
            <div className="prose prose-invert prose-lg max-w-none">
              <p className="text-gray-300 leading-relaxed whitespace-pre-line">{marketAura.summary}</p>
            </div>

            <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/5">
              <span className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-2 block">Outlook</span>
              <p className="text-sm text-gray-300 italic">&quot;{marketAura.outlook}&quot;</p>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: FEEDS (3 cols) */}
        <section className="lg:col-span-3 space-y-8">
          {/* News Feed */}
          <div className="bg-[#111] border border-[#222] rounded-3xl p-6 h-[600px] overflow-hidden flex flex-col">
            <h3 className="text-gray-400 text-xs font-bold mb-4 uppercase tracking-wider sticky top-0 bg-[#111] py-2 z-10 border-b border-white/5 flex justify-between">
              <span>Market Intelligence</span>
              <span className="text-emerald-500">{sources.news.length + sources.reddit.length} Signals</span>
            </h3>

            <div className="overflow-y-auto space-y-6 pr-2 scrollbar-thin">
              {/* News */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 mb-3 px-1">HEADLINES</h4>
                <div className="space-y-3">
                  {sources.news.slice(0, 5).map((news, i) => (
                    <a key={i} href={news.link} target="_blank" className="block p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/10 group">
                      <div className="text-xs text-blue-400 mb-1 font-medium">{news.source}</div>
                      <div className="text-sm text-gray-300 leading-snug group-hover:text-white">{news.title}</div>
                      <div className="text-[10px] text-gray-600 mt-2">{new Date(news.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </a>
                  ))}
                </div>
              </div>

              {/* Reddit */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 mb-3 px-1 mt-6">REDDIT SIGNALS</h4>
                <div className="space-y-3">
                  {sources.reddit.slice(0, 5).map((post, i) => (
                    <a key={i} href={post.url} target="_blank" className="block p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/10 group">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] text-orange-500 font-bold">{post.subreddit}</span>
                        <span className="text-[10px] text-gray-500">🔥 {post.score}</span>
                      </div>
                      <div className="text-sm text-gray-300 leading-snug group-hover:text-white">{post.title}</div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Footer: Data Quality & Timestamp */}
      <footer className="max-w-7xl mx-auto w-full mt-12 pt-6 border-t border-white/5 flex flex-wrap justify-between items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 rounded ${meta.dataQuality === 'GOOD' ? 'bg-emerald-900/30 text-emerald-400' : meta.dataQuality === 'LIMITED' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-rose-900/30 text-rose-400'}`}>
            Data: {meta.dataQuality}
          </span>
          <span>Last Updated: {new Date(meta.lastUpdated).toLocaleTimeString()}</span>
          <span>Fetch: {meta.fetchDurationMs}ms</span>
        </div>
        {meta.vixDisclaimer && (
          <div className="text-yellow-600 italic">
            ⚠️ {meta.vixDisclaimer}
          </div>
        )}
      </footer>
    </main>
  );
}
