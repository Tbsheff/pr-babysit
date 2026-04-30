import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function configDirectory(env: NodeJS.ProcessEnv = process.env): string {
  const xdgConfigHome = env["XDG_CONFIG_HOME"];
  if (xdgConfigHome !== undefined && xdgConfigHome.length > 0) {
    return path.join(xdgConfigHome, "pr-babysit");
  }

  const home = env["HOME"] ?? os.homedir();
  return path.join(home, ".config", "pr-babysit");
}

export function envFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return env["PR_BABYSIT_ENV_FILE"] ?? path.join(configDirectory(env), "env");
}

export function loadStoredWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  const filePath = envFilePath(env);
  if (!existsSync(filePath)) {
    return null;
  }

  return parseWebhookSecret(readFileSync(filePath, "utf8"));
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export async function storeWebhookSecret(
  secret: string = generateWebhookSecret(),
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const filePath = envFilePath(env);
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await chmod(path.dirname(filePath), 0o700);

  const existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const keptLines = existing
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      const normalized = stripExport(line.trim());
      return !normalized.startsWith("PR_BABYSIT_WEBHOOK_SECRET=");
    });
  keptLines.push(`export PR_BABYSIT_WEBHOOK_SECRET=${secret}`);

  await writeFile(filePath, `${keptLines.join("\n")}\n`, { mode: 0o600 });
  await chmod(filePath, 0o600);
  return filePath;
}

export function parseWebhookSecret(text: string): string | null {
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = stripExport(rawLine.trim());
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    if (key !== "PR_BABYSIT_WEBHOOK_SECRET") {
      continue;
    }

    const value = unquote(line.slice(equalsIndex + 1).trim());
    return value.length > 0 ? value : null;
  }

  return null;
}

function stripExport(line: string): string {
  const prefix = "export ";
  return line.startsWith(prefix) ? line.slice(prefix.length).trimStart() : line;
}

function unquote(value: string): string {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === "\"" && last === "\"") || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}
