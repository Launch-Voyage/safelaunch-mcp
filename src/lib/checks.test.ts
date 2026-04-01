import { describe, it, expect } from "vitest";
import { runAllChecks } from "./checks.js";
import type { CheckResult } from "./checks.js";
import type { RepoFile } from "./local-scanner.js";

function makeFile(path: string, content = ""): RepoFile {
  return { path, content };
}

function getCheck(files: RepoFile[], key: CheckResult["check_key"]) {
  const result = runAllChecks(files).find((r) => r.check_key === key);
  if (!result) throw new Error(`${key} result not found`);
  return result;
}

// ── Stripe key exposed ──────────────────────────────────────

describe("checkStripeKeyExposed", () => {
  it("skips when project has no Stripe usage", () => {
    const files = [makeFile("src/index.ts", "console.log('hello');")];
    expect(getCheck(files, "stripe_key_exposed").status).toBe("skipped");
  });

  it("passes when Stripe is used but no key is exposed", () => {
    const files = [
      makeFile("package.json", '{"dependencies":{"stripe":"^20.0.0"}}'),
      makeFile("src/pay.ts", "import Stripe from 'stripe';\nconst s = new Stripe(process.env.STRIPE_KEY);"),
    ];
    expect(getCheck(files, "stripe_key_exposed").status).toBe("pass");
  });

  it("fails when sk_live_ key is hardcoded", () => {
    const files = [
      makeFile("package.json", '{"dependencies":{"stripe":"^20.0.0"}}'),
      makeFile("src/pay.ts", 'const s = new Stripe("sk_live_12345678901234567890");'),
    ];
    expect(getCheck(files, "stripe_key_exposed").status).toBe("fail");
  });

  it("fails when sk_test_ key is hardcoded", () => {
    const files = [
      makeFile("package.json", '{"dependencies":{"stripe":"^20.0.0"}}'),
      makeFile("src/pay.ts", 'const key = "sk_test_12345678901234567890";'),
    ];
    expect(getCheck(files, "stripe_key_exposed").status).toBe("fail");
  });

  it("fails when rk_live_ key is hardcoded", () => {
    const files = [
      makeFile("package.json", '{"dependencies":{"stripe":"^20.0.0"}}'),
      makeFile("src/pay.ts", 'const key = "rk_live_12345678901234567890";'),
    ];
    expect(getCheck(files, "stripe_key_exposed").status).toBe("fail");
  });

  it("detects Stripe usage from source code even without package.json", () => {
    const files = [
      makeFile("src/pay.ts", "import Stripe from 'stripe';\nconst s = new Stripe(process.env.KEY);"),
    ];
    expect(getCheck(files, "stripe_key_exposed").status).toBe("pass");
  });
});

// ── Webhook no verify ───────────────────────────────────────

describe("checkWebhookNoVerify", () => {
  it("skips when no webhook usage found", () => {
    const files = [makeFile("src/index.ts", "export default {};")];
    expect(getCheck(files, "webhook_no_verify").status).toBe("skipped");
  });

  it("passes when webhook with constructEvent is used", () => {
    const files = [
      makeFile("src/api/webhook.ts", "const event = stripe.webhooks.constructEvent(body, sig, secret);"),
    ];
    expect(getCheck(files, "webhook_no_verify").status).toBe("pass");
  });

  it("passes when webhook with hmac is used", () => {
    const files = [
      makeFile("src/api/webhook.ts", "const hmac = crypto.createHmac('sha256', secret);"),
    ];
    expect(getCheck(files, "webhook_no_verify").status).toBe("pass");
  });

  it("passes when webhook with verify signature is used", () => {
    const files = [
      makeFile("src/api/webhook.ts", "verify_signature(payload, header);"),
    ];
    expect(getCheck(files, "webhook_no_verify").status).toBe("pass");
  });

  it("fails when webhook exists but has no verification", () => {
    const files = [
      makeFile("src/api/webhook.ts", "export default function handler(req) { return req.body; }"),
    ];
    expect(getCheck(files, "webhook_no_verify").status).toBe("fail");
  });

  it("detects webhook usage from file content, not just path", () => {
    const files = [
      makeFile("src/api/handler.ts", "// handle webhook event\nconst data = body.data;"),
    ];
    expect(getCheck(files, "webhook_no_verify").status).toBe("fail");
  });
});

// ── Password plaintext ──────────────────────────────────────

