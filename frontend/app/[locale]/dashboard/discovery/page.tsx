import { Suspense } from "react";
import DiscoveryDashboard from "@/components/discovery/DiscoveryDashboard";

export default function DiscoveryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
      <DiscoveryDashboard />
    </Suspense>
  );
}
