import { describe, it, expect } from "vitest";
import { runAllChecks, type CheckResult } from "./checks.js";
import type { RepoFile } from "./local-scanner.js";

/** Helper: run all checks and return result for a specific check_key */
function getCheck(files: RepoFile[], key: string): CheckResult {
  const results = runAllChecks(files);
  const found = results.find((r) => r.check_key === key);
  if (!found) throw new Error(`Check "${key}" not found in results`);
  return found;
}

describe("checks", () => {
  // ─── stripe_key_exposed ──────────────────────────────
  describe("stripe_key_exposed", () => {
    it("fails when sk_live_ key is in source code", () => {
      const files: RepoFile[] = [
        {
          path: "src/payments.ts",
          content: `const stripe = new Stripe("sk_live_abcdefghijklmnopqrstuvwx");`,
        },
      ];
      expect(getCheck(files, "stripe_key_exposed").status).toBe("fail");
    });

    it("fails when sk_test_ key is in source code", () => {
      const files: RepoFile[] = [
        {
          path: "src/payments.ts",
          content: `const stripe = new Stripe("sk_test_abcdefghijklmnopqrstuvwx");`,
        },
      ];
      expect(getCheck(files, "stripe_key_exposed").status).toBe("fail");
    });

    it("passes when no stripe keys in source", () => {
      const files: RepoFile[] = [
        {
          path: "src/payments.ts",
          content: `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);`,
        },
      ];
      expect(getCheck(files, "stripe_key_exposed").status).toBe("pass");
    });

    it("ignores stripe keys in .env files (not source)", () => {
      const files: RepoFile[] = [
        {
          path: ".env.local",
          content: `STRIPE_KEY=sk_live_abcdefghijklmnopqrstuvwx`,
        },
      ];
      expect(getCheck(files, "stripe_key_exposed").status).toBe("pass");
    });

    it("has critical severity", () => {
      const files: RepoFile[] = [{ path: "index.ts", content: "" }];
      expect(getCheck(files, "stripe_key_exposed").severity).toBe("critical");
    });
  });

  // ─── api_key_hardcoded ───────────────────────────────
  describe("api_key_hardcoded", () => {
    it("fails when AWS access key is hardcoded", () => {
      const files: RepoFile[] = [
        {
          path: "src/config.ts",
          content: `const key = "AKIAIOSFODNN7EXAMPLE";`,
        },
      ];
      expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
    });

    it("fails when OpenAI key is hardcoded", () => {
      const files: RepoFile[] = [
        {
          path: "src/ai.ts",
          content: `const key = "sk-abcdefghijklmnopqrstuvwxyz123456";`,
        },
      ];
      expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
    });

    it("fails when generic API key is hardcoded", () => {
      const files: RepoFile[] = [
        {
          path: "src/config.ts",
          content: `const api_key = "abcdefghijklmnopqrstuvwxyz";`,
        },
      ];
      expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
    });

    it("fails when GitHub PAT is hardcoded", () => {
      const files: RepoFile[] = [
        {
          path: "src/github.ts",
          content: `const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";`,
        },
      ];
      expect(getCheck(files, "api_key_hardcoded").status).toBe("fail");
    });

    it("passes when keys are from env vars", () => {
      const files: RepoFile[] = [
        {
          path: "src/config.ts",
          content: `const key = process.env.API_KEY;`,
        },
      ];
      expect(getCheck(files, "api_key_hardcoded").status).toBe("pass");
    });

    it("ignores test files", () => {
      const files: RepoFile[] = [
        {
          path: "src/config.test.ts",
          content: `const key = "AKIAIOSFODNN7EXAMPLE";`,
        },
      ];
      expect(getCheck(files, "api_key_hardcoded").status).toBe("pass");
    });

    it("ignores .example files", () => {
      const files: RepoFile[] = [
        {
          path: "src/config.example.ts",
          content: `const api_key = "abcdefghijklmnopqrstuvwxyz";`,
        },
      ];
      expect(getCheck(files, "api_key_hardcoded").status).toBe("pass");
    });
  });

  // ─── env_not_gitignored ──────────────────────────────
  describe("env_not_gitignored", () => {
    it("fails when no .gitignore exists", () => {
      const files: RepoFile[] = [
        { path: "src/index.ts", content: "console.log('hi')" },
      ];
      expect(getCheck(files, "env_not_gitignored").status).toBe("fail");
    });

    it("fails when .gitignore missing .env entry", () => {
      const files: RepoFile[] = [
        { path: ".gitignore", content: "node_modules\ndist\n" },
      ];
      expect(getCheck(files, "env_not_gitignored").status).toBe("fail");
    });

    it("passes when .gitignore has .env entry", () => {
      const files: RepoFile[] = [
        { path: ".gitignore", content: "node_modules\n.env\n" },
      ];
      expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
    });

    it("passes when .gitignore has .env.local entry", () => {
      const files: RepoFile[] = [
        { path: ".gitignore", content: "node_modules\n.env.local\n" },
      ];
      expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
    });

    it("passes when .gitignore has .env* glob", () => {
      const files: RepoFile[] = [
        { path: ".gitignore", content: "node_modules\n.env*\n" },
      ];
      expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
    });

    it("fails when .env file is committed (non-example)", () => {
      const files: RepoFile[] = [
        { path: ".gitignore", content: ".env\n" },
        { path: ".env", content: "SECRET=123" },
      ];
      expect(getCheck(files, "env_not_gitignored").status).toBe("fail");
    });

    it("passes when .env.example is committed", () => {
      const files: RepoFile[] = [
        { path: ".gitignore", content: ".env\n" },
        { path: ".env.example", content: "SECRET=changeme" },
      ];
      expect(getCheck(files, "env_not_gitignored").status).toBe("pass");
    });
  });

  // ─── webhook_no_verify ───────────────────────────────
  describe("webhook_no_verify", () => {
    it("passes when no webhook code exists", () => {
      const files: RepoFile[] = [
        { path: "src/index.ts", content: "console.log('hello')" },
      ];
      expect(getCheck(files, "webhook_no_verify").status).toBe("pass");
    });

    it("fails when webhook exists without verification", () => {
      const files: RepoFile[] = [
        {
          path: "src/api/webhook.ts",
          content: `export default function handler(req, res) {
            const event = req.body;
            processEvent(event);
          }`,
        },
      ];
      expect(getCheck(files, "webhook_no_verify").status).toBe("fail");
    });

    it("passes when webhook uses constructEvent", () => {
      const files: RepoFile[] = [
        {
          path: "src/api/webhook.ts",
          content: `const event = stripe.webhooks.constructEvent(body, sig, secret);`,
        },
      ];
      expect(getCheck(files, "webhook_no_verify").status).toBe("pass");
    });

    it("passes when webhook uses HMAC verification", () => {
      const files: RepoFile[] = [
        {
          path: "src/webhook.ts",
          content: `import { createHmac } from 'crypto';
          const webhook = true;
          const hmac = createHmac('sha256', secret);`,
        },
      ];
      expect(getCheck(files, "webhook_no_verify").status).toBe("pass");
    });
  });

  // ─── password_plaintext ──────────────────────────────
  describe("password_plaintext", () => {
    it("passes when no password handling exists", () => {
      const files: RepoFile[] = [
        { path: "src/index.ts", content: "console.log('hello')" },
      ];
      expect(getCheck(files, "password_plaintext").status).toBe("pass");
    });

    it("fails when password is stored from request without hashing", () => {
      const files: RepoFile[] = [
        {
          path: "src/auth.ts",
          content: `const password = req.body.password;
          await db.user.create({ password: req.body.password });`,
        },
      ];
      expect(getCheck(files, "password_plaintext").status).toBe("fail");
    });

    it("passes when password is hashed with bcrypt", () => {
      const files: RepoFile[] = [
        {
          path: "src/auth.ts",
          content: `const password = req.body.password;
          const hashed = await bcrypt.hash(password, 10);
          await db.user.create({ password: hashed });`,
        },
      ];
      expect(getCheck(files, "password_plaintext").status).toBe("pass");
    });

    it("passes when using argon2", () => {
      const files: RepoFile[] = [
        {
          path: "src/auth.ts",
          content: `const password = req.body.password;
          const hashed = await argon2.hash(password);`,
        },
      ];
      expect(getCheck(files, "password_plaintext").status).toBe("pass");
    });
  });

  // ─── no_rate_limit ───────────────────────────────────
  describe("no_rate_limit", () => {
    it("passes when no auth endpoints exist", () => {
      const files: RepoFile[] = [
        { path: "src/api/users.ts", content: "export default handler;" },
      ];
      expect(getCheck(files, "no_rate_limit").status).toBe("pass");
    });

    it("fails when auth endpoint has no rate limit", () => {
      const files: RepoFile[] = [
        {
          path: "src/api/auth/login.ts",
          content: `export default async function handler(req, res) {
            const { email, password } = req.body;
            const user = await authenticate(email, password);
          }`,
        },
      ];
      expect(getCheck(files, "no_rate_limit").status).toBe("fail");
    });

    it("passes when auth endpoint uses rate limiting", () => {
      const files: RepoFile[] = [
        {
          path: "src/api/auth/login.ts",
          content: `import { rateLimit } from 'express-rate-limit';
          const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });`,
        },
      ];
      expect(getCheck(files, "no_rate_limit").status).toBe("pass");
    });

    it("passes when auth endpoint returns 429", () => {
      const files: RepoFile[] = [
        {
          path: "src/api/auth/signup.ts",
          content: `if (rateLimited) return res.json({ status: 429, message: "too many requests" });`,
        },
      ];
      expect(getCheck(files, "no_rate_limit").status).toBe("pass");
    });
  });

  // ─── no_https ────────────────────────────────────────
  describe("no_https", () => {
    it("passes when vercel.json exists", () => {
      const files: RepoFile[] = [
        { path: "vercel.json", content: "{}" },
        {
          path: "src/config.ts",
          content: `const url = "http://api.example.com";`,
        },
      ];
      expect(getCheck(files, "no_https").status).toBe("pass");
    });

    it("passes when netlify.toml exists", () => {
      const files: RepoFile[] = [
        { path: "netlify.toml", content: "[build]" },
      ];
      expect(getCheck(files, "no_https").status).toBe("pass");
    });

    it("fails when http:// is used for non-localhost URLs", () => {
      const files: RepoFile[] = [
        {
          path: "src/config.ts",
          content: `const apiUrl = "http://api.example.com/v1";`,
        },
      ];
      expect(getCheck(files, "no_https").status).toBe("fail");
    });

    it("passes when http://localhost is used", () => {
      const files: RepoFile[] = [
        {
          path: "src/config.ts",
          content: `const url = "http://localhost:3000";`,
        },
      ];
      expect(getCheck(files, "no_https").status).toBe("pass");
    });

    it("passes when HSTS header is set", () => {
      const files: RepoFile[] = [
        {
          path: "src/middleware.ts",
          content: `res.setHeader("Strict-Transport-Security", "max-age=31536000");`,
        },
      ];
      expect(getCheck(files, "no_https").status).toBe("pass");
    });
  });

  // ─── no_privacy_policy ───────────────────────────────
  describe("no_privacy_policy", () => {
    it("fails when no privacy file or link exists", () => {
      const files: RepoFile[] = [
        { path: "src/index.ts", content: "console.log('hello')" },
      ];
      expect(getCheck(files, "no_privacy_policy").status).toBe("fail");
    });

    it("passes when privacy page file exists", () => {
      const files: RepoFile[] = [
        { path: "src/pages/privacy.tsx", content: "<div>Privacy Policy</div>" },
      ];
      expect(getCheck(files, "no_privacy_policy").status).toBe("pass");
    });

    it("passes when href to privacy page exists", () => {
      const files: RepoFile[] = [
        {
          path: "src/footer.tsx",
          content: `<a href="/privacy">Privacy Policy</a>`,
        },
      ];
      expect(getCheck(files, "no_privacy_policy").status).toBe("pass");
    });

    it("passes when privacy policy text is mentioned", () => {
      const files: RepoFile[] = [
        {
          path: "src/legal.ts",
          content: `const text = "Read our Privacy Policy for details.";`,
        },
      ];
      expect(getCheck(files, "no_privacy_policy").status).toBe("pass");
    });
  });

  // ─── runAllChecks ────────────────────────────────────
  describe("runAllChecks", () => {
    it("returns 8 check results", () => {
      const files: RepoFile[] = [
        { path: "src/index.ts", content: "console.log('hello')" },
      ];
      const results = runAllChecks(files);
      expect(results).toHaveLength(8);
    });

    it("returns all expected check keys", () => {
      const files: RepoFile[] = [
        { path: "src/index.ts", content: "" },
      ];
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
  });
});
