import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/** Minimum complexity gate enforced on signup and password reset. */
export function isPasswordStrongEnough(plainText: string): boolean {
  return (
    plainText.length >= 8 &&
    /[a-z]/.test(plainText) &&
    /[A-Z]/.test(plainText) &&
    /[0-9]/.test(plainText)
  );
}
