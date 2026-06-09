"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Settings,
  Trash2,
  Crown,
  Shield,
  User,
  Plus,
  Loader2,
  FolderGit2,
  Activity,
  RefreshCw,
  ExternalLink,
  Clock,
  GitPullRequest,
  UserPlus,
  UserMinus,
  FileCode,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface OrgMember {
  id: string;
  role: string;
  user: {
    id: string;
    githubUsername: string;
    avatarUrl: string | null;
  };
}

interface OrgRepository {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  language: string | null;
  indexStatus: string;
  prReviewCount: number;
  conversationCount: number;
}

interface OrgActivity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    githubUsername: string;
    avatarUrl: string | null;
  };
  repository: {
    id: string;
    name: string;
    fullName: string;
  } | null;
}

interface TeamAnalytics {
  team: {
    totalReviews: number;
    completedReviews: number;
    pendingReviews: number;
    totalIssuesFound: number;
    criticalIssuesFound: number;
    satisfactionRate: number;
    avgProcessingTimeMs: number;
  };
  developers: Array<{
    userId: string;
    username: string;
    avatarUrl: string | null;
    prsAuthored: number;
    reviewsRequested: number;
    avgIssuesPerPr: number;
  }>;
}

interface OrganizationPageProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    createdAt: Date;
    userRole: string;
    isOwner: boolean;
    members: OrgMember[];
    _count: {
      repositories: number;
    };
  };
}

