import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

/**
 * Symmetric encryption for at-rest secrets: environment variable values,
 * database credentials, OAuth tokens. Encrypted values are stored as
 * `encv1:<iv>:<authTag>:<ciphertext>` (base64 segments, colon-delimited) so
 * ciphertext is self-describing and can be rotated to a new algorithm/
 * version later. The version tag itself must not contain a colon, since
 * decryption splits the whole payload on ":".
 *
 * The key is derived from ENCRYPTION_KEY (32+ chars) via SHA-256, never
 * stored alongside the ciphertext, and never logged.
 */
const VERSION_TAG = "encv1";

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string, encryptionKey: string): string {
  const key = deriveKey(encryptionKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION_TAG,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(encoded: string, encryptionKey: string): string {
  const [tag, ivB64, authTagB64, ciphertextB64] = encoded.split(":");
  if (tag !== VERSION_TAG || !ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted secret payload");
  }
  const key = deriveKey(encryptionKey);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Decrypts with `primaryKey`, falling back to `previousKey` if that fails
 * (a wrong-key attempt fails the GCM auth-tag check, not a generic parse
 * error, so this only ever falls through on an actual key mismatch).
 * During an encryption-key rotation, ENCRYPTION_KEY_PREVIOUS holds the
 * outgoing key so every read keeps working on rows the rotation job
 * hasn't re-encrypted yet — without this, swapping ENCRYPTION_KEY would
 * make every not-yet-rotated row undecryptable until the job finished. */
export function decryptSecretWithFallback(encoded: string, primaryKey: string, previousKey?: string): string {
  try {
    return decryptSecret(encoded, primaryKey);
  } catch (err) {
    if (!previousKey) throw err;
    return decryptSecret(encoded, previousKey);
  }
}

/** Masks a secret value for display, e.g. in the environment variables table. */
export function maskSecret(value: string): string {
  return "•".repeat(Math.min(value.length, 12));
}

export function generateApiKey(): { prefix: string; secret: string; full: string } {
  const prefix = `cd_${crypto.randomBytes(4).toString("hex")}`;
  const secret = crypto.randomBytes(24).toString("base64url");
  return { prefix, secret, full: `${prefix}_${secret}` };
}

export function hashApiKey(fullKey: string): string {
  return crypto.createHash("sha256").update(fullKey).digest("hex");
}
