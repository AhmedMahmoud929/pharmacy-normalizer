import { redirect } from "@/i18n/navigation";

export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/dashboard/discovery/jobs", locale });
}
