import { SignJWT, importPKCS8 } from "jose";
import { Octokit } from "@octokit/rest";

const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!;

/**
 * Generate a JWT for GitHub App authentication
 */
async function generateAppJWT(): Promise<string> {
  // Parse the private key
  const privateKey = await importPKCS8(
    GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    "RS256"
  );

  // Create JWT valid for 10 minutes (GitHub's max)
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(GITHUB_APP_ID)
    .setIssuedAt(now - 60) // 60 seconds in the past to allow for clock drift
    .setExpirationTime(now + 600) // 10 minutes from now
    .sign(privateKey);

  return jwt;
}

/**
 * Get an installation token for a specific repository
 */
export async function getInstallationToken(
  owner: string,
  repo: string
): Promise<string> {
  const jwt = await generateAppJWT();

  // Create Octokit instance with JWT
  const octokit = new Octokit({ auth: jwt });

  // Find the installation for this repository
  const { data: installation } = await octokit.apps.getRepoInstallation({
    owner,
    repo,
  });

  // Create an installation access token
  const { data: tokenData } = await octokit.apps.createInstallationAccessToken({
    installation_id: installation.id,
  });

  return tokenData.token;
}

/**
 * Get installation ID for a repository
 */
export async function getInstallationId(
  owner: string,
  repo: string
): Promise<number> {
  const jwt = await generateAppJWT();
  const octokit = new Octokit({ auth: jwt });

  const { data: installation } = await octokit.apps.getRepoInstallation({
    owner,
    repo,
  });

  return installation.id;
}

/**
 * Check if the GitHub App is installed on a repository
 */
export async function isAppInstalled(
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await getInstallationId(owner, repo);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a GitHubService instance using the App's installation token
 * This allows the bot to post reviews and comments
 */
export async function createBotGitHubService(
  owner: string,
  repo: string
): Promise<{ token: string; octokit: Octokit } | null> {
  try {
    const token = await getInstallationToken(owner, repo);
    const octokit = new Octokit({ auth: token });
    return { token, octokit };
  } catch (error) {
    console.error("Failed to create bot GitHub service:", error);
    return null;
  }
}
