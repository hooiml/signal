import { SignalDashboard } from '@/components/v2/SignalDashboard';

export const revalidate = 60;

export default async function Home() {
  return <SignalDashboard />;
}
