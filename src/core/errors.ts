export type BabysitErrorCode =
  | "auth_failed"
  | "parse_failed"
  | "permission_denied"
  | "not_found"
  | "stale_head"
  | "unsupported_target_state"
  | "partial_mutation"
  | "rate_limited"
  | "network_failed";

export class BabysitError extends Error {
  public readonly code: BabysitErrorCode;

  public constructor(code: BabysitErrorCode, message: string) {
    super(message);
    this.name = "BabysitError";
    this.code = code;
  }
}