describe("checkPasswordPlaintext", () => {
  it("skips when no password code exists", () => {
    const files = [makeFile("src/index.ts", "console.log('no auth');")];
    expect(getCheck(files, "password_plaintext").status).toBe("skipped");
  });

  it("passes when password code exists but no plaintext patterns match", () => {
    const files = [
      makeFile("src/auth.ts", "const hash = await bcrypt.hash(password, 12);"),
    ];
    expect(getCheck(files, "password_plaintext").status).toBe("pass");
  });

  it("passes when plaintext pattern exists but hash is also used", () => {
    const files = [
      makeFile("src/auth.ts", "password = req.body.password;\nconst hashed = await bcrypt.hash(password, 12);"),
    ];
    expect(getCheck(files, "password_plaintext").status).toBe("pass");
  });

  it("fails when plaintext password pattern exists without hashing", () => {
    const files = [
      makeFile("src/auth.ts", "const password = req.body.password;\ndb.user.create({ password });"),
    ];
    expect(getCheck(files, "password_plaintext").status).toBe("fail");
  });

  it("fails with INSERT INTO plaintext pattern", () => {
    const files = [
      makeFile("src/auth.ts", "INSERT INTO users (password) VALUES (${password});"),
    ];
    expect(getCheck(files, "password_plaintext").status).toBe("fail");
  });
});

// ── No rate limit ───────────────────────────────────────────

describe("checkNoRateLimit", () => {
  it("skips when no auth endpoints exist", () => {
    const files = [makeFile("src/index.ts", "export {};")];
    expect(getCheck(files, "no_rate_limit").status).toBe("skipped");
  });

  it("passes when auth endpoint has rate limiting", () => {
    const files = [
      makeFile("src/api/auth/login/route.ts", "import { rateLimit } from './limiter';\nrateLimit(ip);"),
    ];
    expect(getCheck(files, "no_rate_limit").status).toBe("pass");
  });

  it("passes when auth endpoint returns 429", () => {
    const files = [
      makeFile("src/api/auth/login/route.ts", "return Response.json({}, { status: 429 });"),
    ];
    expect(getCheck(files, "no_rate_limit").status).toBe("pass");
  });

  it("fails when auth endpoint has no rate limiting", () => {
    const files = [
      makeFile("src/api/auth/login/route.ts", "export async function POST(req) { return verify(req); }"),
    ];
    expect(getCheck(files, "no_rate_limit").status).toBe("fail");
  });

  it("detects pages/api auth paths", () => {
    const files = [
      makeFile("pages/api/auth/signin.ts", "export default function handler(req, res) {}"),
    ];
    expect(getCheck(files, "no_rate_limit").status).toBe("fail");
  });
});

// ── Env not gitignored ──────────────────────────────────────

describe("checkEnvNotGitignored", () => {
  it("fails when no .gitignore exists", () => {
    const files = [makeFile("src/index.ts", "console.log('hi')")];
    expect(getCheck(files, "env_not_gitignored").status).toBe("fail");
  });

  it("fails when .gitignore missing .env entry", () => {
    const files = [makeFile(".gitignore", "node_modules\ndist\n")];
    expect(getCheck(files, "env_not_gitignored").status).toBe("fail");
  });

  it("passes when .gitignore has .env entry", () => {
    const files = [makeFile(".gitignore", "node_modules\n.env\n")];
    expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
  });

  it("passes when .gitignore has .env.local entry", () => {
    const files = [makeFile(".gitignore", "node_modules\n.env.local\n")];
    expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
  });

  it("passes when .gitignore has .env* glob", () => {
    const files = [makeFile(".gitignore", "node_modules\n.env*\n")];
    expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
  });

  it("fails when .env file is committed (suspicious)", () => {
    const files = [
      makeFile(".gitignore", ".env\n"),
      makeFile(".env", "SECRET=123"),
    ];
    expect(getCheck(files, "env_not_gitignored").status).toBe("fail");
  });

  it("passes when .env.example is committed", () => {
    const files = [
      makeFile(".gitignore", ".env\n"),
      makeFile(".env.example", "SECRET=changeme"),
    ];
    expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
  });

  it("includes evidence when .gitignore is missing", () => {
    const files = [makeFile("src/index.ts", "")];
    const result = getCheck(files, "env_not_gitignored");
    expect(result.evidence?.reason).toBe("missing_gitignore");
  });

  it("includes evidence when .env rules are missing", () => {
    const files = [makeFile(".gitignore", "node_modules\n")];
    const result = getCheck(files, "env_not_gitignored");
    expect(result.evidence?.reason).toBe("missing_env_ignore_rules");
  });
});

// ── API key hardcoded ───────────────────────────────────────

describe("checkApiKeyHardcoded", () => {
  it("passes when no hardcoded keys exist", () => {
    const files = [
      makeFile("src/index.ts", "const key = process.env.API_KEY;"),
    ];
    expect(getCheck(files, "api_key_hardcoded").status).toBe("pass");
  });

  it("fails when AWS key is hardcoded", () => {
    const files = [
      makeFile("src/aws.ts", 'const key = "AKIAIOSFODNN7EXAMPLE";'),
    ];
    expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
  });

  it("fails when OpenAI key is hardcoded", () => {
    const files = [
      makeFile("src/ai.ts", 'const key = "sk-abcdefghijklmnopqrstuvwxyz012345";'),
    ];
    expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
  });

  it("fails when GitHub PAT is hardcoded", () => {
    const files = [
      makeFile("src/github.ts", 'const token = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";'),
    ];
    expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
  });

  it("fails when generic api_key is hardcoded", () => {
    const files = [
      makeFile("src/client.ts", 'const api_key = "abcdefghijklmnopqrstuvwxyz";'),
    ];
    expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
  });

  it("ignores keys in test files", () => {
    const files = [
      makeFile("src/__tests__/client.test.ts", 'const api_key = "abcdefghijklmnopqrstuvwxyz";'),
    ];
    expect(getCheck(files, "api_key_hardcoded").status).toBe("pass");
  });

  it("ignores keys in .example files", () => {
    const files = [
      makeFile("src/config.example.ts", 'const api_key = "abcdefghijklmnopqrstuvwxyz";'),
    ];
    expect(getCheck(files, "api_key_hardcoded").status).toBe("pass");
  });
});

