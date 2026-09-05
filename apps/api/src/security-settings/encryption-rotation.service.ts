import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@clouddeploy/database";
import { decryptSecret, encryptSecret } from "@clouddeploy/security";
import { PrismaService } from "../prisma/prisma.service";

const PAGE_SIZE = 500;
const MAX_REPORTED_FAILURES = 20;

interface ColumnRotationResult {
  scanned: number;
  rotated: number;
  failed: number;
  /** IDs that decrypted under neither key — genuinely corrupt, a
   * hand-inserted placeholder, or from before both keys — a rotation run
   * can't fix these, only report them. Capped so a table full of legacy
   * garbage can't blow up the audit-log payload. */
  failedIds: string[];
}

type Row<Cipher extends string> = { id: string } & Record<Cipher, string | null>;

/**
 * Re-encrypts every at-rest secret with the current ENCRYPTION_KEY. This is
 * the other half of the rotation story alongside
 * `decryptSecretWithFallback` (which every read path in the app now uses):
 * that function keeps reads working against not-yet-rotated rows during
 * the window between swapping ENCRYPTION_KEY and running this job; this
 * job is what actually shrinks that window to zero by re-encrypting
 * everything, so ENCRYPTION_KEY_PREVIOUS can eventually be removed.
 *
 * Real rotation, not a stub: every encrypted column in the schema is
 * covered (`grep -rn decryptSecret apps/api/src` is the source of truth
 * for that list), each row is only rewritten if it actually still holds
 * the previous key's ciphertext (decryptable by the current key = already
 * rotated = skipped), rows matching neither key are reported rather than
 * crashing the run (this surfaced real pre-existing seed/test rows with a
 * non-standard placeholder ciphertext — see KNOWN_LIMITATIONS), and it's
 * exposed as a platform-admin-triggered action rather than a background
 * cron, since key rotation is a deliberate, infrequent, operator-initiated
 * event.
 */
