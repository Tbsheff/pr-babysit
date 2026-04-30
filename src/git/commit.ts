import { execFileSync } from "node:child_process";

export function commitAll(message = "fix: address PR review feedback", cwd = process.cwd()): boolean {
  const status = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" }).trim();
  if (status.length === 0) {
    return false;
  }
  execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "-m", message], { cwd, stdio: "ignore" });
  return true;
}
