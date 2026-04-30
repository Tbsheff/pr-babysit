import type { Writable } from "node:stream";

import { runChecksCommand } from "./commands/checks.js";
import { runCommentsCommand } from "./commands/comments.js";
import { runPrCommand } from "./commands/pr.js";
import { runReviewsCommand } from "./commands/reviews.js";
import type { CliServices } from "./core-services.js";
import { createDefaultCliServices } from "./core-services.js";
import { formatHelp } from "./help.js";
import { toJsonError, stringifyJson } from "./output.js";

export interface CliIo {
  readonly stdout: Writable;
  readonly stderr: Writable;
}

export async function runCli(argv: readonly string[], io: CliIo, services: CliServices = createDefaultCliServices()): Promise<number> {
  const [command] = argv;

  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    io.stdout.write(formatHelp());
    return 0;
  }

  try {
    const body = await dispatch(command, argv.slice(1), services);
    if (body !== null) {
      io.stdout.write(stringifyJson(body));
    }
    return 0;
  } catch (error) {
    io.stderr.write(stringifyJson(toJsonError(error)));
    return 1;
  }
}

async function dispatch(command: string, argv: readonly string[], services: CliServices): Promise<unknown> {
  if (command === "pr") {
    return runPrCommand(argv, services);
  }
  if (command === "reviews") {
    return runReviewsCommand(argv, services);
  }
  if (command === "comments") {
    return runCommentsCommand(argv, services);
  }
  if (command === "checks") {
    return runChecksCommand(argv, services);
  }
  if (command === "watch") {
    const { runWatchCommand } = await import("./commands/watch.js");
    return runWatchCommand(argv, services);
  }
  if (command === "mcp") {
    const { runMcpCommand } = await import("../mcp/server.js");
    await runMcpCommand(argv, services);
    return null;
  }

  throw new Error(`Unknown command: ${command}`);
}
