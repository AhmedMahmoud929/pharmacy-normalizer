import MatcherDashboard from "./MatcherDashboard";

export const metadata = {
  title: "Pharmacy Matching Campaigns | Softcount AI",
  description: "Real-time campaign management and catalog matching statistics hub.",
};

export default function MatcherPage() {
  return (
    <main className="min-h-screen bg-background py-4">
      <MatcherDashboard />
    </main>
  );
}
