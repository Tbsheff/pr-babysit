import type { CliServices } from "../core-services.js";
import { resolvePrTarget } from "../pr-target.js";

export async function runChecksCommand(argv: readonly string[], services: CliServices): Promise<unknown> {
  const [subcommand, targetArg] = argv;
  if (subcommand !== "list") {
    throw new Error(`Unknown checks command: ${subcommand ?? ""}`);
  }
  const target = resolvePrTarget(targetArg);
  return { checks: await services.core.listChecks(target) };
}
