import { Octokit } from "@octokit/rest";
import { db } from "@/lib/db";

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_APP_SLUG = "revio-bot";

type InstallationAccount = {
  id: number;
  login: string;
  type: string;
};

type InstallationLike = {
  id: number;
  account: InstallationAccount | null;
  repository_selection?: string;
  suspended_at?: string | null;
};

export type SyncedInstallation = {
  installationId: number;
  accountId: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
  suspendedAt: Date | null;
};

function normalizeInstallation(installation: InstallationLike): SyncedInstallation | null {
  if (!installation.account) {
    return null;
  }

  return {
    installationId: installation.id,
    accountId: installation.account.id,
    accountLogin: installation.account.login,
    accountType: installation.account.type,
    repositorySelection: installation.repository_selection ?? "selected",
    suspendedAt: installation.suspended_at ? new Date(installation.suspended_at) : null,
  };
}

function createUserOctokit(accessToken: string): Octokit {
  return new Octokit({ auth: accessToken });
}

export function buildGitHubAppInstallUrl(state?: string): string {
  const params = new URLSearchParams();
  if (state) {
    params.set("state", state);
  }

  const query = params.toString();
  return `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new${query ? `?${query}` : ""}`;
}

export async function listUserInstallations(accessToken: string): Promise<SyncedInstallation[]> {
  const octokit = createUserOctokit(accessToken);
  const response = await octokit.request("GET /user/installations", {
    headers: {
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
    },
  });

  const installations = Array.isArray(response.data.installations)
    ? response.data.installations
    : [];

  return installations
    .map((installation) => normalizeInstallation(installation as InstallationLike))
    .filter((installation): installation is SyncedInstallation => installation !== null);
}

export async function syncUserInstallations(
  userId: string,
  accessToken: string
): Promise<SyncedInstallation[]> {
  const installations = await listUserInstallations(accessToken);
  const now = new Date();

  await db.$transaction(async (tx) => {
    for (const installation of installations) {
      await tx.gitHubInstallation.upsert({
        where: { installationId: installation.installationId },
        create: {
          userId,
          installationId: installation.installationId,
          accountId: installation.accountId,
          accountLogin: installation.accountLogin,
          accountType: installation.accountType,
          repositorySelection: installation.repositorySelection,
          suspendedAt: installation.suspendedAt,
          uninstalledAt: null,
        },
        update: {
          userId,
          accountId: installation.accountId,
          accountLogin: installation.accountLogin,
          accountType: installation.accountType,
          repositorySelection: installation.repositorySelection,
          suspendedAt: installation.suspendedAt,
          uninstalledAt: null,
        },
      });
    }

    if (installations.length > 0) {
      await tx.gitHubInstallation.updateMany({
        where: {
          userId,
          installationId: { notIn: installations.map((installation) => installation.installationId) },
          uninstalledAt: null,
        },
        data: {
          uninstalledAt: now,
          suspendedAt: null,
        },
      });
    } else {
      await tx.gitHubInstallation.updateMany({
        where: {
          userId,
          uninstalledAt: null,
        },
        data: {
          uninstalledAt: now,
          suspendedAt: null,
        },
      });
    }
  });

  return installations;
}

export async function userHasActiveInstallation(userId: string): Promise<boolean> {
  const count = await db.gitHubInstallation.count({
    where: {
      userId,
      uninstalledAt: null,
      suspendedAt: null,
    },
  });

  return count > 0;
}

export async function syncSingleInstallationForUser(
  userId: string,
  accessToken: string,
  installationId: number
): Promise<boolean> {
  const installations = await syncUserInstallations(userId, accessToken);
  return installations.some((installation) => installation.installationId === installationId);
}

async function resolveLinkedUserId(
  accountId: number,
  accountType: string,
  currentUserId?: string | null
): Promise<string | null> {
  if (currentUserId) {
    return currentUserId;
  }

  if (accountType !== "User") {
    return null;
  }

  const user = await db.user.findUnique({
    where: { githubId: accountId },
    select: { id: true },
  });

  return user?.id ?? null;
}

export async function upsertInstallationFromWebhook(
  installation: InstallationLike,
  options?: { userId?: string | null; uninstalledAt?: Date | null; suspendedAt?: Date | null }
): Promise<void> {
  const normalized = normalizeInstallation(installation);
  if (!normalized) {
    return;
  }

  const existing = await db.gitHubInstallation.findUnique({
    where: { installationId: normalized.installationId },
    select: { userId: true },
  });

  const linkedUserId = await resolveLinkedUserId(
    normalized.accountId,
    normalized.accountType,
    options?.userId ?? existing?.userId ?? null
  );

  await db.gitHubInstallation.upsert({
    where: { installationId: normalized.installationId },
    create: {
      userId: linkedUserId,
      installationId: normalized.installationId,
      accountId: normalized.accountId,
      accountLogin: normalized.accountLogin,
      accountType: normalized.accountType,
      repositorySelection: normalized.repositorySelection,
      suspendedAt: options?.suspendedAt ?? normalized.suspendedAt,
      uninstalledAt: options?.uninstalledAt ?? null,
    },
    update: {
      userId: linkedUserId,
      accountId: normalized.accountId,
      accountLogin: normalized.accountLogin,
      accountType: normalized.accountType,
      repositorySelection: normalized.repositorySelection,
      suspendedAt: options?.suspendedAt ?? normalized.suspendedAt,
      uninstalledAt: options?.uninstalledAt ?? null,
    },
  });
}

export async function markInstallationDeleted(installation: InstallationLike): Promise<void> {
  const normalized = normalizeInstallation(installation);
  if (!normalized) {
    return;
  }

  await db.gitHubInstallation.upsert({
    where: { installationId: normalized.installationId },
    create: {
      installationId: normalized.installationId,
      accountId: normalized.accountId,
      accountLogin: normalized.accountLogin,
      accountType: normalized.accountType,
      repositorySelection: normalized.repositorySelection,
      suspendedAt: null,
      uninstalledAt: new Date(),
    },
    update: {
      accountId: normalized.accountId,
      accountLogin: normalized.accountLogin,
      accountType: normalized.accountType,
      repositorySelection: normalized.repositorySelection,
      suspendedAt: null,
      uninstalledAt: new Date(),
    },
  });
}
