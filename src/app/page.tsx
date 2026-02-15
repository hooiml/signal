import { SignalDashboard } from "@/components/v2/SignalDashboard";

export const revalidate = 60; // ISR cache for SEO

export default async function Home() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-blue-500 selection:text-white overflow-x-hidden">
      {/* Premium Background FX */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] contrast-150 brightness-150" />
      </div>

      <div className="relative z-10">
        <SignalDashboard />
      </div>
    </main>
  );
}