// ── No HTTPS ────────────────────────────────────────────────

describe("checkNoHttps", () => {
  it("passes when vercel.json exists", () => {
    const files = [
      makeFile("vercel.json", "{}"),
      makeFile("src/index.ts", "export {};"),
    ];
    expect(getCheck(files, "no_https").status).toBe("pass");
  });

  it("passes when netlify.toml exists", () => {
    const files = [
      makeFile("netlify.toml", "[build]\ncommand = 'npm run build'"),
      makeFile("src/index.ts", "export {};"),
    ];
    expect(getCheck(files, "no_https").status).toBe("pass");
  });

  it("passes when package.json references vercel", () => {
    const files = [
      makeFile("package.json", '{"scripts":{"deploy":"vercel"}}'),
      makeFile("src/index.ts", "export {};"),
    ];
    expect(getCheck(files, "no_https").status).toBe("pass");
  });

  it("passes when strict-transport-security header is set", () => {
    const files = [
      makeFile("src/server.ts", 'res.setHeader("Strict-Transport-Security", "max-age=31536000");'),
    ];
    expect(getCheck(files, "no_https").status).toBe("pass");
  });

  it("passes when no insecure http:// URLs exist", () => {
    const files = [
      makeFile("src/index.ts", "const url = 'https://myapp.com';"),
    ];
    expect(getCheck(files, "no_https").status).toBe("pass");
  });

  it("fails when insecure http:// URL is used in code", () => {
    const files = [
      makeFile("src/api.ts", 'const url = "http://my-production-api.com/data";'),
    ];
    expect(getCheck(files, "no_https").status).toBe("fail");
  });

  it("ignores http://localhost", () => {
    const files = [
      makeFile("src/dev.ts", 'const url = "http://localhost:3000";'),
    ];
    expect(getCheck(files, "no_https").status).toBe("pass");
  });

  it("ignores http:// in comments", () => {
    const files = [
      makeFile("src/index.ts", "// http://my-insecure-site.com"),
    ];
    expect(getCheck(files, "no_https").status).toBe("pass");
  });
});

// ── No privacy policy ───────────────────────────────────────

describe("checkNoPrivacyPolicy", () => {
  it("passes when privacy page file exists", () => {
    const files = [
      makeFile("src/app/privacy/page.tsx", "export default function Privacy() {}"),
    ];
    expect(getCheck(files, "no_privacy_policy").status).toBe("pass");
  });

  it("passes when privacy link exists in content", () => {
    const files = [
      makeFile("src/footer.tsx", '<a href="/privacy">Privacy Policy</a>'),
    ];
    expect(getCheck(files, "no_privacy_policy").status).toBe("pass");
  });

  it("passes when 'privacy policy' text exists in content", () => {
    const files = [
      makeFile("src/terms.ts", "We have a Privacy Policy that covers data collection."),
    ];
    expect(getCheck(files, "no_privacy_policy").status).toBe("pass");
  });

  it("fails when no privacy references found", () => {
    const files = [
      makeFile("src/index.ts", "export {};"),
      makeFile("src/about.tsx", "<h1>About Us</h1>"),
    ];
    expect(getCheck(files, "no_privacy_policy").status).toBe("fail");
  });
});

// ── runAllChecks ─────────────────────────────────────────────

describe("runAllChecks", () => {
  it("returns exactly 8 check results", () => {
    const files = [makeFile("src/index.ts", "export {};")];
    const results = runAllChecks(files);
    expect(results).toHaveLength(8);
  });

  it("returns all expected check_keys", () => {
    const files = [makeFile("src/index.ts", "export {};")];
    const keys = runAllChecks(files).map((r) => r.check_key);
    expect(keys).toEqual([
      "stripe_key_exposed",
      "webhook_no_verify",
      "password_plaintext",
      "no_rate_limit",
      "env_not_gitignored",
      "api_key_hardcoded",
      "no_https",
      "no_privacy_policy",
    ]);
  });

  it("every result has a valid status", () => {
    const files = [makeFile("src/index.ts", "")];
    const results = runAllChecks(files);
    for (const r of results) {
      expect(["pass", "fail", "skipped"]).toContain(r.status);
    }
  });
});
