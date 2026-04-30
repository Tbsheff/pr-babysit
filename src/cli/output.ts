import { BabysitError } from "../core/errors.js";

export interface JsonError {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, never>;
}

export function toJsonError(error: unknown): JsonError {
  if (error instanceof BabysitError) {
    return { ok: false, code: error.code, message: error.message, details: {} };
  }

  if (error instanceof Error) {
    return { ok: false, code: "network_failed", message: error.message, details: {} };
  }

  return { ok: false, code: "network_failed", message: "Unknown failure", details: {} };
}

export function stringifyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
