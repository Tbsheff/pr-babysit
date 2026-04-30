import { cp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type SkillInstallTarget = "codex" | "claude";

export interface InstalledSkill {
  readonly target: SkillInstallTarget;
  readonly directory: string;
}

export interface SkillInstallResult {
  readonly ok: true;
  readonly installed: readonly InstalledSkill[];
}

export interface SkillInstallOptions {
  readonly sourceSkillDir?: string;
  readonly codexHome?: string;
  readonly claudeHome?: string;
  readonly targets?: readonly SkillInstallTarget[];
}

export async function runSkillsCommand(argv: readonly string[]): Promise<SkillInstallResult> {
  const [subcommand, ...rest] = argv;
  if (subcommand !== "install") {
    throw new Error("Usage: pr-babysit skills install [--target all|codex|claude]");
  }

  return installGlobalSkills({ targets: parseTargets(rest) });
}

export async function installGlobalSkills(options: SkillInstallOptions = {}): Promise<SkillInstallResult> {
  const sourceSkillDir = options.sourceSkillDir ?? (await findBundledSkillDir());
  await assertSkillDir(sourceSkillDir);

  const targets = options.targets ?? ["codex", "claude"];
  const installed = await Promise.all(
    targets.map(async (target) => {
      const directory = skillDestination(target, options);
      await mkdir(path.dirname(directory), { recursive: true });
      await rm(directory, { force: true, recursive: true });
      await cp(sourceSkillDir, directory, { recursive: true });
      return { target, directory };
    })
  );

  return { ok: true, installed };
}

function parseTargets(argv: readonly string[]): readonly SkillInstallTarget[] {
  const target = readOption(argv, "--target") ?? "all";
  if (target === "all") {
    return ["codex", "claude"];
  }
  if (target === "codex" || target === "claude") {
    return [target];
  }
  throw new Error("Usage: pr-babysit skills install [--target all|codex|claude]");
}

function readOption(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function skillDestination(target: SkillInstallTarget, options: SkillInstallOptions): string {
  if (target === "codex") {
    const home = options.codexHome ?? process.env["CODEX_HOME"] ?? path.join(os.homedir(), ".codex");
    return path.join(home, "skills", "babysit");
  }

  const home = options.claudeHome ?? process.env["CLAUDE_HOME"] ?? path.join(os.homedir(), ".claude");
  return path.join(home, "skills", "babysit");
}

async function findBundledSkillDir(): Promise<string> {
  let current = import.meta.dirname;

  for (let depth = 0; depth < 8; depth += 1) {
    const packageJsonPath = path.join(current, "package.json");
    const packageJson = await readOptionalFile(packageJsonPath);
    if (packageJson !== null && packageJson.includes('"name": "pr-babysit"')) {
      return path.join(current, "skills", "babysit");
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error("Could not locate bundled babysit skill");
}

async function assertSkillDir(directory: string): Promise<void> {
  const skillMarkdown = await readOptionalFile(path.join(directory, "SKILL.md"));
  if (skillMarkdown === null || !skillMarkdown.includes("name: babysit")) {
    throw new Error(`Invalid babysit skill directory: ${directory}`);
  }
}

async function readOptionalFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
