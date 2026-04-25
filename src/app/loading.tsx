export default function Loading() {
    return (
        <main className="min-h-screen bg-[#f4f7fb] text-slate-950 p-4 md:p-8 font-sans">
            <header className="flex justify-between items-center mb-8 max-w-7xl mx-auto w-full border-b border-slate-200 pb-6">
                <div>
                    <div className="h-10 w-40 bg-white border border-slate-200 rounded-lg animate-pulse mb-2" />
                    <div className="h-4 w-64 bg-slate-200 rounded animate-pulse" />
                </div>
                <div className="text-right">
                    <div className="h-3 w-20 bg-slate-200 rounded animate-pulse ml-auto mb-2" />
                    <div className="h-8 w-28 bg-white border border-slate-200 rounded-lg animate-pulse ml-auto" />
                </div>
            </header>

            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
                <section className="lg:col-span-5 space-y-5">
                    <div className="bg-white border border-slate-200 rounded-xl p-8 h-[420px] animate-pulse" />
                    <div className="bg-white border border-slate-200 rounded-xl p-6 h-[180px] animate-pulse" />
                </section>

                <section className="lg:col-span-7 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="bg-white border border-slate-200 rounded-lg h-24 animate-pulse" />
                        ))}
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-6 h-[360px] animate-pulse" />
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="bg-white border border-slate-200 rounded-lg h-20 animate-pulse" />
                        ))}
                    </div>
                </section>
            </div>
        </main>
    );
}
