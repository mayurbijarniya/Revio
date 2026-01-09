"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  GitPullRequest,
  FolderGit2,
  MessageSquare,
  FileCode,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Bug,
  Shield,
  Zap,
  FileWarning,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

interface AnalyticsData {
  overview: {
    totalRepositories: number;
    totalIndexedFiles: number;
    totalReviews: number;
    totalConversations: number;
    totalMessages: number;
  };
  reviews: {
    byStatus: Array<{ status: string; count: number }>;
    byDay: Array<{ date: string; count: number; completed: number; failed: number }>;
    topRepositories: Array<{ name: string; fullName: string; reviewCount: number }>;
    feedback: Array<{ feedback: string; count: number }>;
  };
  conversations: {
    byDay: Array<{ date: string; count: number }>;
  };
  repositories: {
    byIndexStatus: Array<{ status: string; count: number }>;
  };
  codeQuality: {
    totalIssues: number;
    bySeverity: Array<{ severity: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    topFilesWithIssues: Array<{ file: string; count: number }>;
    avgIssuesPerReview: number;
  };
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?days=${days}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  const exportToCSV = () => {
    if (!data) return;

    // Build CSV content
    const lines: string[] = [];

    // Overview section
    lines.push("=== OVERVIEW ===");
    lines.push("Metric,Value");
    lines.push(`Repositories,${data.overview.totalRepositories}`);
    lines.push(`Files Indexed,${data.overview.totalIndexedFiles}`);
    lines.push(`PR Reviews,${data.overview.totalReviews}`);
    lines.push(`Conversations,${data.overview.totalConversations}`);
    lines.push(`Messages,${data.overview.totalMessages}`);
    lines.push("");

    // Reviews by status
    lines.push("=== REVIEWS BY STATUS ===");
    lines.push("Status,Count");
    data.reviews.byStatus.forEach(s => lines.push(`${s.status},${s.count}`));
    lines.push("");

    // Reviews by day
    lines.push("=== REVIEWS BY DAY ===");
    lines.push("Date,Total,Completed,Failed");
    data.reviews.byDay.forEach(d => lines.push(`${d.date},${d.count},${d.completed},${d.failed}`));
    lines.push("");

    // Code quality
    lines.push("=== CODE QUALITY ===");
    lines.push(`Total Issues,${data.codeQuality.totalIssues}`);
    lines.push(`Avg Issues Per Review,${data.codeQuality.avgIssuesPerReview}`);
    lines.push("");

    // By severity
    lines.push("=== ISSUES BY SEVERITY ===");
    lines.push("Severity,Count");
    data.codeQuality.bySeverity.forEach(s => lines.push(`${s.severity},${s.count}`));
    lines.push("");

    // By category
    lines.push("=== ISSUES BY CATEGORY ===");
    lines.push("Category,Count");
    data.codeQuality.byCategory.forEach(c => lines.push(`${c.category},${c.count}`));
    lines.push("");

    // Top files with issues
    lines.push("=== TOP FILES WITH ISSUES ===");
    lines.push("File,Issue Count");
    data.codeQuality.topFilesWithIssues.forEach(f => lines.push(`"${f.file}",${f.count}`));
    lines.push("");

    // Top repositories
    lines.push("=== TOP REPOSITORIES ===");
    lines.push("Repository,Review Count");
    data.reviews.topRepositories.forEach(r => lines.push(`${r.fullName},${r.reviewCount}`));

    // Create and download file
    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `revio-analytics-${days}days-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-500">Failed to load analytics</p>
        <button
          onClick={fetchAnalytics}
          className="mt-4 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA]"
        >
          Retry
        </button>
      </div>
    );
  }

  const completedReviews = data.reviews.byStatus.find((s) => s.status === "completed")?.count || 0;
  const failedReviews = data.reviews.byStatus.find((s) => s.status === "failed")?.count || 0;
  const pendingReviews = data.reviews.byStatus.find((s) => s.status === "pending")?.count || 0;

  const helpfulFeedback = data.reviews.feedback.find((f) => f.feedback === "helpful")?.count || 0;
  const notHelpfulFeedback = data.reviews.feedback.find((f) => f.feedback === "not_helpful")?.count || 0;
  const totalFeedback = helpfulFeedback + notHelpfulFeedback;
  const helpfulRate = totalFeedback > 0 ? Math.round((helpfulFeedback / totalFeedback) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#EEF2FF] dark:bg-[#1E1B4B] rounded-lg flex items-center justify-center border border-[#E0E7FF] dark:border-[#312E81] flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-[#4F46E5] dark:text-[#818CF8]" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm md:text-base text-gray-500">Overview of repository methods and code quality insights</p>
              <div className="flex items-center gap-4 mt-2 text-xs md:text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 md:w-4 md:h-4" />
                  Last updated: {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full md:w-auto">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="flex-1 md:flex-none px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 border border-gray-200 dark:border-gray-700"
              title="Refresh data"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
            <button
              onClick={exportToCSV}
              disabled={!data}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] transition-colors disabled:opacity-50"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#EEF2FF] rounded-lg">
              <FolderGit2 className="w-5 h-5 text-[#4F46E5]" />
            </div>
            <span className="text-sm text-gray-500">Repositories</span>
          </div>
          <div className="text-3xl font-bold">{data.overview.totalRepositories}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#ECFDF5] rounded-lg">
              <FileCode className="w-5 h-5 text-[#10B981]" />
            </div>
            <span className="text-sm text-gray-500">Files Indexed</span>
          </div>
          <div className="text-3xl font-bold">{data.overview.totalIndexedFiles.toLocaleString()}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#FEF3C7] rounded-lg">
              <GitPullRequest className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <span className="text-sm text-gray-500">PR Reviews</span>
          </div>
          <div className="text-3xl font-bold">{data.overview.totalReviews}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#F3E8FF] rounded-lg">
              <MessageSquare className="w-5 h-5 text-[#9333EA]" />
            </div>
            <span className="text-sm text-gray-500">Conversations</span>
          </div>
          <div className="text-3xl font-bold">{data.overview.totalConversations}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-[#FEE2E2] rounded-lg">
              <TrendingUp className="w-5 h-5 text-[#EF4444]" />
            </div>
            <span className="text-sm text-gray-500">Messages</span>
          </div>
          <div className="text-3xl font-bold">{data.overview.totalMessages}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reviews by Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Review Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#10B981]" />
                <span>Completed</span>
              </div>
              <span className="text-2xl font-bold text-[#10B981]">{completedReviews}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
                <span>Pending</span>
              </div>
              <span className="text-2xl font-bold text-[#F59E0B]">{pendingReviews}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-[#EF4444]" />
                <span>Failed</span>
              </div>
              <span className="text-2xl font-bold text-[#EF4444]">{failedReviews}</span>
            </div>
          </div>
          {data.overview.totalReviews > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 mb-2">Success Rate</div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] transition-all"
                  style={{ width: `${(completedReviews / data.overview.totalReviews) * 100}%` }}
                />
              </div>
              <div className="text-right text-sm mt-1 text-[#10B981] font-medium">
                {Math.round((completedReviews / data.overview.totalReviews) * 100)}%
              </div>
            </div>
          )}
        </div>

        {/* Review Feedback */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Review Feedback</h3>
          {totalFeedback === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ThumbsUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No feedback yet</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-[#10B981]" />
                    <span>Helpful</span>
                  </div>
                  <span className="text-2xl font-bold text-[#10B981]">{helpfulFeedback}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="w-5 h-5 text-[#EF4444]" />
                    <span>Not Helpful</span>
                  </div>
                  <span className="text-2xl font-bold text-[#EF4444]">{notHelpfulFeedback}</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-500 mb-2">Satisfaction Rate</div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#10B981] transition-all"
                    style={{ width: `${helpfulRate}%` }}
                  />
                </div>
                <div className="text-right text-sm mt-1 text-[#10B981] font-medium">
                  {helpfulRate}%
                </div>
              </div>
            </>
          )}
        </div>

        {/* Repository Index Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4">Index Status</h3>
          <div className="space-y-3">
            {data.repositories.byIndexStatus.map((status) => {
              const color = status.status === "indexed" ? "#10B981"
                : status.status === "indexing" ? "#4F46E5"
                  : status.status === "failed" ? "#EF4444"
                    : "#9CA3AF";
              return (
                <div key={status.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="capitalize">{status.status}</span>
                  </div>
                  <span className="font-semibold">{status.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reviews Over Time */}
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>Reviews Over Time</CardTitle>
          <CardDescription>
            {new Date(data.reviews.byDay[0]?.date || Date.now()).toLocaleDateString()} - {new Date(data.reviews.byDay[data.reviews.byDay.length - 1]?.date || Date.now()).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{
            completed: {
              label: "Completed",
              color: "#10B981",
            },
            failed: {
              label: "Failed",
              color: "#EF4444",
            },
          }} className="h-[300px] w-full">
            <LineChart
              accessibilityLayer
              data={data.reviews.byDay}
              margin={{
                left: 12,
                right: 12,
                top: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                minTickGap={30}
              />
              <ChartTooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm min-w-[120px]">
                        <div className="font-bold text-muted-foreground mb-2 text-sm">
                          {new Date(payload[0]?.payload?.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-[#10B981]" />
                              <span className="text-xs text-muted-foreground">Completed</span>
                            </div>
                            <span className="text-xs font-bold font-mono">
                              {payload.find(p => p.dataKey === "completed")?.value}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              <div className="h-2 w-2 rounded-full bg-[#EF4444]" />
                              <span className="text-xs text-muted-foreground">Failed</span>
                            </div>
                            <span className="text-xs font-bold font-mono">
                              {payload.find(p => p.dataKey === "failed")?.value}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                dataKey="completed"
                type="monotone"
                stroke="var(--color-completed)"
                strokeWidth={2}
                dot={{
                  r: 4,
                  fill: "var(--color-completed)",
                }}
                activeDot={{
                  r: 6,
                }}
              />
              <Line
                dataKey="failed"
                type="monotone"
                stroke="var(--color-failed)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{
                  r: 4,
                  fill: "var(--color-failed)",
                }}
                activeDot={{
                  r: 6,
                }}
              />
            </LineChart>
          </ChartContainer>
          <div className="h-2"></div>
        </CardContent>
      </Card>

      {/* Code Quality Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bug className="w-5 h-5 text-[#EF4444]" />
              Code Quality Metrics
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {data.codeQuality.totalIssues} issues found across {completedReviews} reviews
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{data.codeQuality.avgIssuesPerReview}</div>
            <div className="text-sm text-gray-500">avg per review</div>
          </div>
        </div>

        {data.codeQuality.totalIssues === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[#10B981] opacity-70" />
            <p className="text-sm">No issues found in this period</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Issue Severity Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">By Severity</h4>
              <div className="space-y-2">
                {data.codeQuality.bySeverity.map((item) => {
                  const color = item.severity === "critical" ? "#EF4444"
                    : item.severity === "warning" ? "#F59E0B"
                      : item.severity === "suggestion" ? "#4F46E5"
                        : "#6B7280";
                  const maxCount = Math.max(...data.codeQuality.bySeverity.map(s => s.count), 1);
                  return (
                    <div key={item.severity} className="flex items-center gap-3">
                      <div className="w-20 text-sm capitalize">{item.severity}</div>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(item.count / maxCount) * 100}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <div className="w-8 text-sm text-right font-medium">{item.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Issue Category Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">By Category</h4>
              <div className="space-y-2">
                {data.codeQuality.byCategory.slice(0, 5).map((item) => {
                  const icon = item.category === "bug" ? <Bug className="w-4 h-4" />
                    : item.category === "security" ? <Shield className="w-4 h-4" />
                      : item.category === "performance" ? <Zap className="w-4 h-4" />
                        : <AlertTriangle className="w-4 h-4" />;
                  const maxCount = Math.max(...data.codeQuality.byCategory.map(c => c.count), 1);
                  return (
                    <div key={item.category} className="flex items-center gap-3">
                      <div className="w-28 text-sm capitalize flex items-center gap-1.5">
                        <span className="text-gray-400">{icon}</span>
                        {item.category.replace("_", " ")}
                      </div>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#4F46E5] rounded-full transition-all"
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 text-sm text-right font-medium">{item.count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Top Files with Issues */}
      {data.codeQuality.topFilesWithIssues.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-[#F59E0B]" />
            Files with Most Issues
          </h3>
          <div className="space-y-2">
            {data.codeQuality.topFilesWithIssues.slice(0, 5).map((item, i) => {
              const maxCount = data.codeQuality.topFilesWithIssues[0]?.count || 1;
              return (
                <div key={item.file} className="flex items-center gap-3">
                  <div className="w-6 h-6 flex items-center justify-center text-sm font-medium text-gray-400">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate" title={item.file}>
                      {item.file}
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-[#F59E0B] rounded-full"
                        style={{ width: `${(item.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{item.count} issues</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Repositories */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4">Top Repositories by Reviews</h3>
        {data.reviews.topRepositories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FolderGit2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No reviews yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.reviews.topRepositories.map((repo, i) => {
              const maxCount = data.reviews.topRepositories[0]?.reviewCount || 1;
              return (
                <div key={repo.fullName} className="flex items-center gap-4">
                  <div className="w-6 h-6 flex items-center justify-center text-sm font-medium text-gray-500">
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{repo.fullName}</span>
                      <span className="text-sm text-gray-500">{repo.reviewCount} reviews</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4F46E5] rounded-full"
                        style={{ width: `${(repo.reviewCount / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