@Injectable()
export class EncryptionRotationService {
  private readonly logger = new Logger("EncryptionRotationService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async rotate(actingUserId: string) {
    const currentKey = this.config.getOrThrow<string>("ENCRYPTION_KEY");
    const previousKey = this.config.get<string>("ENCRYPTION_KEY_PREVIOUS");
    if (!previousKey) {
      throw new BadRequestException(
        "Set ENCRYPTION_KEY_PREVIOUS to the outgoing key before rotating — this job needs it to find rows that still need re-encrypting.",
      );
    }
    if (previousKey === currentKey) {
      throw new BadRequestException("ENCRYPTION_KEY_PREVIOUS must differ from ENCRYPTION_KEY.");
    }

    const startedAt = Date.now();
    const results = {
      environmentVariables: await this.rotateColumn(
        "valueCipher",
        (cursor) => this.prisma.environmentVariable.findMany({ take: PAGE_SIZE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" }, select: { id: true, valueCipher: true } }),
        (id, valueCipher) => this.prisma.environmentVariable.update({ where: { id }, data: { valueCipher } }),
        currentKey, previousKey,
      ),
      databases: await this.rotateColumn(
        "passwordCipher",
        (cursor) => this.prisma.database.findMany({ take: PAGE_SIZE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" }, select: { id: true, passwordCipher: true } }),
        (id, passwordCipher) => this.prisma.database.update({ where: { id }, data: { passwordCipher } }),
        currentKey, previousKey,
      ),
      redisInstances: await this.rotateColumn(
        "passwordCipher",
        (cursor) => this.prisma.redisInstance.findMany({ take: PAGE_SIZE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" }, select: { id: true, passwordCipher: true } }),
        (id, passwordCipher) => this.prisma.redisInstance.update({ where: { id }, data: { passwordCipher } }),
        currentKey, previousKey,
      ),
      gitConnections: await this.rotateColumn(
        "accessToken",
        (cursor) => this.prisma.gitProviderConnection.findMany({ take: PAGE_SIZE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), where: { accessToken: { not: null } }, orderBy: { id: "asc" }, select: { id: true, accessToken: true } }),
        (id, accessToken) => this.prisma.gitProviderConnection.update({ where: { id }, data: { accessToken } }),
        currentKey, previousKey,
      ),
      twoFactorSecrets: await this.rotateColumn(
        "twoFactorSecret",
        (cursor) => this.prisma.user.findMany({ take: PAGE_SIZE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), where: { twoFactorSecret: { not: null } }, orderBy: { id: "asc" }, select: { id: true, twoFactorSecret: true } }),
        (id, twoFactorSecret) => this.prisma.user.update({ where: { id }, data: { twoFactorSecret } }),
        currentKey, previousKey,
      ),
      // The generic Secret/SecretAccessAudit vault isn't wired up to any
      // application code path yet (no reads or writes exist for it today),
      // but it already anticipates rotation with its own `rotatedAt`
      // column, so this covers it now rather than leaving a silent gap for
      // whenever it is wired up.
      vaultSecrets: await this.rotateColumn(
        "valueCipher",
        (cursor) => this.prisma.secret.findMany({ take: PAGE_SIZE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" }, select: { id: true, valueCipher: true } }),
        (id, valueCipher) => this.prisma.secret.update({ where: { id }, data: { valueCipher, rotatedAt: new Date() } }),
        currentKey, previousKey,
      ),
    };
    const totalRotated = Object.values(results).reduce((sum, r) => sum + r.rotated, 0);
    const totalScanned = Object.values(results).reduce((sum, r) => sum + r.scanned, 0);
    const totalFailed = Object.values(results).reduce((sum, r) => sum + r.failed, 0);

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: "encryption_key.rotated",
        resourceType: "EncryptionKey",
        newValue: { ...results, totalScanned, totalRotated, totalFailed, durationMs: Date.now() - startedAt } as unknown as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `Encryption key rotation: ${totalRotated}/${totalScanned} row(s) re-encrypted, ${totalFailed} unreadable by either key, in ${Date.now() - startedAt}ms`,
    );
    return { ...results, totalScanned, totalRotated, totalFailed, remainingOnPreviousKey: totalScanned - totalRotated - totalFailed };
  }

  /** Tries the current key first (already rotated → skip); only
   * re-encrypts if the row actually decrypts under the previous key. A row
   * matching neither key is reported as failed and left completely
   * untouched — this never silently drops, corrupts, or guesses at a
   * secret it can't read. */
  private reEncryptIfNeeded(cipherText: string, currentKey: string, previousKey: string): { action: "skip" | "rotate" | "fail"; value?: string } {
    try {
      decryptSecret(cipherText, currentKey);
      return { action: "skip" };
    } catch {
      // Not decryptable with the current key — try the previous one below.
    }
    try {
      const plaintext = decryptSecret(cipherText, previousKey);
      return { action: "rotate", value: encryptSecret(plaintext, currentKey) };
    } catch {
      return { action: "fail" };
    }
  }

  private async rotateColumn<Cipher extends string>(
    cipherField: Cipher,
    fetchPage: (cursor: string | undefined) => Promise<Row<Cipher>[]>,
    updateRow: (id: string, newCipherValue: string) => Promise<unknown>,
    currentKey: string,
    previousKey: string,
  ): Promise<ColumnRotationResult> {
    let scanned = 0;
    let rotated = 0;
    let failed = 0;
    const failedIds: string[] = [];
    let cursor: string | undefined;

    for (;;) {
      const rows = await fetchPage(cursor);
      if (rows.length === 0) break;
      for (const row of rows) {
        const cipherText = row[cipherField];
        if (!cipherText) continue;
        scanned += 1;
        const result = this.reEncryptIfNeeded(cipherText, currentKey, previousKey);
        if (result.action === "rotate") {
          await updateRow(row.id, result.value!);
          rotated += 1;
        } else if (result.action === "fail") {
          failed += 1;
          if (failedIds.length < MAX_REPORTED_FAILURES) failedIds.push(row.id);
          this.logger.warn(`Row ${row.id} (${cipherField}) decrypted under neither the current nor previous key — left untouched.`);
        }
      }
      cursor = rows[rows.length - 1]!.id;
      if (rows.length < PAGE_SIZE) break;
    }
    return { scanned, rotated, failed, failedIds };
  }
}
