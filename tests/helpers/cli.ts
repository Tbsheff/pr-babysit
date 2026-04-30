import { Writable } from "node:stream";

import type { CliServices } from "../../src/cli/core-services.js";
import { runCli } from "../../src/cli/run-cli.js";

class BufferWritable extends Writable {
  readonly chunks: string[] = [];

  public override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(String(chunk));
    callback();
  }

  public text(): string {
    return this.chunks.join("");
  }
}

export async function runCliForTest(argv: readonly string[], services: CliServices): Promise<{
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const stdout = new BufferWritable();
  const stderr = new BufferWritable();
  const code = await runCli(argv, { stdout, stderr }, services);
  return { code, stdout: stdout.text(), stderr: stderr.text() };
}
