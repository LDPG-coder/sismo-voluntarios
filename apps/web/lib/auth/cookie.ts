/**
 * Signed session cookie helpers.
 * Format: <base64url(json)>.<hmac>
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { authCookieMaxAgeSeconds, sessionSecret } from "./config";
import type { UserRole, UserStatus } from "./role";

const SEPARATOR = ".";

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export type SessionPayload = {
  user_id: string;
  role: UserRole;
  status: UserStatus;
};

function bytesToBase64Url(bytes: Buffer): string {
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Buffer {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

export function encodeSession(
  payload: SessionPayload,
  maxAgeSeconds: number = authCookieMaxAgeSeconds,
): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + maxAgeSeconds;
  // Opaque, unguessable id enabling server-side revocation (logout).
  const jti = randomUUID();
  const json = JSON.stringify({ ...payload, jti, iat: now, exp });
  const encoded = bytesToBase64Url(Buffer.from(json, "utf-8"));
  return `${encoded}${SEPARATOR}${sign(encoded)}`;
}

export type VerifyResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; reason: "missing" | "malformed" | "bad-signature" };

export function decodeSession(value: string | undefined | null): VerifyResult {
  let failReason: string | undefined;
  if (!value) {
    failReason = "missing";
  } else {
    const idx = value.lastIndexOf(SEPARATOR);
    if (idx <= 0 || idx === value.length - 1) {
      failReason = "malformed";
    } else {
      const encoded = value.slice(0, idx);
      const provided = value.slice(idx + 1);
      const expected = sign(encoded);
      if (provided.length !== expected.length) {
        failReason = "bad-signature";
      } else {
        try {
          if (!timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"))) {
            failReason = "bad-signature";
          }
        } catch {
          failReason = "malformed";
        }
      }
      if (!failReason) {
        let json = "";
        try {
          json = base64UrlToBytes(encoded).toString("utf-8");
        } catch {
          failReason = "malformed";
        }
        if (!failReason) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(json);
          } catch {
            failReason = "malformed";
          }
          if (!failReason) {
            if (!parsed || typeof parsed !== "object") {
              failReason = "malformed";
            } else {
              const obj = parsed as Record<string, unknown>;
              const role = obj.role;
              const status = obj.status;
              if (role !== "volunteer" && role !== "admin") {
                failReason = "malformed";
              } else if (
                status !== "pending" &&
                status !== "active" &&
                status !== "suspended"
              ) {
                failReason = "malformed";
              } else {
                const identity =
                  typeof obj.user_id === "string"
                    ? obj.user_id
                    : typeof obj.token === "string"
                      ? obj.token
                      : null;
                if (identity === null) {
                  failReason = "malformed";
                } else {
                  return {
                    ok: true,
                    payload: { user_id: identity, role, status },
                  };
                }
              }
            }
          }
        }
      }
    }
  }
  return { ok: false, reason: (failReason ?? "malformed") as "missing" | "malformed" | "bad-signature" };
}
