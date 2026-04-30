import type { CliServices } from "../core-services.js";
import { resolvePrTarget } from "../pr-target.js";

export async function runPrCommand(argv: readonly string[], services: CliServices): Promise<unknown> {
  const [subcommand, targetArg] = argv;
  if (subcommand !== "context") {
    throw new Error(`Unknown pr command: ${subcommand ?? ""}`);
  }
  const target = resolvePrTarget(targetArg);
  return { ok: true, context: await services.core.getPRContext(target) };
}
