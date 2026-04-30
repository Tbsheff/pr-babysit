import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";

import { BabysitError } from "../core/errors.js";

export const forwardedEvents = [
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "issue_comment",
  "check_run",
  "check_suite",
  "workflow_run",
  "status"
] as const;

export interface ForwarderProcess {
  readonly child: ChildProcess;
  stop(): Promise<void>;
}

export function ensureSignedForwarderAvailable(): void {
  try {
    execFileSync("gh", ["webhook", "forward", "--help"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new BabysitError("forwarder_missing", "Install the GitHub webhook extension with `gh extension install cli/gh-webhook`.");
  }

  const help = execFileSync("gh", ["webhook", "forward", "--help"], { encoding: "utf8" });
  if (!help.includes("--secret") && !help.includes("-S,")) {
    throw new BabysitError("forwarder_unsigned", "`gh webhook forward` must support --secret / -S.");
  }
}

export function startWebhookForwarder(repo: string, port: number, secret: string): ForwarderProcess {
  ensureSignedForwarderAvailable();
  const args = [
    "webhook",
    "forward",
    "--repo",
    repo,
    "--events",
    forwardedEvents.join(","),
    "--url",
    `http://127.0.0.1:${String(port)}/webhook`,
    "--secret",
    secret
  ];
  const child = spawn("gh", args, { stdio: "inherit" });

  return {
    child,
    async stop(): Promise<void> {
      if (child.exitCode !== null || child.killed) {
        return;
      }
      child.kill("SIGINT");
      await new Promise<void>((resolve) => {
        child.once("exit", () => {
          resolve();
        });
        setTimeout(resolve, 2_000);
      });
    }
  };
}
