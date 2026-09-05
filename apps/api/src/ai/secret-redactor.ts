const SENSITIVE_PATH = /(^|\/)(\.env($|\.)|id_rsa|id_ed25519|credentials|secrets?\.|.*\.(pem|key|p12|pfx)$)/i;
const SENSITIVE_KEY = /(?:password|passwd|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret|authorization|cookie)/i;

export interface RedactionResult {
  value: string;
  redactedCount: number;
}

export function isSensitiveRepositoryPath(path: string): boolean {
  return SENSITIVE_PATH.test(path.replace(/\\/g, "/"));
}

/** Removes values while retaining enough surrounding syntax for diagnosis.
 * The returned text is the only form allowed to leave the process or be
 * persisted as AI input metadata. */
export function redactSecrets(input: string): RedactionResult {
  let redactedCount = 0;
  const replace = (match: string, prefix: string) => {
    redactedCount += 1;
    return `${prefix}[REDACTED]`;
  };

  let value = input
    .replace(new RegExp(`(^|\\n)(\\s*[A-Za-z0-9_.-]*${SENSITIVE_KEY.source}[A-Za-z0-9_.-]*\\s*[=:]\\s*)[^\\n]+`, "gi"), (_m, lead, prefix) => {
      redactedCount += 1;
      return `${lead}${prefix}[REDACTED]`;
    })
    .replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s/]+@/gi, replace)
    .replace(/(mysql:\/\/[^:\s/@]+:)[^@\s/]+@/gi, replace)
    .replace(/(redis(?:s)?:\/\/[^:\s/@]*:?)[^@\s/]+@/gi, replace)
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, replace)
    .replace(/\b(?:gh[opusr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g, () => {
      redactedCount += 1;
      return "[REDACTED]";
    });

  // JWTs and long base64-ish tokens often appear without a key label.
  value = value.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, () => {
    redactedCount += 1;
    return "[REDACTED_JWT]";
  });

  // AWS access key IDs are commonly assigned to unlabeled variables (`key`,
  // `id`, ...) that the label-based rule above has no reason to flag, so
  // they need their own fixed-prefix pattern — the AWS-defined prefixes are
  // specific enough that this carries negligible false-positive risk.
  value = value.replace(/\b(?:AKIA|ASIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|APKA)[A-Z0-9]{16}\b/g, () => {
    redactedCount += 1;
    return "[REDACTED_AWS_KEY]";
  });

  // PEM-encoded private key blocks carry no "key: value" shape at all — the
  // label-based rule can't see them — and leaking one is catastrophic
  // enough to warrant a dedicated multi-line pattern.
  value = value.replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, () => {
    redactedCount += 1;
    return "[REDACTED_PRIVATE_KEY]";
  });

  return { value, redactedCount };
}
