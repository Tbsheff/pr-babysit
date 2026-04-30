import type { CliServices } from "../core-services.js";
import { hasFlag, requireFlag } from "../args.js";
import { resolvePrTarget } from "../pr-target.js";

export async function runCommentsCommand(argv: readonly string[], services: CliServices): Promise<unknown> {
  const [subcommand] = argv;
  const target = resolvePrTarget(argv[1]);

  if (subcommand === "list") {
    const comments = await services.core.listIssueComments(target);
    return hasFlag(argv, "--json") ? { comments } : { ok: true, comments };
  }

  if (subcommand === "add") {
    const body = requireFlag(argv, "--body");
    const expectedHead = requireFlag(argv, "--expected-head");
    return await services.core.addPrConversationComment(target, body, expectedHead);
  }

  throw new Error(`Unknown comments command: ${subcommand ?? ""}`);
}
