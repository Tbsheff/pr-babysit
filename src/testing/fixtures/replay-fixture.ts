import { readFile } from "node:fs/promises";
import path from "node:path";

import { parsePullRequestTarget } from "../../core/ids.js";
import type { JsonObject } from "./json.js";
import { isJsonObject } from "./json.js";

export type SnapshotSelector = string | readonly string[];

export interface FixtureTarget {
  readonly repo: string;
  readonly number: number;
}

export interface FixtureSnapshot {
  readonly pr: JsonObject;
  readonly threads: readonly JsonObject[];
  readonly comments: readonly JsonObject[];
  readonly checks: readonly JsonObject[];
}

export interface FixtureDelivery {
  readonly id: string;
  readonly event: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload: JsonObject;
  readonly before: SnapshotSelector | undefined;
  readonly after: SnapshotSelector | undefined;
}

export interface ReplayFixture {
  readonly target: FixtureTarget;
  readonly startup: SnapshotSelector;
  readonly deliveries: readonly FixtureDelivery[];
  readonly snapshots: Readonly<Record<string, FixtureSnapshot>>;
}

interface RawDelivery {
  readonly id: string;
  readonly event: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly payload?: JsonObject;
  readonly payloadPath?: string;
  readonly before: SnapshotSelector | undefined;
  readonly after: SnapshotSelector | undefined;
}

function hasOwn(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function requireString(object: JsonObject, key: string, pathLabel: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${pathLabel}.${key} must be a non-empty string`);
  }
  return value;
}

function requirePositiveInteger(object: JsonObject, key: string, pathLabel: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${pathLabel}.${key} must be a positive integer`);
  }
  return value;
}

function parseHeaders(value: unknown, pathLabel: string): Readonly<Record<string, string>> {
  if (value === undefined) {
    return {};
  }

  if (!isJsonObject(value)) {
    throw new Error(`${pathLabel}.headers must be an object`);
  }

  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue !== "string") {
      throw new Error(`${pathLabel}.headers.${key} must be a string`);
    }
    headers[key] = headerValue;
  }
  return headers;
}

function parseSnapshotSelector(value: unknown, pathLabel: string): SnapshotSelector {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const keys: string[] = [];

    for (const item of value) {
      if (typeof item !== "string" || item.length === 0) {
        throw new Error(`${pathLabel} must be a snapshot key or a non-empty array of snapshot keys`);
      }
      keys.push(item);
    }

    if (keys.length > 0) {
      return keys;
    }
  }

  throw new Error(`${pathLabel} must be a snapshot key or a non-empty array of snapshot keys`);
}

function optionalSnapshotSelector(object: JsonObject, key: string, pathLabel: string): SnapshotSelector | undefined {
  if (!hasOwn(object, key)) {
    return undefined;
  }
  return parseSnapshotSelector(object[key], `${pathLabel}.${key}`);
}

function parseTarget(value: unknown): FixtureTarget {
  if (!isJsonObject(value)) {
    throw new Error("target must be an object");
  }

  const repo = requireString(value, "repo", "target");
  const number = requirePositiveInteger(value, "number", "target");
  const targetText = `${repo}#${number}`;

  if (parsePullRequestTarget(targetText) === null) {
    throw new Error("target.repo must be OWNER/REPO and target.number must be positive");
  }

  return { repo, number };
}

function parseSnapshot(value: unknown, key: string): FixtureSnapshot {
  if (!isJsonObject(value)) {
    throw new Error(`snapshots.${key} must be an object`);
  }

  const pr = value["pr"];
  const threads = value["threads"];
  const comments = value["comments"];
  const checks = value["checks"];

  if (!isJsonObject(pr)) {
    throw new Error(`snapshots.${key}.pr must be an object`);
  }

  if (!Array.isArray(threads) || !threads.every(isJsonObject)) {
    throw new Error(`snapshots.${key}.threads must be an array of objects`);
  }

  if (!Array.isArray(comments) || !comments.every(isJsonObject)) {
    throw new Error(`snapshots.${key}.comments must be an array of objects`);
  }

  if (!Array.isArray(checks) || !checks.every(isJsonObject)) {
    throw new Error(`snapshots.${key}.checks must be an array of objects`);
  }

  return { pr, threads, comments, checks };
}

function parseSnapshots(value: unknown): Readonly<Record<string, FixtureSnapshot>> {
  if (!isJsonObject(value)) {
    throw new Error("snapshots must be an object");
  }

  const snapshots: Record<string, FixtureSnapshot> = {};
  for (const [key, snapshot] of Object.entries(value)) {
    snapshots[key] = parseSnapshot(snapshot, key);
  }

  if (Object.keys(snapshots).length === 0) {
    throw new Error("snapshots must contain at least one snapshot");
  }

  return snapshots;
}

