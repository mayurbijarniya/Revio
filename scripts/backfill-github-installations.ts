import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { syncUserInstallations } from "@/lib/services/github-installations";

async function main() {
  const userId = process.argv[2];

  const users = await db.user.findMany({
    where: userId ? { id: userId } : undefined,
    select: {
      id: true,
      githubUsername: true,
      accessToken: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let syncedUsers = 0;
  let syncedInstallations = 0;

  for (const user of users) {
    try {
      const accessToken = decrypt(user.accessToken);
      const installations = await syncUserInstallations(user.id, accessToken);
      syncedUsers += 1;
      syncedInstallations += installations.length;
      console.log(
        `[backfill] synced ${installations.length} installation(s) for @${user.githubUsername}`
      );
    } catch (error) {
      console.error(`[backfill] failed for @${user.githubUsername}:`, error);
    }
  }

  console.log(
    `[backfill] complete: ${syncedUsers}/${users.length} user(s) synced, ${syncedInstallations} installation(s) found`
  );
}

main()
  .catch((error) => {
    console.error("[backfill] fatal error:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
