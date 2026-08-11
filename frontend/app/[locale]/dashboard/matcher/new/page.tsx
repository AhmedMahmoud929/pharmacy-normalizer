import { Suspense } from "react";
import DrugMatcher from "@/components/DrugMatcher";

export const metadata = {
  title: "New Drug Match | Softcount AI",
  description: "Upload and map pharmacy sheets to catalog items.",
};

export default function NewMatcherPage() {
  return (
    <div className="w-full min-w-0">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        </div>
      }>
        <DrugMatcher />
      </Suspense>
    </div>
  );
}
