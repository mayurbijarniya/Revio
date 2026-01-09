"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Zap,
  Users,
  CreditCard,
  Loader2,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS } from "@/lib/constants";

interface UserData {
  id: string;
  githubUsername: string;
  plan: string;
}

interface UsageData {
  plan: string;
  usage: {
    repositories: number;
    prReviews: number;
    messages: number;
  };
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individual developers getting started",
    icon: Zap,
    features: [
      { text: "2 connected repositories", included: true },
      { text: "20 PR reviews / month", included: true },
      { text: "50 chat messages / month", included: true },
      { text: "10 context chunks per query", included: true },
      { text: "Community support", included: true },
    ],
    notIncluded: [
      "Custom review rules",
      "Priority support",
      "Team features",
    ],
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    period: "/month",
    yearlyPrice: "$190",
    description: "For professional developers and freelancers",
    icon: Crown,
    features: [
      { text: "10 connected repositories", included: true },
      { text: "200 PR reviews / month", included: true },
      { text: "500 chat messages / month", included: true },
      { text: "15 context chunks per query", included: true },
      { text: "Custom review rules", included: true },
      { text: "Priority support", included: true },
    ],
    notIncluded: ["Team features", "API access"],
    popular: true,
  },
  {
    id: "team",
    name: "Team",
    price: "$49",
    period: "/month",
    yearlyPrice: "$490",
    description: "For small teams and startups",
    icon: Users,
    features: [
      { text: "Unlimited repositories", included: true },
      { text: "Unlimited PR reviews", included: true },
      { text: "Unlimited chat messages", included: true },
      { text: "25 context chunks per query", included: true },
      { text: "Custom review rules", included: true },
      { text: "Priority support", included: true },
      { text: "Team management", included: true },
      { text: "API access", included: true },
    ],
    notIncluded: [],
    popular: false,
  },
];

