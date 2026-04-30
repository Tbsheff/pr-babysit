import { BabysitError } from "../../core/errors.js";
import type { CliServices } from "../core-services.js";
import { readFlag } from "../args.js";
import { resolvePrTarget } from "../pr-target.js";
import { requireWebhookSecret } from "../../webhooks/server.js";

export async function runWatchCommand(argv: readonly string[], services: CliServices): Promise<unknown> {
  const fixture = readFlag(argv, "--fixture");
  const target = resolvePrTarget(argv[0]);

  if (fixture !== undefined) {
    const context = await services.core.getPRContext(target);
    return { ok: true, mode: "fixture", target, headSha: context.headSha, fixture };
  }

  requireWebhookSecret();
  throw new BabysitError(
    "forwarder_missing",
    "Network watch setup is gated behind signed gh webhook forwarder verification in this local release."
  );
}
