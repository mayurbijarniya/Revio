"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Zap,
  Users,
  CreditCard,
  Loader2,
  Sparkles,
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
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-500 mt-2">
          Manage your subscription and billing settings
        </p>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="p-4 bg-[#ECFDF5] dark:bg-[#064E3B] border border-[#D1FAE5] dark:border-[#059669] rounded-lg">
          <p className="text-[#10B981] dark:text-[#34D399]">{successMsg}</p>
        </div>
      )}

      {/* Current Plan */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Current Plan</h2>
            <p className="text-gray-500 mt-1">
              You are currently on the{" "}
              <span className="font-medium text-[#4F46E5] capitalize">
                {currentPlan}
              </span>{" "}
              plan
            </p>
          </div>
          {currentPlan === "free" ? (
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={loadingPlan !== null}
              className="px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50"
            >
              {loadingPlan ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Upgrade to Pro"
              )}
            </button>
          ) : (
            <button
              onClick={() => handleDowngrade("free")}
              disabled={loadingPlan !== null}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 disabled:opacity-50 transition-colors"
            >
              {loadingPlan ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Downgrade to Free"
              )}
            </button>
          )}
        </div>

        {/* Usage Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <div>
        <h2 className="text-2xl font-bold mb-6">Choose Your Plan</h2>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <span className={cn(
            "text-sm font-medium transition-colors",
            billingCycle === "monthly" ? "text-gray-900 dark:text-white" : "text-gray-500"
          )}>Monthly</span>
          <button
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
            className="relative w-14 h-7 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-2"
          >
            <span
              className={cn(
                "absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200",
                billingCycle === "yearly" ? "left-8" : "left-1"
              )}
            />
          </button>
          <span className={cn(
            "text-sm font-medium transition-colors",
            billingCycle === "yearly" ? "text-gray-900 dark:text-white" : "text-gray-500"
          )}>
            Yearly <span className="text-[#10B981] text-xs font-medium ml-1">- Save 20%</span>
          </span>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = currentPlan === plan.id;

            return (
              <div
                key={plan.id}
                className={cn(
                  "pricing-card relative",
                  plan.popular && "border-[#4F46E5] border-2",
                  isCurrentPlan && !plan.popular && "border-[#10B981] border-2 bg-[#ECFDF5] dark:bg-[#064E3B]"
                )}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="plan-badge popular">
                    Most Popular
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && !plan.popular && (
                  <div className="plan-badge current">
                    Current
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-6">
                  <div
                    className={cn(
                      "w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center",
                      plan.popular
                        ? "bg-[#4F46E5] text-white"
                        : isCurrentPlan
                        ? "bg-[#10B981] text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    )}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {billingCycle === "yearly" && plan.yearlyPrice ? plan.yearlyPrice : plan.price}
                    </span>
                    <span className="text-gray-500">
                      {billingCycle === "yearly" && plan.yearlyPrice ? "/year" : plan.period}
                    </span>
                  </div>
                  {billingCycle === "yearly" && plan.yearlyPrice && (
                    <p className="text-sm text-[#10B981] font-medium mt-1">
                      Save {Math.round((parseInt(plan.price) * 12 - parseInt(plan.yearlyPrice)) / (parseInt(plan.price) * 12) * 100)}%
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
                      <span className="text-sm">{feature.text}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 opacity-50">
                      <Check className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                      <span className="text-sm line-through">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
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
                  disabled={
                    loadingPlan !== null ||
                    (isCurrentPlan && plan.id !== "free")
                  }
                  className={cn(
                    "w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                    isCurrentPlan && plan.id !== "free"
                      ? "bg-[#ECFDF5] dark:bg-[#064E3B] border border-[#D1FAE5] dark:border-[#059669] text-[#10B981] dark:text-[#34D399]"
                      : plan.popular
                      ? "bg-[#4F46E5] text-white hover:bg-[#4338CA]"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  )}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isCurrentPlan && plan.id !== "free" ? (
                    "Current Plan"
                  ) : isCurrentPlan && plan.id === "free" ? (
                    "Downgrade"
                  ) : plan.id === "free" ? (
                    "Downgrade to Free"
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Upgrade to {plan.name}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Methods (Placeholder) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="font-semibold">Payment Method</h3>
              <p className="text-sm text-gray-500">
                Manage your payment methods
              </p>
            </div>
          </div>
          <button className="text-sm text-[#4F46E5] hover:text-[#4338CA]">
            Add Payment Method
          </button>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-500">
            No payment methods on file. Upgrade to a paid plan to add a payment
            method.
          </p>
        </div>
      </div>

      {/* Billing History (Placeholder) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold mb-4">Billing History</h3>
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-500">
            No billing history yet. Upgrade to a paid plan to see your billing
            history.
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
