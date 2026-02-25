import type { RepoFile } from "./local-scanner.js";

export interface CheckResult {
  check_key: string;
  category: "payment" | "auth" | "secrets" | "infra" | "legal";
  status: "pass" | "fail";
  severity: "critical" | "warning";
}

type CheckFn = (files: RepoFile[]) => CheckResult;

function isEnvFile(path: string): boolean {
  const name = path.split("/").pop() || "";
  return name.startsWith(".env");
}

function isSourceFile(file: RepoFile): boolean {
  const ext = file.path.split(".").pop()?.toLowerCase();
  return (
    !isEnvFile(file.path) &&
    ["js", "ts", "tsx", "jsx", "mjs", "cjs", "py", "rb", "go"].includes(
      ext || ""
    )
  );
}

function getSourceFiles(files: RepoFile[]): RepoFile[] {
  return files.filter(isSourceFile);
}

function anyFileMatches(files: RepoFile[], pattern: RegExp): boolean {
  return files.some((f) => pattern.test(f.content));
}

function allContent(files: RepoFile[]): string {
  return files.map((f) => f.content).join("\n");
}

const checkStripeKeyExposed: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "stripe_key_exposed",
    category: "payment",
    status: "pass",
    severity: "critical",
  };
  const pattern = /(?:sk_live_|sk_test_|rk_live_|rk_test_)[a-zA-Z0-9]{20,}/;
  const sourceFiles = getSourceFiles(files);
  if (anyFileMatches(sourceFiles, pattern)) {
    result.status = "fail";
  }
  return result;
};

const checkWebhookNoVerify: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "webhook_no_verify",
    category: "payment",
    status: "pass",
    severity: "warning",
  };
  const sourceFiles = getSourceFiles(files);
  const webhookPattern = /webhook/i;
  const hasWebhook =
    sourceFiles.some((f) => webhookPattern.test(f.path)) ||
    anyFileMatches(sourceFiles, webhookPattern);
  if (!hasWebhook) return result;
  const verifyPatterns = [
    /constructEvent/,
    /verify.*signature/i,
    /timingSafeEqual/,
    /svix/i,
    /hmac/i,
    /webhook.*secret/i,
  ];
  const content = allContent(sourceFiles);
  const hasVerify = verifyPatterns.some((p) => p.test(content));
  if (!hasVerify) {
    result.status = "fail";
  }
  return result;
};

const checkPasswordPlaintext: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "password_plaintext",
    category: "auth",
    status: "pass",
    severity: "critical",
  };
  const sourceFiles = getSourceFiles(files);
  const content = allContent(sourceFiles);
  const plaintextPatterns = [
    /password\s*[:=]\s*(?:req|request|body|input|data|params)\./i,
    /\.create\([^)]*password:\s*(?:req|request|body|input|data|params)\./i,
    /INSERT.*password.*VALUES.*\$\{/i,
    /password\s*=\s*(?:req|request|body|input)\./i,
  ];
  const hashPatterns = [
    /bcrypt/i,
    /argon2/i,
    /scrypt/i,
    /pbkdf2/i,
    /hashPassword/i,
    /hash\s*\(/,
    /createHash/,
  ];
  const hasPlaintext = plaintextPatterns.some((p) => p.test(content));
  if (!hasPlaintext) return result;
  const hasHash = hashPatterns.some((p) => p.test(content));
  if (!hasHash) {
    result.status = "fail";
  }
  return result;
};

const checkNoRateLimit: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "no_rate_limit",
    category: "auth",
    status: "pass",
    severity: "warning",
  };
  const authRoutePattern =
    /\/(api|pages\/api)\/.*(login|signin|sign-in|auth|register|signup)/i;
  const hasAuthEndpoint = files.some((f) => authRoutePattern.test(f.path));
  if (!hasAuthEndpoint) return result;
  const content = allContent(getSourceFiles(files));
  const rateLimitPatterns = [
    /ratelimit/i,
    /rate[_-]?limit/i,
    /throttle/i,
    /RateLimiter/i,
    /upstash.*ratelimit/i,
    /status:\s*429/,
    /too.many.requests/i,
    /rate.limited/i,
  ];
  const hasRateLimit = rateLimitPatterns.some((p) => p.test(content));
  if (!hasRateLimit) {
    result.status = "fail";
  }
  return result;
};

