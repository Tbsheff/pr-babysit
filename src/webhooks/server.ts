import http from "node:http";

import { BabysitError } from "../core/errors.js";
import { verifySignature } from "./signature.js";

export interface WebhookRequest {
  readonly event: string;
  readonly deliveryId: string;
  readonly body: string;
}

export interface WebhookServer {
  readonly port: number;
  close(): Promise<void>;
}

export async function startWebhookServer(
  port: number,
  secret: string,
  onDelivery: (request: WebhookRequest) => void
): Promise<WebhookServer> {
  const server = http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200).end("ok\n");
      return;
    }

    if (request.method !== "POST" || request.url !== "/webhook") {
      response.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const event = header(request.headers["x-github-event"]);
      const deliveryId = header(request.headers["x-github-delivery"]);
      const signature = header(request.headers["x-hub-signature-256"]);

      if (event === undefined || deliveryId === undefined || !verifySignature(secret, body, signature)) {
        response.writeHead(401).end("invalid webhook\n");
        return;
      }

      onDelivery({ event, deliveryId, body });
      response.writeHead(202).end("accepted\n");
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve();
    });
  });

  return {
    port,
    async close(): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
            return;
          }
          reject(error);
        });
      });
    }
  };
}

export function requireWebhookSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env["PR_BABYSIT_WEBHOOK_SECRET"];
  if (secret === undefined || secret.length === 0) {
    throw new BabysitError("missing_webhook_secret", "PR_BABYSIT_WEBHOOK_SECRET is required for network watch mode.");
  }
  return secret;
}

function header(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
