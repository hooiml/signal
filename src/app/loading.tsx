
export default function Loading() {
    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-8 font-sans">
            {/* Header Skeleton */}
            <header className="flex justify-between items-center mb-12 max-w-7xl mx-auto w-full border-b border-white/10 pb-6">
                <div>
                    <div className="h-10 w-32 bg-gray-900 rounded-lg animate-pulse mb-2"></div>
                    <div className="h-4 w-48 bg-gray-900 rounded animate-pulse"></div>
                </div>
                <div className="text-right">
                    <div className="h-3 w-20 bg-gray-900 rounded animate-pulse ml-auto mb-2"></div>
                    <div className="h-8 w-24 bg-gray-900 rounded animate-pulse ml-auto"></div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* LEFT COLUMN SKELETON */}
                <section className="lg:col-span-4 space-y-8">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 h-[500px] animate-pulse relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
                        <div className="h-4 w-32 bg-gray-800 rounded mb-8"></div>
                        <div className="h-24 w-48 bg-gray-800 rounded mb-4"></div>
                        <div className="h-3 w-full bg-gray-800 rounded-full mb-12"></div>
                        <div className="space-y-4">
                            <div className="h-16 w-full bg-gray-800 rounded-xl"></div>
                            <div className="h-16 w-full bg-gray-800 rounded-xl"></div>
                        </div>
                    </div>
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 h-[300px] animate-pulse">
                        <div className="h-4 w-40 bg-gray-800 rounded mb-6"></div>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex gap-4">
                                    <div className="h-2 w-2 bg-gray-800 rounded-full mt-2"></div>
                                    <div className="flex-1">
                                        <div className="h-4 w-3/4 bg-gray-800 rounded mb-2"></div>
                                        <div className="h-3 w-full bg-gray-900 rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* MIDDLE COLUMN SKELETON */}
                <section className="lg:col-span-4 space-y-6">
                    <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-[#111] border border-white/10 rounded-2xl h-24 animate-pulse"></div>
                        ))}
                    </div>
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-8 h-[600px] animate-pulse">
                        <div className="h-4 w-48 bg-gray-800 rounded mb-8"></div>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="h-4 w-full bg-gray-900 rounded"></div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* RIGHT COLUMN SKELETON */}
                <section className="lg:col-span-4 space-y-8">
                    <div className="bg-[#111] border border-white/10 rounded-3xl p-6 h-[800px] animate-pulse">
                        <div className="flex justify-between mb-8">
                            <div className="h-4 w-32 bg-gray-800 rounded"></div>
                            <div className="h-4 w-20 bg-gray-800 rounded"></div>
                        </div>
                        <div className="space-y-6">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="h-24 w-full bg-gray-900 rounded-xl"></div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
