import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section
      data-dashboard-shell
      className="relative z-0 flex h-screen overflow-hidden bg-background text-foreground"
    >
      <div className="hidden lg:flex shrink-0 h-full">
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 w-full min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full min-w-0 max-w-[1600px] p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </section>
  );
}
