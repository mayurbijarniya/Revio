import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AnalyticsDashboard from "./analytics-dashboard";

export default async function AnalyticsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return <AnalyticsDashboard />;
}
