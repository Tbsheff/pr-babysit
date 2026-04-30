import type { Writable } from "node:stream";

import { formatHelp } from "./help.js";

export interface CliIo {
  readonly stdout: Writable;
  readonly stderr: Writable;
}

export function runCli(argv: readonly string[], io: CliIo): number {
  const [command] = argv;

  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    io.stdout.write(formatHelp());
    return 0;
  }

  io.stderr.write(`Unknown command: ${command}\n\n`);
  io.stderr.write(formatHelp());
  return 1;
}
