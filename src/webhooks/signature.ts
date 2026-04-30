import { createHmac, timingSafeEqual } from "node:crypto";

export function signPayload(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifySignature(secret: string, body: string, signature: string | undefined): boolean {
  if (signature === undefined || !signature.startsWith("sha256=")) {
    return false;
  }

  const expected = signPayload(secret, body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
