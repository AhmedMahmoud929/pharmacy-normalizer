import { Suspense } from "react";
import { DiscoveryJobsPanel } from "@/components/discovery/DiscoveryJobsPanel";

export default function DiscoveryJobsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <DiscoveryJobsPanel mode="list" />
    </Suspense>
  );
}
