import { execFileSync } from "node:child_process";

import { BabysitError } from "./errors.js";

export function resolveGitHubToken(env: NodeJS.ProcessEnv = process.env): string {
  const token = env["GITHUB_TOKEN"];
  if (token !== undefined && token.length > 0) {
    return token;
  }

  try {
    const ghToken = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (ghToken.length > 0) {
      return ghToken;
    }
  } catch {
    throw new BabysitError("auth_failed", "Set GITHUB_TOKEN or run `gh auth login`.");
  }

  throw new BabysitError("auth_failed", "Set GITHUB_TOKEN or run `gh auth login`.");
}
