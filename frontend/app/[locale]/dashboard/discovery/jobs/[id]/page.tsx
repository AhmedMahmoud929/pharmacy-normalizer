import { Suspense } from "react";
import { DiscoveryJobsPanel } from "@/components/discovery/DiscoveryJobsPanel";

export default async function DiscoveryJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <DiscoveryJobsPanel mode="job" jobId={id} />
    </Suspense>
  );
}
