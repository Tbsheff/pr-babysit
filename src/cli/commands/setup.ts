import { loadStoredWebhookSecret, storeWebhookSecret } from "../../core/config.js";

export interface SetupSecretResult {
  readonly ok: true;
  readonly file: string;
  readonly created: boolean;
}

export async function runSetupCommand(argv: readonly string[]): Promise<SetupSecretResult> {
  const [subcommand, ...rest] = argv;
  if (subcommand !== "secret") {
    throw new Error("Usage: pr-babysit setup secret [--force]");
  }

  const force = rest.includes("--force");
  const existing = loadStoredWebhookSecret();
  const file = await storeWebhookSecret(existing !== null && !force ? existing : undefined);

  return { ok: true, file, created: existing === null || force };
}
