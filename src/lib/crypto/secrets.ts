import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * At-rest encryption for secrets (WP app passwords, LLM API keys).
 * Format: enc:v1:<iv_b64>:<tag_b64>:<cipher_b64>
 * Plaintext values (legacy) decrypt as-is for backward compatibility.
 */

const PREFIX = "enc:v1:";

function resolveKey(): Buffer | null {
  const raw =
    process.env.AIEO_ENCRYPTION_KEY?.trim() ||
    process.env.SECRETS_ENCRYPTION_KEY?.trim() ||
    "";

  if (raw) {
    // Accept 64-hex (32 bytes) or any string (hashed to 32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, "hex");
    }
    return createHash("sha256").update(raw).digest();
  }

  // Fallback: derive from service role so existing deploys work without new env.
  // Prefer setting AIEO_ENCRYPTION_KEY in production.
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) {
    return createHash("sha256")
      .update(`aieo-secrets-v1:${service}`)
      .digest();
  }

  return null;
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(PREFIX));
}

/** Encrypt secret for DB storage. Returns plaintext if no key available. */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  if (isEncryptedSecret(plaintext)) return plaintext;

  const key = resolveKey();
  if (!key) {
    console.warn(
      "[secrets] AIEO_ENCRYPTION_KEY missing — storing secret in plaintext"
    );
    return plaintext;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX.slice(0, -1), // "enc:v1"
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/** Decrypt secret from DB. Passes through legacy plaintext. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null || stored === "") return null;
  if (!isEncryptedSecret(stored)) return stored;

  const key = resolveKey();
  if (!key) {
    throw new Error(
      "Secret terenkripsi di DB tetapi AIEO_ENCRYPTION_KEY / service role tidak tersedia"
    );
  }

  // enc:v1:iv:tag:cipher
  const parts = stored.split(":");
  if (parts.length !== 5 || parts[0] !== "enc" || parts[1] !== "v1") {
    throw new Error("Format secret terenkripsi tidak valid");
  }

  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const data = Buffer.from(parts[4], "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

export function encryptionConfigured(): boolean {
  return resolveKey() != null;
}
