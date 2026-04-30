import { toCheckRunId, toCommitStatusId } from "../ids.js";
import type { NormalizedCheck, NormalizedCheckConclusion, NormalizedCheckStatus } from "../types.js";

export interface RawCheckRun {
  readonly databaseId: number;
  readonly name: string;
  readonly status: string | null;
  readonly conclusion: string | null;
  readonly url: string | null;
  readonly createdAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly workflowName: string | null;
  readonly appSlug: string | null;
}

export interface RawCommitStatus {
  readonly sha: string;
  readonly context: string;
  readonly state: string | null;
  readonly targetUrl: string | null;
  readonly createdAt: string | null;
}

function latestTimestamp(values: readonly (string | null | undefined)[]): string | null {
  const present = values.filter((value): value is string => value !== null && value !== undefined);
  if (present.length === 0) {
    return null;
  }
  return present.sort().at(-1) ?? null;
}

function normalizeCheckRunStatus(status: string | null, conclusion: string | null): {
  readonly status: NormalizedCheckStatus;
  readonly conclusion: NormalizedCheckConclusion;
} {
  const queued = new Set(["queued", "requested", "waiting", "pending"]);
  const knownConclusions = new Set(["success", "failure", "cancelled", "skipped", "timed_out", "action_required", "neutral"]);

  if (status === "completed") {
    return {
      status: "completed",
      conclusion: conclusion !== null && knownConclusions.has(conclusion) ? (conclusion as NormalizedCheckConclusion) : "unknown"
    };
  }

  if (queued.has(status ?? "")) {
    return { status: "queued", conclusion: null };
  }

  if (status === "in_progress") {
    return { status: "in_progress", conclusion: null };
  }

  return { status: "unknown", conclusion: "unknown" };
}

function normalizeCommitStatus(state: string | null): {
  readonly status: NormalizedCheckStatus;
  readonly conclusion: NormalizedCheckConclusion;
} {
  if (state === "pending") {
    return { status: "queued", conclusion: null };
  }
  if (state === "success") {
    return { status: "completed", conclusion: "success" };
  }
  if (state === "failure" || state === "error") {
    return { status: "completed", conclusion: "failure" };
  }
  return { status: "unknown", conclusion: "unknown" };
}

export function normalizeCheckRuns(checkRuns: readonly RawCheckRun[]): readonly NormalizedCheck[] {
  return checkRuns.map((checkRun) => {
    const normalized = normalizeCheckRunStatus(checkRun.status, checkRun.conclusion);
    const lastObservedAt = latestTimestamp([checkRun.completedAt, checkRun.startedAt, checkRun.createdAt]);

    return {
      id: toCheckRunId(checkRun.databaseId),
      kind: "check_run",
      source: checkRun.workflowName ?? checkRun.appSlug ?? "unknown",
      name: checkRun.name,
      status: normalized.status,
      conclusion: normalized.conclusion,
      url: checkRun.url,
      createdAt: checkRun.createdAt,
      startedAt: checkRun.startedAt,
      completedAt: checkRun.completedAt,
      lastObservedAt
    };
  });
}

export function normalizeCommitStatuses(statuses: readonly RawCommitStatus[]): readonly NormalizedCheck[] {
  return statuses.map((status) => {
    const normalized = normalizeCommitStatus(status.state);
    return {
      id: toCommitStatusId(status.sha, status.context, status.createdAt),
      kind: "commit_status",
      source: "commit_status",
      name: status.context,
      status: normalized.status,
      conclusion: normalized.conclusion,
      url: status.targetUrl,
      createdAt: status.createdAt,
      startedAt: null,
      completedAt: null,
      lastObservedAt: status.createdAt
    };
  });
}

export function dedupeLatestChecks(checks: readonly NormalizedCheck[]): readonly NormalizedCheck[] {
  const winners = new Map<string, NormalizedCheck>();

  for (const check of checks) {
    const key = `${check.kind}:${check.source}:${check.name}`;
    const current = winners.get(key);

    if (current === undefined) {
      winners.set(key, check);
      continue;
    }

    const currentObserved = current.lastObservedAt ?? "";
    const nextObserved = check.lastObservedAt ?? "";

    if (nextObserved > currentObserved || (nextObserved === currentObserved && check.id < current.id)) {
      winners.set(key, check);
    }
  }

  return [...winners.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export function normalizeChecks(
  checkRuns: readonly RawCheckRun[],
  statuses: readonly RawCommitStatus[]
): readonly NormalizedCheck[] {
  return dedupeLatestChecks([...normalizeCheckRuns(checkRuns), ...normalizeCommitStatuses(statuses)]);
}
