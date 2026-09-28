import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/**
 * Password hashing with scrypt (memory-hard, in Node core — no native deps).
 * Format: scrypt$N$r$p$salt$hash (all hex).
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
  })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, nStr, rStr, pStr, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
    const derived = (await scryptAsync(
      password.normalize("NFKC"),
      Buffer.from(saltHex, "hex"),
      Buffer.from(hashHex, "hex").length,
      { N: parseInt(nStr!), r: parseInt(rStr!), p: parseInt(pStr!) },
    )) as Buffer;
    const expected = Buffer.from(hashHex, "hex");
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** URL-safe random token (sessions, verification, reset). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** One-time codes (email verification / password reset) hashed for storage. */
export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateCode(): string {
  // 6-digit numeric code
  return String(Math.floor(100000 + Math.random() * 900000));
}
