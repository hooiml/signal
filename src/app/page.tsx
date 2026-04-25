import { SignalDashboard } from "@/components/v2/SignalDashboard";

export const revalidate = 60; // ISR cache for SEO

export default async function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white overflow-x-hidden">
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-1 bg-indigo-600" />

      <div className="relative z-10">
        <SignalDashboard />
      </div>
    </main>
  );
}
