import { BabysitError } from "../core/errors.js";

export function readFlag(argv: readonly string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new BabysitError("parse_failed", `Missing value for ${name}`);
  }
  return value;
}

export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(name);
}

export function requireFlag(argv: readonly string[], name: string): string {
  const value = readFlag(argv, name);
  if (value === undefined) {
    throw new BabysitError("parse_failed", `Missing required ${name}`);
  }
  return value;
}