export default function BillingPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Fetch user and usage data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, usageRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/billing/upgrade"),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData.data.user);
        }

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsage(usageData.data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === user?.plan) return;

    setLoadingPlan(planId);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      if (response.ok) {
        setSuccessMsg(`Successfully upgraded to ${planId.toUpperCase()} plan!`);
        // Refresh data
        const usageRes = await fetch("/api/billing/upgrade");
        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsage(usageData.data);
        }
        router.refresh();
      } else {
        alert("Failed to upgrade. Please try again.");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      alert("Failed to upgrade. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleDowngrade = async (planId: string) => {
    if (planId === user?.plan) return;

    setLoadingPlan(planId);
    setSuccessMsg(null);

    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      if (response.ok) {
        setSuccessMsg(`Successfully changed to ${planId.toUpperCase()} plan`);
        // Refresh data
        const usageRes = await fetch("/api/billing/upgrade");
        if (usageRes.ok) {
          const usageData = await usageRes.json();
          setUsage(usageData.data);
        }
        router.refresh();
      } else {
        alert("Failed to change plan. Please try again.");
      }
    } catch (error) {
      console.error("Plan change error:", error);
      alert("Failed to change plan. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const currentPlan = user?.plan || "free";
  const currentUsage = usage?.usage || { repositories: 0, prReviews: 0, messages: 0 };
  const planLimits = PLAN_LIMITS[currentPlan as keyof typeof PLAN_LIMITS];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#EEF2FF] dark:bg-[#1E1B4B] rounded-lg flex items-center justify-center border border-[#E0E7FF] dark:border-[#312E81] flex-shrink-0">
              <CreditCard className="w-6 h-6 text-[#4F46E5] dark:text-[#818CF8]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Billing & Subscription</h1>
              <p className="text-gray-500">Manage your subscription, billing details, and invoices</p>
              {user && (
                <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] text-[#4F46E5] border border-[#E0E7FF]">
                  Current Plan: <span className="capitalize">{currentPlan}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-full md:w-auto self-start">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex-1 md:flex-none text-center",
                billingCycle === "monthly"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex-1 md:flex-none text-center",
                billingCycle === "yearly"
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"
              )}
            >
              Yearly <span className="text-[#10B981] text-xs ml-1">-20%</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500" />
          <p className="text-green-700 dark:text-green-400">{successMsg}</p>
        </div>
      )}

      {/* Usage Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#F59E0B]" />
          Current Usage
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <UsageCard
            label="Repositories"
            used={currentUsage.repositories}
            limit={planLimits?.repos || 2}
          />
          <UsageCard
            label="PR Reviews (this month)"
            used={currentUsage.prReviews}
            limit={planLimits?.reviewsPerMonth || 20}
          />
          <UsageCard
            label="Chat Messages (this month)"
            used={currentUsage.messages}
            limit={planLimits?.messagesPerMonth || 50}
          />
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;
          const price = billingCycle === "yearly" && plan.yearlyPrice ? plan.yearlyPrice : plan.price;
          const period = billingCycle === "yearly" && plan.yearlyPrice ? "/year" : plan.period;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative rounded-lg border p-6 flex flex-col h-full transition-all",
                isCurrentPlan
                  ? "border-[#4F46E5] bg-[#EEF2FF] dark:bg-[#4F46E5]/10 ring-1 ring-[#4F46E5]"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#4F46E5]/50"
              )}
            >
              {plan.popular && !isCurrentPlan && (
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4">
                  <span className="bg-[#4F46E5] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Popular
                  </span>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4">
                  <span className="bg-[#10B981] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    Current
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center mb-4",
                  isCurrentPlan ? "bg-[#4F46E5] text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className={cn("text-lg font-bold mb-1", isCurrentPlan ? "text-[#4F46E5]" : "")}>
                  {plan.name}
                </h3>
                <p className="text-sm text-gray-500 h-10">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{price}</span>
                  <span className="text-gray-500">{period}</span>
                </div>
                {billingCycle === "yearly" && plan.yearlyPrice && (
                  <p className="text-xs text-[#10B981] font-medium mt-1">
                    Save {Math.round((parseInt(plan.price.replace("$", "")) * 12 - parseInt(plan.yearlyPrice.replace("$", ""))) / (parseInt(plan.price.replace("$", "")) * 12) * 100)}%
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                    <span>{feature.text}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm opacity-50">
                    <Check className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
                    <span className="line-through text-gray-400">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() =>
                  isCurrentPlan
                    ? plan.id === "free"
                      ? handleDowngrade("free")
                      : null
                    : plan.id === "free"
                      ? handleDowngrade("free")
                      : handleUpgrade(plan.id)
                }
                disabled={loadingPlan !== null || (isCurrentPlan && plan.id !== "free")}
                className={cn(
                  "w-full py-2.5 rounded-lg font-medium transition-colors text-sm",
                  isCurrentPlan
                    ? "bg-[#4F46E5] text-white cursor-default"
                    : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
                )}
              >
                {loadingPlan === plan.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : isCurrentPlan ? (
                  "Current Plan"
                ) : plan.id === "free" ? (
                  "Downgrade to Free"
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Payment Methods */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="font-semibold">Payment Methods</h3>
              <p className="text-sm text-gray-500">Securely manage your payment options</p>
            </div>
          </div>
          <button className="text-sm text-[#4F46E5] hover:text-[#4338CA] font-medium w-full sm:w-auto text-left sm:text-right">
            Add New Method
          </button>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg text-center border border-gray-100 dark:border-gray-700 border-dashed">
          <p className="text-sm text-gray-500">
            No payment methods on file. Upgrade to a paid plan to add a card.
          </p>
        </div>
      </div>
    </div>
  );
}

function UsageCard({
  label,
  used = 0,
  limit = 0,
}: {
  label: string;
  used?: number;
  limit?: number;
}) {
  const percentage = limit === -1 ? 0 : Math.min((used / limit) * 100, 100);
  const isUnlimited = limit === -1;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        {isUnlimited ? (
          <span className="px-2 py-1 bg-[#ECFDF5] dark:bg-[#064E3B] text-[#10B981] text-xs font-medium rounded-full">
            Unlimited
          </span>
        ) : percentage > 80 ? (
          <span className="px-2 py-1 bg-[#FEF2F2] dark:bg-[#7F1D1D] text-[#EF4444] text-xs font-medium rounded-full">
            Near limit
          </span>
        ) : percentage > 60 ? (
          <span className="px-2 py-1 bg-[#FFFBEB] dark:bg-[#78350F] text-[#F59E0B] text-xs font-medium rounded-full">
            High usage
          </span>
        ) : null}
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">
          {isUnlimited ? "∞" : (used ?? 0).toLocaleString()}
        </span>
        {!isUnlimited && (
          <span className="text-sm text-gray-500">
            / {(limit ?? 0).toLocaleString()}
          </span>
        )}
      </div>
      {!isUnlimited && (
        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              percentage > 90
                ? "bg-[#EF4444]"
                : percentage > 80
                  ? "bg-[#EF4444]"
                  : percentage > 60
                    ? "bg-[#F59E0B]"
                    : "bg-[#10B981]"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