export default function OrganizationPage({ organization: initialOrg }: OrganizationPageProps) {
  const router = useRouter();
  const [organization, setOrganization] = useState(initialOrg);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState(initialOrg.name);
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [repoStatus, setRepoStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [memberStatus, setMemberStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; username: string } | null>(null);
  const [repoToRemove, setRepoToRemove] = useState<{ id: string; fullName: string } | null>(null);
  const [deleteOrgDialogOpen, setDeleteOrgDialogOpen] = useState(false);
  const [repositories, setRepositories] = useState<OrgRepository[]>([]);
  const [availableRepos, setAvailableRepos] = useState<OrgRepository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [activities, setActivities] = useState<OrgActivity[]>([]);
  const [analytics, setAnalytics] = useState<TeamAnalytics | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [loadingAvailableRepos, setLoadingAvailableRepos] = useState(true);
  const [addingRepo, setAddingRepo] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const canManageRepos = organization.userRole === "owner" || organization.userRole === "admin";

  // Fetch organization repositories
  const fetchRepositories = useCallback(async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch(`/api/orgs/${organization.id}/repos`);
      const data = await res.json();
      if (data.success) {
        setRepositories(data.data.repositories);
      }
    } catch {
      // Failed to fetch repositories
    } finally {
      setLoadingRepos(false);
    }
  }, [organization.id]);

  // Fetch organization activities
  const fetchActivities = useCallback(async () => {
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/orgs/${organization.id}/activity?limit=20`);
      const data = await res.json();
      if (data.success) {
        setActivities(data.data.activities);
      }
    } catch {
      // Failed to fetch activities
    } finally {
      setLoadingActivities(false);
    }
  }, [organization.id]);

  // Fetch team analytics
  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/orgs/${organization.id}/analytics?days=30`);
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch {
      // Failed to fetch analytics
    } finally {
      setLoadingAnalytics(false);
    }
  }, [organization.id]);

  const fetchAvailableRepos = useCallback(async () => {
    setLoadingAvailableRepos(true);
    try {
      const res = await fetch("/api/repos/connected");
      const data = await res.json();
      if (data.success) {
        setAvailableRepos(
          data.data.repositories.filter((repo: OrgRepository & { organizationId: string | null }) => !repo.organizationId)
        );
      }
    } catch {
      // Failed to fetch connected repositories
    } finally {
      setLoadingAvailableRepos(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchRepositories();
    fetchActivities();
    fetchAnalytics();
    fetchAvailableRepos();
  }, [fetchRepositories, fetchActivities, fetchAnalytics, fetchAvailableRepos]);

  const showError = (message: string) => {
    setErrorMsg(message);
  };

  const showSectionStatus = (
    setter: React.Dispatch<React.SetStateAction<{ type: "success" | "error"; message: string } | null>>,
    type: "success" | "error",
    message: string
  ) => {
    setter({ type, message });
    if (type === "success") {
      setTimeout(() => setter(null), 3000);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUsername: inviteUsername,
          role: inviteRole,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setInviteUsername("");
        // Update local state with new member
        setOrganization((prev) => ({
          ...prev,
          members: [...prev.members, data.data.member],
        }));
        await fetchActivities();
        showSectionStatus(setMemberStatus, "success", `${inviteUsername} has been added to the organization`);
      } else {
        const data = await response.json();
        showSectionStatus(setMemberStatus, "error", data.error?.message || "Failed to add member");
      }
    } catch (error) {
      console.error("Invite error:", error);
      showSectionStatus(setMemberStatus, "error", "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: memberToRemove.id }),
      });

      if (response.ok) {
        // Update local state
        setOrganization((prev) => ({
          ...prev,
          members: prev.members.filter((m) => m.id !== memberToRemove.id),
        }));
        setMemberToRemove(null);
        await fetchActivities();
        showSectionStatus(setMemberStatus, "success", "Member removed successfully");
      } else {
        const data = await response.json();
        showSectionStatus(setMemberStatus, "error", data.error?.message || "Failed to remove member");
      }
    } catch (error) {
      console.error("Remove member error:", error);
      showSectionStatus(setMemberStatus, "error", "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string, username: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, role: newRole }),
      });

      if (response.ok) {
        // Update local state
        setOrganization((prev) => ({
          ...prev,
          members: prev.members.map((m) =>
            m.id === memberId ? { ...m, role: newRole } : m
          ),
        }));
        await fetchActivities();
        showSectionStatus(setMemberStatus, "success", `${username}'s role updated to ${newRole}`);
      } else {
        const data = await response.json();
        showSectionStatus(setMemberStatus, "error", data.error?.message || "Failed to update role");
      }
    } catch (error) {
      console.error("Update role error:", error);
      showSectionStatus(setMemberStatus, "error", "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) return;

    setAddingRepo(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}/repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: selectedRepoId }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedRepoId("");
        setOrganization((prev) => ({
          ...prev,
          _count: {
            ...prev._count,
            repositories: prev._count.repositories + 1,
          },
        }));
        await Promise.all([fetchRepositories(), fetchAvailableRepos(), fetchActivities(), fetchAnalytics()]);
        showSectionStatus(setRepoStatus, "success", "Repository added to organization");
      } else {
        showSectionStatus(setRepoStatus, "error", data.error?.message || "Failed to add repository");
      }
    } catch (error) {
      console.error("Add repository error:", error);
      showSectionStatus(setRepoStatus, "error", "Failed to add repository");
    } finally {
      setAddingRepo(false);
    }
  };

  const handleRemoveRepository = async () => {
    if (!repoToRemove) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}/repos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: repoToRemove.id }),
      });

      const data = await response.json();
      if (data.success) {
        setRepositories((prev) => prev.filter((repo) => repo.id !== repoToRemove.id));
        setOrganization((prev) => ({
          ...prev,
          _count: {
            ...prev._count,
            repositories: Math.max(0, prev._count.repositories - 1),
          },
        }));
        await Promise.all([fetchAvailableRepos(), fetchActivities(), fetchAnalytics()]);
        setRepoToRemove(null);
        showSectionStatus(setRepoStatus, "success", "Repository removed from organization");
      } else {
        showSectionStatus(setRepoStatus, "error", data.error?.message || "Failed to remove repository");
      }
    } catch (error) {
      console.error("Remove repository error:", error);
      showSectionStatus(setRepoStatus, "error", "Failed to remove repository");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    setSavingSettings(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setOrganization((prev) => ({
          ...prev,
          name: data.data.organization.name,
        }));
        setShowSettings(false);
        await fetchActivities();
        showSectionStatus(setSettingsStatus, "success", "Organization settings updated");
      } else {
        showSectionStatus(setSettingsStatus, "error", data.error?.message || "Failed to update organization");
      }
    } catch (error) {
      console.error("Update organization error:", error);
      showSectionStatus(setSettingsStatus, "error", "Failed to update organization");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteOrganization = async () => {
    setDeletingOrg(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        router.push("/dashboard/orgs");
        router.refresh();
      } else {
        showError(data.error?.message || "Failed to delete organization");
        setDeleteOrgDialogOpen(false);
      }
    } catch (error) {
      console.error("Delete organization error:", error);
      showError("Failed to delete organization");
      setDeleteOrgDialogOpen(false);
    } finally {
      setDeletingOrg(false);
    }
  };

  const canManageMembers = organization.userRole === "owner" || organization.userRole === "admin";

  const roleIcons = {
    owner: Crown,
    admin: Shield,
    member: User,
    viewer: User,
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Back button */}
      <Link
        href="/dashboard/orgs"
        className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to organizations
      </Link>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="flex-1 text-red-700 dark:text-red-400">{errorMsg}</p>
          <button
            onClick={() => setErrorMsg(null)}
            className="rounded-lg p-1 text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#EEF2FF] dark:bg-[#1E1B4B] rounded-lg flex items-center justify-center border border-[#E0E7FF] dark:border-[#312E81]">
              <Users className="w-6 h-6 text-[#4F46E5] dark:text-[#818CF8]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold dark:text-white">{organization.name}</h1>
              <p className="text-gray-500 dark:text-gray-400">@{organization.slug}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <FolderGit2 className="w-4 h-4" />
                  {organization._count.repositories} repositories
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {organization.members.length} members
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#EEF2FF] dark:bg-indigo-900/30 text-[#4F46E5] dark:text-indigo-400 capitalize">
                  {organization.plan} Plan
                </span>
              </div>
            </div>
          </div>

          {organization.isOwner && (
            <button
              onClick={() => {
                setEditName(organization.name);
                setShowSettings(true);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Team Analytics Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2 dark:text-white">
              <BarChart3 className="w-5 h-5" />
              Team Analytics
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(Last 30 days)</span>
            </h2>
            <button
              onClick={fetchAnalytics}
              disabled={loadingAnalytics}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingAnalytics ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          </div>
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : analytics ? (
            <div className="p-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <GitPullRequest className="w-4 h-4" />
                    Total Reviews
                  </div>
                  <div className="text-2xl font-bold dark:text-white">{analytics.team.totalReviews}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {analytics.team.completedReviews} completed, {analytics.team.pendingReviews} pending
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Issues Found
                  </div>
                  <div className="text-2xl font-bold dark:text-white">{analytics.team.totalIssuesFound}</div>
                  <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                    {analytics.team.criticalIssuesFound} critical/high severity
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Satisfaction
                  </div>
                  <div className="text-2xl font-bold dark:text-white">{analytics.team.satisfactionRate}%</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Based on review feedback
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                    <Clock className="w-4 h-4" />
                    Avg Review Time
                  </div>
                  <div className="text-2xl font-bold dark:text-white">
                    {Math.round(analytics.team.avgProcessingTimeMs / 1000)}s
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Per review processing
                  </div>
                </div>
              </div>

              {/* Top Contributors */}
              {analytics.developers.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Top Contributors
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analytics.developers.slice(0, 6).map((dev) => (
                      <div
                        key={dev.userId}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        {dev.avatarUrl ? (
                          <Image
                            src={dev.avatarUrl}
                            alt={dev.username}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate dark:text-gray-200">{dev.username}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {dev.prsAuthored} PRs · {dev.avgIssuesPerPr} avg issues
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No analytics data available</p>
              <p className="text-xs mt-1">Analytics will appear when reviews are generated</p>
            </div>
          )}
        </div>

        {/* Repositories Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2 dark:text-white">
              <FolderGit2 className="w-5 h-5" />
              Repositories
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                ({repositories.length})
              </span>
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {canManageRepos && (
                <form onSubmit={handleAddRepository} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative min-w-[240px]">
                    <select
                      value={selectedRepoId}
                      onChange={(e) => setSelectedRepoId(e.target.value)}
                      disabled={loadingAvailableRepos || addingRepo || availableRepos.length === 0}
                      className="w-full appearance-none px-3 py-2 pr-8 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] disabled:opacity-50"
                    >
                      <option value="">
                        {loadingAvailableRepos
                          ? "Loading repositories..."
                          : availableRepos.length === 0
                            ? "No personal repos available"
                            : "Select repository"}
                      </option>
                      {availableRepos.map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.fullName}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={addingRepo || !selectedRepoId}
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50 text-sm font-medium"
                  >
                    {addingRepo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Add Repository
                      </>
                    )}
                  </button>
                </form>
              )}
              <button
                onClick={() => {
                  fetchRepositories();
                  fetchAvailableRepos();
                }}
                disabled={loadingRepos || loadingAvailableRepos}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {loadingRepos || loadingAvailableRepos ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          {repoStatus && (
            <div
              className={cn(
                "mx-6 mt-4 rounded-lg border px-4 py-3 text-sm",
                repoStatus.type === "success"
                  ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
              )}
            >
              {repoStatus.message}
            </div>
          )}
          {loadingRepos ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : repositories.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FolderGit2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No repositories in this organization</p>
              <p className="text-xs mt-1">
                {canManageRepos
                  ? availableRepos.length > 0
                    ? "Use the selector above to add a connected repository."
                    : "Connect a repository first, then add it to this organization."
                  : "Ask an organization admin to add repositories."}
              </p>
              {canManageRepos && availableRepos.length === 0 && !loadingAvailableRepos && (
                <Link
                  href="/dashboard/repos"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] text-sm font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Connect Repository
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <Link href={`/dashboard/repos/${repo.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <FolderGit2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div>
                      <div className="font-medium dark:text-gray-200">{repo.fullName}</div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {repo.language && <span>{repo.language}</span>}
                        <span className="flex items-center gap-1">
                          <GitPullRequest className="w-3.5 h-3.5" />
                          {repo.prReviewCount} reviews
                        </span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            repo.indexStatus === "indexed"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : repo.indexStatus === "indexing"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          )}
                        >
                          {repo.indexStatus}
                        </span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 pl-4">
                    {canManageRepos && (
                      <button
                        onClick={() => setRepoToRemove({ id: repo.id, fullName: repo.fullName })}
                        disabled={loading}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Remove from organization"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invite Section */}
        {canManageMembers && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold dark:text-white">Add Team Member</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add someone who has already signed in to Revio using their GitHub username.
              </p>
            </div>
            <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap lg:flex-nowrap">
              <input
                type="text"
                placeholder="GitHub username"
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
              />
              <div className="relative sm:w-44">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="w-full appearance-none px-4 py-2 pr-9 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5]"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !inviteUsername.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4338CA] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Member
                  </>
                )}
              </button>
            </form>
            {memberStatus && (
              <div
                className={cn(
                  "mt-4 rounded-lg border px-4 py-3 text-sm",
                  memberStatus.type === "success"
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                )}
              >
                {memberStatus.message}
              </div>
            )}
          </div>
        )}

        {/* Members List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold dark:text-white">
              Team Members ({organization.members.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {organization.members.map((member) => {
              const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] || User;

              return (
                <div key={member.id} className="px-4 md:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center gap-4">
                    {member.user.avatarUrl ? (
                      <Image
                        src={member.user.avatarUrl}
                        alt={member.user.githubUsername}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium dark:text-gray-200">{member.user.githubUsername}</span>
                        {member.role === "owner" && (
                          <span className="px-2 py-0.5 text-xs bg-[#FFFBEB] dark:bg-amber-900/30 text-[#B45309] dark:text-amber-400 border border-[#FEF3C7] dark:border-amber-800 rounded-full">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <RoleIcon className="w-3 h-3" />
                        <span className="capitalize">{member.role}</span>
                      </div>
                    </div>
                  </div>
                  {canManageMembers && member.role !== "owner" && (
                    <div className="flex items-center gap-2">
                      <div className="relative w-32">
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value, member.user.githubUsername)}
                          disabled={loading}
                          className="w-full appearance-none px-3 py-1.5 pr-8 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] disabled:opacity-50"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                      <button
                        onClick={() => setMemberToRemove({ id: member.id, username: member.user.githubUsername })}
                        disabled={loading}
                        className="p-2 text-[#EF4444] hover:bg-[#FEF2F2] rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2 dark:text-white">
              <Activity className="w-5 h-5" />
              Recent Activity
            </h2>
            <button
              onClick={fetchActivities}
              disabled={loadingActivities}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loadingActivities ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </button>
          </div>
          {loadingActivities ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {activities.map((activity) => {
                const ActivityIcon = activity.type === "repo_added" ? FolderGit2
                  : activity.type === "repo_removed" ? FolderGit2
                    : activity.type === "pr_reviewed" ? GitPullRequest
                      : activity.type === "member_joined" ? UserPlus
                        : activity.type === "member_left" ? UserMinus
                          : activity.type === "repo_indexed" ? FileCode
                            : Clock;

                const iconColor = activity.type === "repo_added" ? "text-green-500"
                  : activity.type === "repo_removed" ? "text-red-500"
                    : activity.type === "pr_reviewed" ? "text-blue-500"
                      : activity.type === "member_joined" ? "text-green-500"
                        : activity.type === "member_left" ? "text-orange-500"
                          : "text-gray-500";

                return (
                  <div key={activity.id} className="px-6 py-4 flex items-start gap-4">
                    <div className={cn("p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50", iconColor)}>
                      <ActivityIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.user.githubUsername}</span>
                        {" "}
                        <span className="text-gray-600 dark:text-gray-400">{activity.title}</span>
                      </p>
                      {activity.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(activity.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {activity.repository && (
                      <Link
                        href={`/dashboard/repos/${activity.repository.id}`}
                        className="text-xs text-[#4F46E5] hover:underline whitespace-nowrap"
                      >
                        {activity.repository.name}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        {organization.isOwner && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium dark:text-gray-200">Delete Organization</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Permanently delete this organization and all its data. This action cannot be undone.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteOrgDialogOpen(true)}
                  disabled={deletingOrg}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
                >
                  {deletingOrg && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete Organization
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold dark:text-white">Organization Settings</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Update the organization display name.
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateOrganization} className="space-y-4">
              {settingsStatus && (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm",
                    settingsStatus.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                  )}
                >
                  {settingsStatus.message}
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                  Organization Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium dark:text-gray-300">
                  URL Slug
                </label>
                <input
                  value={organization.slug}
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Slugs are fixed after organization creation.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings || !editName.trim()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#4F46E5] px-4 py-2 text-white hover:bg-[#4338CA] disabled:opacity-50"
                >
                  {savingSettings && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove team member?"
        message={
          memberToRemove
            ? `Remove ${memberToRemove.username} from ${organization.name}? They will lose access to this organization's repositories and analytics.`
            : ""
        }
        confirmText="Remove"
        variant="danger"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={repoToRemove !== null}
        onClose={() => setRepoToRemove(null)}
        onConfirm={handleRemoveRepository}
        title="Remove repository?"
        message={
          repoToRemove
            ? `Remove ${repoToRemove.fullName} from ${organization.name}? The repository will move back to your personal connected repositories.`
            : ""
        }
        confirmText="Remove"
        variant="danger"
        isLoading={loading}
      />

      <ConfirmDialog
        isOpen={deleteOrgDialogOpen}
        onClose={() => setDeleteOrgDialogOpen(false)}
        onConfirm={handleDeleteOrganization}
        title="Delete organization?"
        message={`Delete ${organization.name}? This is only allowed when the organization has no repositories and no other members.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deletingOrg}
      />
    </div>
  );
}
