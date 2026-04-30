export type CoreErrorCode =
  | "auth_failed"
  | "parse_failed"
  | "permission_denied"
  | "not_found"
  | "stale_head"
  | "unsupported_target_state"
  | "partial_mutation"
  | "rate_limited"
  | "network_failed";

export type WatchSetupErrorCode =
  | "not_git_worktree"
  | "remote_mismatch"
  | "branch_mismatch"
  | "missing_upstream"
  | "dirty_worktree"
  | "fork_head_unsupported"
  | "missing_webhook_secret"
  | "forwarder_missing"
  | "forwarder_unsigned"
  | "gh_auth_missing";

export type BabysitErrorCode = CoreErrorCode | WatchSetupErrorCode;

export class BabysitError extends Error {
  public readonly code: BabysitErrorCode;

  public constructor(code: BabysitErrorCode, message: string) {
    super(message);
    this.name = "BabysitError";
    this.code = code;
  }
}
