import { createHash } from "node:crypto";

export const babysitMarkerPrefix = "<!-- pr-babysit:id=v1:";
export const babysitMarkerPattern = /<!-- pr-babysit:id=v1:[a-f0-9]{64} -->/u;

export interface IdempotencyInput {
  readonly targetId: string;
  readonly action: string;
  readonly expectedHeadSha: string;
  readonly body: string;
}

interface CanonicalMarkerInput {
  readonly action: string;
  readonly bodySha256: string;
  readonly expectedHeadSha: string;
  readonly targetId: string;
}

export function normalizeMarkerBody(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(input: CanonicalMarkerInput): string {
  return JSON.stringify({
    action: input.action,
    bodySha256: input.bodySha256,
    expectedHeadSha: input.expectedHeadSha,
    targetId: input.targetId
  });
}

export function createIdempotencyKey(input: IdempotencyInput): string {
  const markerInput: CanonicalMarkerInput = {
    action: input.action,
    bodySha256: sha256(normalizeMarkerBody(input.body)),
    expectedHeadSha: input.expectedHeadSha,
    targetId: input.targetId
  };

  return `v1:${sha256(canonicalize(markerInput))}`;
}

export function appendIdempotencyMarker(body: string, idempotencyKey: string): string {
  return `${normalizeMarkerBody(body)}\n\n<!-- pr-babysit:id=${idempotencyKey} -->`;
}

export function containsBabysitMarker(body: string): boolean {
  return babysitMarkerPattern.test(body);
}
