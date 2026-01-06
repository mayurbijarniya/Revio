"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Settings,
  User,
  CreditCard,
  BarChart3,
  Github,
  Calendar,
  Mail,
  Shield,
  Loader2,
  CheckCircle,
  Zap,
  FolderGit2,
  MessageSquare,
  FileCode,
  GitPullRequest,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS } from "@/lib/constants";

interface UserData {
  id: string;
  githubId: number;
  githubUsername: string;
  email: string | null;
  avatarUrl: string | null;
  plan: string;
  createdAt: Date;
}

interface SettingsPageProps {
  user: UserData;
  stats: {
    repositories: number;
    conversations: number;
    reviews: number;
    messages: number;
  };
  monthlyUsage: {
    reviews: number;
    messages: number;
  };
}

export function SettingsPage({ user, stats, monthlyUsage }: SettingsPageProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<"account" | "usage" | "plan">("account");

  const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const tabs = [
    { id: "account", label: "Account", icon: User },
    { id: "usage", label: "Usage", icon: BarChart3 },
    { id: "plan", label: "Plan", icon: CreditCard },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Settings className="w-7 h-7" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tabs - Pill Style */}
      <div className="flex gap-2 mb-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all",
                activeTab === tab.id
                  ? "bg-[#4F46E5] text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </h2>
            <div className="flex items-start gap-6">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.githubUsername}
                  width={80}
                  height={80}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-600" />
                </div>
              )}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-sm text-gray-500">Username</label>
                  <div className="font-medium">{user.githubUsername}</div>
                </div>
                {user.email && (
                  <div>
                    <label className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email
                    </label>
                    <div className="font-medium">{user.email}</div>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Member since
                  </label>
                  <div className="font-medium">{formatDate(user.createdAt)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Account */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Github className="w-5 h-5" />
              Connected Account
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Github className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-medium">GitHub</div>
                  <div className="text-sm text-gray-500">
                    Connected as @{user.githubUsername}
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1 px-2 py-1 bg-[#ECFDF5] text-[#10B981] rounded text-sm">
                <CheckCircle className="w-4 h-4" />
                Connected
              </span>
            </div>
          </div>

          {/* Security */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Sign out</div>
                  <div className="text-sm text-gray-500">
                    Sign out from your account on this device
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="px-4 py-2 text-[#EF4444] border border-[#FEF2F2] rounded-lg hover:bg-[#FEF2F2] disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoggingOut && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === "usage" && (
        <div className="space-y-6">
          {/* All-time Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              All-time Statistics
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold">{stats.repositories}</div>
                <div className="text-sm text-gray-500">Repositories</div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold">{stats.conversations}</div>
                <div className="text-sm text-gray-500">Conversations</div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold">{stats.reviews}</div>
                <div className="text-sm text-gray-500">PR Reviews</div>
              </div>
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="text-2xl font-bold">{stats.messages}</div>
                <div className="text-sm text-gray-500">Messages</div>
              </div>
            </div>
          </div>

          {/* Monthly Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4">This Month&apos;s Usage</h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">PR Reviews</span>
                  <span className="text-sm text-gray-500">
                    {monthlyUsage.reviews} / {planLimits.reviewsPerMonth === -1 ? "Unlimited" : planLimits.reviewsPerMonth}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      planLimits.reviewsPerMonth === -1 || monthlyUsage.reviews < planLimits.reviewsPerMonth * 0.8
                        ? "bg-[#10B981]"
                        : monthlyUsage.reviews < planLimits.reviewsPerMonth
                        ? "bg-[#F59E0B]"
                        : "bg-[#EF4444]"
                    )}
                    style={{
                      width: planLimits.reviewsPerMonth === -1
                        ? "10%"
                        : `${Math.min((monthlyUsage.reviews / planLimits.reviewsPerMonth) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Chat Messages</span>
                  <span className="text-sm text-gray-500">
                    {monthlyUsage.messages} / {planLimits.messagesPerMonth === -1 ? "Unlimited" : planLimits.messagesPerMonth}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={cn(
                      "h-2 rounded-full",
                      planLimits.messagesPerMonth === -1 || monthlyUsage.messages < planLimits.messagesPerMonth * 0.8
                        ? "bg-[#4F46E5]"
                        : monthlyUsage.messages < planLimits.messagesPerMonth
                        ? "bg-[#F59E0B]"
                        : "bg-[#EF4444]"
                    )}
                    style={{
                      width: planLimits.messagesPerMonth === -1
                        ? "10%"
                        : `${Math.min((monthlyUsage.messages / planLimits.messagesPerMonth) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Tab */}
      {activeTab === "plan" && (
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Current Plan
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium",
                      user.plan === "free"
                        ? "bg-gray-100 text-gray-700"
                        : user.plan === "pro"
                        ? "bg-[#EEF2FF] text-[#4F46E5]"
                        : "bg-[#EEF2FF] text-[#4F46E5]"
                    )}
                  >
                    {user.plan.toUpperCase()}
                  </span>
                  {user.plan === "free" && (
                    <span className="text-sm text-gray-500">Limited features</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Plan Limits */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Plan Limits
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#EEF2FF] dark:bg-[#4F46E5]/30 rounded-lg flex items-center justify-center">
                    <FolderGit2 className="w-4 h-4 text-[#4F46E5] dark:text-[#4F46E5]" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-1">Repositories</div>
                <div className="text-2xl font-bold">
                  {planLimits.repos === -1 ? "∞" : planLimits.repos}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#ECFDF5] dark:bg-[#10B981]/30 rounded-lg flex items-center justify-center">
                    <GitPullRequest className="w-4 h-4 text-[#10B981] dark:text-[#10B981]" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-1">PR Reviews / mo</div>
                <div className="text-2xl font-bold">
                  {planLimits.reviewsPerMonth === -1 ? "∞" : planLimits.reviewsPerMonth}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#EEF2FF] dark:bg-[#4F46E5]/30 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-[#4F46E5] dark:text-[#4F46E5]" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-1">Messages / mo</div>
                <div className="text-2xl font-bold">
                  {planLimits.messagesPerMonth === -1 ? "∞" : planLimits.messagesPerMonth}
                </div>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#FFFBEB] dark:bg-[#F59E0B]/30 rounded-lg flex items-center justify-center">
                    <FileCode className="w-4 h-4 text-[#F59E0B] dark:text-[#F59E0B]" />
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-1">Context chunks</div>
                <div className="text-2xl font-bold">{planLimits.contextChunks}</div>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          {user.plan === "free" && (
            <div className="bg-[#4F46E5] rounded-lg p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/20 rounded-lg">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Upgrade to Pro</h3>
                  <p className="text-white/80 mt-1">
                    Get unlimited PR reviews, more messages, and priority support.
                  </p>
                  <button className="mt-4 px-4 py-2 bg-white text-[#4F46E5] rounded-lg font-medium hover:bg-gray-100">
                    Upgrade Now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
