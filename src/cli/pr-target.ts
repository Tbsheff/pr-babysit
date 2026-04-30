import { execFileSync } from "node:child_process";

import { BabysitError } from "../core/errors.js";
import type { PullRequestTarget } from "../core/ids.js";
import { parsePullRequestTarget } from "../core/ids.js";

const githubPrUrlPattern = /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/pull\/(?<number>[1-9]\d*)\/?$/u;
const githubRemotePattern = /github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/u;

export function parsePrTarget(input: string): PullRequestTarget | null {
  const direct = parsePullRequestTarget(input);
  if (direct !== null) {
    return direct.target;
  }

  const url = githubPrUrlPattern.exec(input);
  const groups = url?.groups;
  if (groups !== undefined) {
    const owner = groups["owner"];
    const repo = groups["repo"];
    const number = groups["number"];
    if (owner !== undefined && repo !== undefined && number !== undefined) {
      return `${owner}/${repo}#${Number.parseInt(number, 10)}`;
    }
  }

  return null;
}

export function resolvePrTarget(input: string | undefined): PullRequestTarget {
  if (input !== undefined) {
    const parsed = parsePrTarget(input);
    if (parsed !== null) {
      return parsed;
    }

    if (/^[1-9]\d*$/u.test(input)) {
      return `${resolveRemoteRepo()}#${Number.parseInt(input, 10)}`;
    }

    throw new BabysitError("parse_failed", `Invalid pull request target: ${input}`);
  }

  try {
    const url = execFileSync("gh", ["pr", "view", "--json", "url", "--jq", ".url"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    const parsed = parsePrTarget(url);
    if (parsed !== null) {
      return parsed;
    }
  } catch {
    throw new BabysitError("parse_failed", "Could not resolve current branch pull request.");
  }

  throw new BabysitError("parse_failed", "Could not resolve current branch pull request.");
}

export function resolveRemoteRepo(): `${string}/${string}` {
  const remote = execFileSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
  const match = githubRemotePattern.exec(remote);
  const groups = match?.groups;

  if (groups === undefined || groups["owner"] === undefined || groups["repo"] === undefined) {
    throw new BabysitError("parse_failed", "Could not resolve OWNER/REPO from origin remote.");
  }

  return `${groups["owner"]}/${groups["repo"]}`;
}
