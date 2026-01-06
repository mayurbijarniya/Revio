"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  Loader2,
  Crown,
  Building2,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  createdAt: Date;
  owner: {
    githubUsername: string;
    avatarUrl: string | null;
  };
  _count: {
    members: number;
    repositories: number;
  };
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Fetch organizations from API
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await fetch("/api/orgs");
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.data.organizations);
        }
      } catch (error) {
        console.error("Failed to fetch organizations:", error);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !orgSlug.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, slug: orgSlug }),
      });

      if (response.ok) {
        const data = await response.json();
        setShowCreateModal(false);
        setOrgName("");
        setOrgSlug("");
        // Add new org to list
        setOrganizations((prev) => [data.data.organization, ...prev]);
        router.push(`/dashboard/orgs/${data.data.organization.slug}`);
      } else {
        const data = await response.json();
        alert(data.error?.message || "Failed to create organization");
      }
    } catch (error) {
      console.error("Create org error:", error);
      alert("Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4F46E5]" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-gray-500 mt-2">
            Manage your teams and shared repositories
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA]"
        >
          <Plus className="w-4 h-4" />
          New Organization
        </button>
      </div>

      {/* Organizations Grid */}
      {organizations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => router.push(`/dashboard/orgs/${org.slug}`)}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-left hover:border-[#4F46E5] transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#4F46E5] rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <span className="px-2 py-1 text-xs font-medium bg-[#EEF2FF] text-[#4F46E5] rounded-full">
                  {org.plan.toUpperCase()}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-1">{org.name}</h3>
              <p className="text-sm text-gray-500 mb-4">@{org.slug}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {org._count.members}
                </div>
                <div className="flex items-center gap-1">
                  <Crown className="w-4 h-4" />
                  {org.owner.githubUsername}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="empty-state-icon">
            <Building2 />
          </div>
          <h3 className="text-xl font-semibold mb-3">No organizations yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
            Create your first organization to start collaborating with your team, manage shared repositories, and streamline your code review workflow.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#4F46E5] text-white rounded-xl hover:bg-[#4338CA] transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Organization
          </button>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Organization</h2>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Acme Corporation"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#4F46E5]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  URL Slug
                </label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-r-0 rounded-l-lg text-gray-500">
                    revio.com/org/
                  </span>
                  <input
                    type="text"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="acme-corp"
                    className="flex-1 px-4 py-2 border rounded-r-lg focus:ring-2 focus:ring-[#4F46E5]"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setOrgName("");
                    setOrgSlug("");
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !orgName.trim() || !orgSlug.trim()}
                  className="flex-1 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