function assertSnapshotReferences(fixture: ReplayFixture): void {
  const selectors: SnapshotSelector[] = [fixture.startup];

  for (const delivery of fixture.deliveries) {
    if (delivery.before !== undefined) {
      selectors.push(delivery.before);
    }
    if (delivery.after !== undefined) {
      selectors.push(delivery.after);
    }
  }

  for (const selector of selectors) {
    const keys = typeof selector === "string" ? [selector] : selector;
    for (const key of keys) {
      if (fixture.snapshots[key] === undefined) {
        throw new Error(`snapshot reference not found: ${key}`);
      }
    }
  }
}

function parseRawDelivery(value: unknown, index: number): RawDelivery {
  const pathLabel = `deliveries[${index}]`;

  if (!isJsonObject(value)) {
    throw new Error(`${pathLabel} must be an object`);
  }

  const hasPayload = hasOwn(value, "payload");
  const hasPayloadPath = hasOwn(value, "payloadPath");

  if (hasPayload === hasPayloadPath) {
    throw new Error(`${pathLabel} must provide exactly one of payload or payloadPath`);
  }

  const id = requireString(value, "id", pathLabel);
  const event = requireString(value, "event", pathLabel);
  const headers = parseHeaders(value["headers"], pathLabel);
  const before = optionalSnapshotSelector(value, "before", pathLabel);
  const after = optionalSnapshotSelector(value, "after", pathLabel);

  if (hasPayload) {
    const payload = value["payload"];
    if (!isJsonObject(payload)) {
      throw new Error(`${pathLabel}.payload must be an object`);
    }
    return { id, event, headers, payload, before, after };
  }

  const payloadPath = requireString(value, "payloadPath", pathLabel);
  return { id, event, headers, payloadPath, before, after };
}

async function resolveDeliveryPayload(delivery: RawDelivery, fixtureDir: string): Promise<FixtureDelivery> {
  if (delivery.payload !== undefined) {
    return {
      id: delivery.id,
      event: delivery.event,
      headers: delivery.headers,
      payload: delivery.payload,
      before: delivery.before,
      after: delivery.after
    };
  }

  if (delivery.payloadPath === undefined) {
    throw new Error(`delivery ${delivery.id} is missing payloadPath`);
  }

  const payload = await readJsonObject(path.resolve(fixtureDir, delivery.payloadPath));
  return {
    id: delivery.id,
    event: delivery.event,
    headers: delivery.headers,
    payload,
    before: delivery.before,
    after: delivery.after
  };
}

async function readJsonObject(filePath: string): Promise<JsonObject> {
  const text = await readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(text);

  if (!isJsonObject(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }

  return parsed;
}

export async function loadReplayFixture(filePath: string): Promise<ReplayFixture> {
  const raw = await readJsonObject(filePath);
  const target = parseTarget(raw["target"]);
  const startup = parseSnapshotSelector(raw["startup"], "startup");
  const snapshots = parseSnapshots(raw["snapshots"]);
  const deliveriesValue = raw["deliveries"];

  if (!Array.isArray(deliveriesValue)) {
    throw new Error("deliveries must be an array");
  }

  const rawDeliveries = deliveriesValue.map((delivery, index) => parseRawDelivery(delivery, index));
  const fixtureDir = path.dirname(filePath);
  const deliveries = await Promise.all(rawDeliveries.map((delivery) => resolveDeliveryPayload(delivery, fixtureDir)));
  const fixture: ReplayFixture = { target, startup, deliveries, snapshots };
  assertSnapshotReferences(fixture);
  return fixture;
}

export class SnapshotSequence {
  readonly #snapshots: Readonly<Record<string, FixtureSnapshot>>;
  readonly #keys: readonly string[];
  #index = 0;

  public constructor(snapshots: Readonly<Record<string, FixtureSnapshot>>, selector: SnapshotSelector) {
    this.#snapshots = snapshots;
    this.#keys = typeof selector === "string" ? [selector] : selector;
  }

  public next(): FixtureSnapshot {
    const key = this.#keys[Math.min(this.#index, this.#keys.length - 1)];

    if (key === undefined) {
      throw new Error("snapshot sequence must contain at least one key");
    }

    const snapshot = this.#snapshots[key];
    if (snapshot === undefined) {
      throw new Error(`snapshot reference not found: ${key}`);
    }

    this.#index += 1;
    return snapshot;
  }
}
