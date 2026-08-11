import { Suspense } from "react";
import EnrichmentDashboard from "@/components/enrichment/EnrichmentDashboard";
import { EnrichmentSkeleton } from "@/components/enrichment/EnrichmentSkeleton";

export const metadata = {
  title: "Barcode Enrichment | Softcount AI",
  description: "Enrich catalog products with international barcodes from uploaded sheets.",
};

export default function EnrichmentPage() {
  return (
    <div className="w-full min-w-0">
      <Suspense fallback={<EnrichmentSkeleton />}>
        <EnrichmentDashboard />
      </Suspense>
    </div>
  );
}
