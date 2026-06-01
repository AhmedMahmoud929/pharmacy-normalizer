import DrugMatcher from "@/components/DrugMatcher";

export const metadata = {
  title: "Drug Matcher | Softcount AI",
  description: "Real-time drug name matching and normalization dashboard.",
};

export default function MatcherPage() {
  return (
    <main className="min-h-screen bg-background py-4">
      <DrugMatcher />
    </main>
  );
}
