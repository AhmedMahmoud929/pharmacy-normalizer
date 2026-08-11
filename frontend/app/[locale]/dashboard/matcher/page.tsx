import MatcherDashboard from "./MatcherDashboard";

export const metadata = {
  title: "Pharmacy Matching Campaigns | Softcount AI",
  description: "Real-time campaign management and catalog matching statistics hub.",
};

export default function MatcherPage() {
  return (
    <div className="w-full min-w-0">
      <MatcherDashboard />
    </div>
  );
}
