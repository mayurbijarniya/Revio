"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Users,
  Settings,
  Trash2,
  Crown,
  Shield,
  User,
  Plus,
  Loader2,
  CheckCircle,
} from "lucide-react";

interface OrgMember {
  id: string;
  role: string;
  user: {
    id: string;
    githubUsername: string;
    avatarUrl: string | null;
  };
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
  const [organization, setOrganization] = useState(initialOrg);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 3000);
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
        showSuccess(`${inviteUsername} has been invited to the organization`);
      } else {
        const data = await response.json();
        alert(data.error?.message || "Failed to invite user");
      }
    } catch (error) {
      console.error("Invite error:", error);
      alert("Failed to invite user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, username: string) => {
    if (!confirm(`Are you sure you want to remove ${username} from the organization?`)) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${organization.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });

      if (response.ok) {
        // Update local state
        setOrganization((prev) => ({
          ...prev,
          members: prev.members.filter((m) => m.id !== memberId),
        }));
        showSuccess("Member removed successfully");
      } else {
        const data = await response.json();
        alert(data.error?.message || "Failed to remove member");
      }
    } catch (error) {
      console.error("Remove member error:", error);
      alert("Failed to remove member");
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
        showSuccess(`${username}'s role updated to ${newRole}`);
      } else {
        const data = await response.json();
        alert(data.error?.message || "Failed to update role");
      }
    } catch (error) {
      console.error("Update role error:", error);
      alert("Failed to update role");
    } finally {
      setLoading(false);
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
    <div className="space-y-8">
      {/* Success Message */}
      {successMsg && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="text-green-700 dark:text-green-400">{successMsg}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{organization.name}</h1>
            <p className="text-gray-500">@{organization.slug} • {organization._count.repositories} repositories</p>
          </div>
        </div>
        {organization.isOwner && (
          <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Settings className="w-4 h-4" />
            Settings
          </button>
        )}
      </div>

      {/* Invite Section */}
      {canManageMembers && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">Invite Team Members</h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="GitHub username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="viewer">Viewer</option>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={loading || !inviteUsername.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Invite
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            Team Members ({organization.members.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {organization.members.map((member) => {
            const RoleIcon = roleIcons[member.role as keyof typeof roleIcons] || User;

            return (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {member.user.avatarUrl ? (
                    <Image
                      src={member.user.avatarUrl}
                      alt={member.user.githubUsername}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-600" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.user.githubUsername}</span>
                      {member.role === "owner" && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                          Owner
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <RoleIcon className="w-3 h-3" />
                      <span className="capitalize">{member.role}</span>
                    </div>
                  </div>
                </div>
                {canManageMembers && member.role !== "owner" && (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.id, e.target.value, member.user.githubUsername)}
                      disabled={loading}
                      className="px-3 py-1 text-sm border rounded-lg focus:ring-2 focus:ring-primary disabled:opacity-50"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.id, member.user.githubUsername)}
                      disabled={loading}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
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

      {/* Danger Zone */}
      {organization.isOwner && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-6">
          <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div>
              <p className="font-medium">Delete Organization</p>
              <p className="text-sm text-gray-500">
                Permanently delete this organization and all its data
              </p>
            </div>
            <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
              Delete Organization
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
