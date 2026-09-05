import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(crypto.randomBytes(bytes));
}

export function generateTotp(secret: string, at = Date.now(), stepSeconds = 30, digits = 6): string {
  const counter = Math.floor(at / 1000 / stepSeconds);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = ((digest[offset]! & 0x7f) << 24) | ((digest[offset + 1]! & 0xff) << 16) | ((digest[offset + 2]! & 0xff) << 8) | (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export function verifyTotp(secret: string, token: string, at = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  return Array.from({ length: window * 2 + 1 }, (_, index) => index - window).some((offset) => {
    const candidate = generateTotp(secret, at + offset * 30_000);
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
  });
}

function base32Encode(input: Buffer): string {
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let index = 0; index < bits.length; index += 5) result += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return result;
}

function base32Decode(input: string): Buffer {
  let bits = "";
  for (const char of input.replace(/=+$/g, "").toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value < 0) throw new Error("Invalid base32 secret");
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}