const checkEnvNotGitignored: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "env_not_gitignored",
    category: "secrets",
    status: "pass",
    severity: "critical",
  };
  const gitignore = files.find((f) => f.path === ".gitignore");
  if (!gitignore) {
    result.status = "fail";
    return result;
  }
  const envPatterns = [/^\.env$/m, /^\.env\.local$/m, /^\.env\*$/m, /^\.env\.\*$/m];
  const hasEnvRule = envPatterns.some((p) => p.test(gitignore.content));
  if (!hasEnvRule) {
    result.status = "fail";
    return result;
  }
  const committedEnv = files.some(
    (f) =>
      isEnvFile(f.path) &&
      !f.path.includes(".example") &&
      !f.path.includes(".sample") &&
      f.path !== ".gitignore"
  );
  if (committedEnv) {
    result.status = "fail";
  }
  return result;
};

const checkApiKeyHardcoded: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "api_key_hardcoded",
    category: "secrets",
    status: "pass",
    severity: "critical",
  };
  const sourceFiles = files.filter(
    (f) =>
      isSourceFile(f) &&
      !f.path.includes(".example") &&
      !f.path.includes(".test.") &&
      !f.path.includes(".spec.") &&
      !f.path.includes("__test__") &&
      !f.path.includes("__tests__")
  );
  const patterns = [
    /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*["'][a-zA-Z0-9_\-]{20,}["']/i,
    /AKIA[0-9A-Z]{16}/,
    /sk-[a-zA-Z0-9]{32,}/,
    /SG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /glpat-[a-zA-Z0-9\-_]{20}/,
    /re_[a-zA-Z0-9]{20,}/,
  ];
  for (const file of sourceFiles) {
    for (const pattern of patterns) {
      if (pattern.test(file.content)) {
        result.status = "fail";
        return result;
      }
    }
  }
  return result;
};

const checkNoHttps: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "no_https",
    category: "infra",
    status: "pass",
    severity: "warning",
  };
  const hasVercel = files.some((f) => f.path === "vercel.json");
  const hasNetlify = files.some((f) => f.path === "netlify.toml");
  const pkgJson = files.find((f) => f.path === "package.json");
  if (hasVercel || hasNetlify) return result;
  if (pkgJson) {
    const content = pkgJson.content;
    if (
      /vercel|netlify|railway/i.test(content) &&
      (/"scripts"/.test(content) || /"dependencies"/.test(content))
    ) {
      return result;
    }
  }
  const content = allContent(getSourceFiles(files));
  if (/strict-transport-security/i.test(content)) return result;
  const insecurePattern =
    /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|::1)[a-zA-Z]/;
  if (insecurePattern.test(content)) {
    result.status = "fail";
  }
  return result;
};

const checkNoPrivacyPolicy: CheckFn = (files) => {
  const result: CheckResult = {
    check_key: "no_privacy_policy",
    category: "legal",
    status: "pass",
    severity: "warning",
  };
  const hasPrivacyFile = files.some((f) => /privacy/i.test(f.path));
  if (hasPrivacyFile) return result;
  const content = allContent(files);
  if (/(?:href|to)=["'][^"']*privacy/i.test(content)) return result;
  if (/privacy\s*policy/i.test(content)) return result;
  result.status = "fail";
  return result;
};

const ALL_CHECKS: CheckFn[] = [
  checkStripeKeyExposed,
  checkWebhookNoVerify,
  checkPasswordPlaintext,
  checkNoRateLimit,
  checkEnvNotGitignored,
  checkApiKeyHardcoded,
  checkNoHttps,
  checkNoPrivacyPolicy,
];

export function runAllChecks(files: RepoFile[]): CheckResult[] {
  return ALL_CHECKS.map((check) => check(files));
}
