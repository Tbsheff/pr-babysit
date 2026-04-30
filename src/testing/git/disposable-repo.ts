import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

let remoteAdvanceCounter = 0;

export interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

export interface DisposableGitRepo {
  readonly root: string;
  readonly remote: string;
  run(args: readonly string[]): CommandResult;
  write(relativePath: string, contents: string): Promise<void>;
  cleanup(): Promise<void>;
}

function git(cwd: string, args: readonly string[]): CommandResult {
  const stdout = execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  return { stdout, stderr: "" };
}

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function createDisposableGitRepo(): Promise<DisposableGitRepo> {
  const base = await makeTempDir("pr-babysit-git-");
  const root = path.join(base, "work");
  const remote = path.join(base, "remote.git");

  execFileSync("git", ["init", "--bare", remote], { encoding: "utf8" });
  execFileSync("git", ["init", "-b", "main", root], { encoding: "utf8" });
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "PR Babysit Test"]);
  git(root, ["remote", "add", "origin", remote]);

  const repo: DisposableGitRepo = {
    root,
    remote,
    run(args: readonly string[]): CommandResult {
      return git(root, args);
    },
    async write(relativePath: string, contents: string): Promise<void> {
      await writeFile(path.join(root, relativePath), contents);
    },
    async cleanup(): Promise<void> {
      await rm(base, { recursive: true, force: true });
    }
  };

  await repo.write("README.md", "# fixture repo\n");
  repo.run(["add", "README.md"]);
  repo.run(["commit", "-m", "chore: initial commit"]);
  repo.run(["push", "-u", "origin", "main"]);

  return repo;
}

export async function makeDirtyTree(repo: DisposableGitRepo): Promise<void> {
  await repo.write("dirty.txt", "dirty\n");
}

export function detachHead(repo: DisposableGitRepo): void {
  const head = repo.run(["rev-parse", "HEAD"]).stdout.trim();
  repo.run(["checkout", "--detach", head]);
}

export async function advanceRemote(repo: DisposableGitRepo): Promise<void> {
  const clone = await makeTempDir("pr-babysit-remote-advance-");
  remoteAdvanceCounter += 1;
  const fileName = `remote-${remoteAdvanceCounter}.txt`;

  execFileSync("git", ["clone", repo.remote, clone], { encoding: "utf8" });
  git(clone, ["config", "user.email", "test@example.com"]);
  git(clone, ["config", "user.name", "Remote Advance"]);
  await writeFile(path.join(clone, fileName), "remote\n");
  git(clone, ["add", fileName]);
  git(clone, ["commit", "-m", "chore: remote advance"]);
  git(clone, ["push", "origin", "main"]);
  await rm(clone, { recursive: true, force: true });
}

export async function makePushReject(repo: DisposableGitRepo): Promise<void> {
  await advanceRemote(repo);
  await repo.write("local.txt", "local\n");
  repo.run(["add", "local.txt"]);
  repo.run(["commit", "-m", "chore: local advance"]);
}
