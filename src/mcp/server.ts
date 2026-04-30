import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type { ReviewThreadId } from "../core/ids.js";
import { parsePrTarget } from "../cli/pr-target.js";
import type { CliServices } from "../cli/core-services.js";
import { readFlag } from "../cli/args.js";
import { stringifyJson } from "../cli/output.js";
import { requireBoundTarget } from "./boundary.js";

function jsonToolResult(value: unknown): { structuredContent: Record<string, unknown>; content: { type: "text"; text: string }[] } {
  const structuredContent = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : { value };
  return {
    structuredContent,
    content: [{ type: "text", text: stringifyJson(value) }]
  };
}

export function createMcpServer(argv: readonly string[], services: CliServices): McpServer {
  const targetArg = readFlag(argv, "--target");
  const boundTarget = targetArg === undefined ? undefined : parsePrTarget(targetArg) ?? undefined;
  const server = new McpServer({ name: "pr-babysit", version: "0.1.0" });

  server.registerTool(
    "pr.get_context",
    {
      description: "Get canonical pull request context.",
      inputSchema: { repo: z.string().optional(), number: z.number().int().positive().optional() }
    },
    async (input) => {
      const target = boundTarget ?? parsePrTarget(`${input.repo ?? ""}#${input.number ?? 0}`);
      if (target === null) {
        throw new Error("pr.get_context requires bound mode or repo/number input.");
      }
      return jsonToolResult(await services.core.getPRContext(target));
    }
  );

  server.registerTool(
    "review.list_threads",
    {
      description: "List review threads for the bound or requested PR.",
      inputSchema: {
        repo: z.string().optional(),
        number: z.number().int().positive().optional(),
        scope: z.enum(["all", "bots", "humans"]).optional(),
        state: z.enum(["all", "resolved", "unresolved"]).optional()
      }
    },
    async (input) => {
      const target = boundTarget ?? parsePrTarget(`${input.repo ?? ""}#${input.number ?? 0}`);
      if (target === null) {
        throw new Error("review.list_threads requires bound mode or repo/number input.");
      }
      const filters: { scope?: "all" | "bots" | "humans"; state?: "all" | "resolved" | "unresolved" } = {};
      if (input.scope !== undefined) {
        filters.scope = input.scope;
      }
      if (input.state !== undefined) {
        filters.state = input.state;
      }
      return jsonToolResult({ threads: await services.core.listReviewThreads(target, filters) });
    }
  );

  server.registerTool(
    "review.reply",
    {
      description: "Reply to a review thread. Requires bound mode.",
      inputSchema: { threadId: z.string(), body: z.string(), expectedHeadSha: z.string(), target: z.string().optional() }
    },
    async (input) => {
      const target = requireBoundTarget({ target: boundTarget }, input.target === undefined ? undefined : parsePrTarget(input.target) ?? undefined);
      return jsonToolResult(
        await services.core.replyToThread(input.threadId as ReviewThreadId, input.body, {
          target,
          expectedHeadSha: input.expectedHeadSha
        })
      );
    }
  );

  server.registerTool(
    "review.reply_and_resolve",
    {
      description: "Reply to and resolve a review thread. Requires bound mode.",
      inputSchema: { threadId: z.string(), body: z.string(), expectedHeadSha: z.string(), target: z.string().optional() }
    },
    async (input) => {
      const target = requireBoundTarget({ target: boundTarget }, input.target === undefined ? undefined : parsePrTarget(input.target) ?? undefined);
      return jsonToolResult(
        await services.core.replyAndResolve(input.threadId as ReviewThreadId, input.body, {
          target,
          expectedHeadSha: input.expectedHeadSha
        })
      );
    }
  );

  server.registerTool(
    "review.mark_false_positive",
    {
      description: "Reply with a false-positive reason and resolve. Requires bound mode.",
      inputSchema: { threadId: z.string(), reason: z.string(), expectedHeadSha: z.string(), target: z.string().optional() }
    },
    async (input) => {
      const target = requireBoundTarget({ target: boundTarget }, input.target === undefined ? undefined : parsePrTarget(input.target) ?? undefined);
      return jsonToolResult(
        await services.core.markFalsePositive(input.threadId as ReviewThreadId, input.reason, {
          target,
          expectedHeadSha: input.expectedHeadSha
        })
      );
    }
  );

  server.registerTool(
    "comments.list",
    {
      description: "List top-level PR conversation comments.",
      inputSchema: { repo: z.string().optional(), number: z.number().int().positive().optional() }
    },
    async (input) => {
      const target = boundTarget ?? parsePrTarget(`${input.repo ?? ""}#${input.number ?? 0}`);
      if (target === null) {
        throw new Error("comments.list requires bound mode or repo/number input.");
      }
      return jsonToolResult({ comments: await services.core.listIssueComments(target) });
    }
  );

  server.registerTool(
    "comments.add",
    {
      description: "Add a top-level PR conversation comment. Requires bound mode.",
      inputSchema: { body: z.string(), expectedHeadSha: z.string(), target: z.string().optional() }
    },
    async (input) => {
      const target = requireBoundTarget({ target: boundTarget }, input.target === undefined ? undefined : parsePrTarget(input.target) ?? undefined);
      return jsonToolResult(await services.core.addPrConversationComment(target, input.body, input.expectedHeadSha));
    }
  );

  server.registerTool(
    "checks.list",
    {
      description: "List normalized latest-head check runs and commit statuses.",
      inputSchema: { repo: z.string().optional(), number: z.number().int().positive().optional() }
    },
    async (input) => {
      const target = boundTarget ?? parsePrTarget(`${input.repo ?? ""}#${input.number ?? 0}`);
      if (target === null) {
        throw new Error("checks.list requires bound mode or repo/number input.");
      }
      return jsonToolResult({ checks: await services.core.listChecks(target) });
    }
  );

  return server;
}

export async function runMcpCommand(argv: readonly string[], services: CliServices): Promise<void> {
  const server = createMcpServer(argv, services);
  await server.connect(new StdioServerTransport());
}
