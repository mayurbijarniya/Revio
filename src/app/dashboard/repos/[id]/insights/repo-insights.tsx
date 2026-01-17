"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  Loader2,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";

interface RepoInsightsData {
  repository: {
    id: string;
    name: string;
    fullName: string;
    indexStatus: string;
    fileCount: number;
    chunkCount: number;
    lastIndexed: string | null;
  };
  period: { days: number; startDate: string };
  quality: {
    totalReviews: number;
    completedReviews: number;
    totalIssues: number;
    avgIssuesPerReview: number;
    qualityScore: number;
    severityBreakdown: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  hotspots: Array<{ file: string; issues: number; critical: number }>;
  trends: Array<{ date: string; reviews: number; issues: number; avgQuality: number }>;
  security: {
    totalIssues: number;
    criticalIssues: number;
    securityScore: number;
    categories: Array<{ category: string; count: number }>;
  };
}

export default function RepoInsights({
  repoId,
  repoName,
  repoFullName,
}: {
  repoId: string;
  repoName: string;
  repoFullName: string;
}) {
  const [data, setData] = useState<RepoInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/repos/${repoId}/insights?days=${days}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Failed to load insights");
        setData(null);
        return;
      }
      setData(json.data);
    } catch (e) {
      console.error("Failed to fetch insights:", e);
      setError("Failed to load insights");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [repoId, days]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const trendDelta = useMemo(() => {
    if (!data || data.trends.length < 2) return null;
    const first = data.trends[0];
    const last = data.trends[data.trends.length - 1];
    if (!first || !last) return null;
    return {
      from: first.avgQuality,
      to: last.avgQuality,
      delta: last.avgQuality - first.avgQuality,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800">
          {error || "No insights available"}
        </div>
        <div className="mt-4">
          <Link
            href={`/dashboard/repos/${repoId}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Repository
          </Link>
        </div>
      </div>
    );
  }

  const trendUp = trendDelta ? trendDelta.delta >= 0 : true;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Back button */}
      <Link
        href={`/dashboard/repos/${repoId}`}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Repository
      </Link>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#EEF2FF] dark:bg-[#1E1B4B] rounded-lg flex items-center justify-center border border-[#E0E7FF] dark:border-[#312E81] flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-[#4F46E5] dark:text-[#818CF8]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-bold">Repository Insights</h1>
                {trendDelta && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                      trendUp
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    )}
                  >
                    {trendUp ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {trendUp ? "+" : ""}
                    {trendDelta.delta} quality
                  </span>
                )}
              </div>
              <p className="text-sm md:text-base text-gray-500">
                {repoName} · <span className="font-mono text-xs">{repoFullName}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>Index: {data.repository.indexStatus}</span>
                <span className="text-gray-300">•</span>
                <span>{data.repository.fileCount} files</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value, 10))}
                className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>

            <button
              onClick={fetchInsights}
              className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Quality Score</CardTitle>
            <CardDescription>Based on issues per review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.quality.qualityScore}</div>
            {trendDelta && (
              <div className="mt-2 text-sm text-gray-500">
                {trendDelta.from} → {trendDelta.to} ({trendUp ? "+" : ""}{trendDelta.delta})
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Total Issues</CardTitle>
            <CardDescription>Across completed reviews</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.quality.totalIssues}</div>
            <div className="mt-2 text-sm text-gray-500">
              Avg {data.quality.avgIssuesPerReview} / review
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security Score
            </CardTitle>
            <CardDescription>From security-category issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.security.securityScore}</div>
            <div className="mt-2 text-sm text-gray-500">
              {data.security.criticalIssues} critical/high · {data.security.totalIssues} total
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Quality Trend</CardTitle>
            <CardDescription>Average quality score by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                avgQuality: { label: "Quality", color: "#4F46E5" },
              }}
              className="h-[300px] w-full"
            >
              <LineChart
                accessibilityLayer
                data={data.trends}
                margin={{ left: 12, right: 12, top: 20, bottom: 5 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  minTickGap={30}
                />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm min-w-[140px]">
                        <div className="font-bold text-muted-foreground mb-2 text-sm">
                          {new Date(p?.payload?.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-[#4F46E5]" />
                            <span className="text-xs text-muted-foreground">Quality</span>
                          </div>
                          <span className="text-xs font-bold font-mono">{p?.value}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  dataKey="avgQuality"
                  type="monotone"
                  stroke="var(--color-avgQuality)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--color-avgQuality)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle>Issues Trend</CardTitle>
            <CardDescription>Total issues found by day</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                issues: { label: "Issues", color: "#EF4444" },
              }}
              className="h-[300px] w-full"
            >
              <LineChart
                accessibilityLayer
                data={data.trends}
                margin={{ left: 12, right: 12, top: 20, bottom: 5 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  }
                  minTickGap={30}
                />
                <ChartTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0];
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm min-w-[140px]">
                        <div className="font-bold text-muted-foreground mb-2 text-sm">
                          {new Date(p?.payload?.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full bg-[#EF4444]" />
                            <span className="text-xs text-muted-foreground">Issues</span>
                          </div>
                          <span className="text-xs font-bold font-mono">{p?.value}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Line
                  dataKey="issues"
                  type="monotone"
                  stroke="var(--color-issues)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "var(--color-issues)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Hotspots */}
      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle>Hotspots</CardTitle>
          <CardDescription>Files with the most issues</CardDescription>
        </CardHeader>
        <CardContent>
          {data.hotspots.length === 0 ? (
            <p className="text-sm text-gray-500">No hotspots yet.</p>
          ) : (
            <div className="space-y-2">
              {data.hotspots.slice(0, 10).map((h) => (
                <div
                  key={h.file}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-gray-800 dark:text-gray-200 truncate" title={h.file}>
                      {h.file}
                    </div>
                    <div className="text-xs text-gray-500">
                      {h.critical} critical/high
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {h.issues}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

