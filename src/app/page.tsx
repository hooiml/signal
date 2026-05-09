import { SignalDashboard } from '@/components/v2/SignalDashboard';

export const revalidate = 60;

export default async function Home() {
  return (
    <main className="cockpit-page relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 selection:bg-sky-400 selection:text-slate-950">
      <div className="cockpit-page-orb absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(16,185,129,0.12),_transparent_18%)]" />
      <div className="cockpit-page-grid absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:44px_44px] opacity-60" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent" />

      <div className="relative z-10">
        <SignalDashboard />
      </div>
    </main>
  );
}

