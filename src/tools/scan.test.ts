import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { server } from "../__tests__/mocks/handlers.js";

// We test the scan tool by importing the underlying functions it calls,
// rather than going through the MCP server registration (which requires
// a full McpServer instance). This tests the core logic path.

describe("scan tool integration", () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "guardrail-scan-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("runs local checks and submits to API", async () => {
    // Create a simple project with one issue
    await writeFile(join(tempDir, "index.ts"), "export const app = true;");
    await writeFile(
      join(tempDir, ".gitignore"),
      "node_modules\n.env\n"
    );

    const { scanLocalDirectory } = await import("../lib/local-scanner.js");
    const { runAllChecks } = await import("../lib/checks.js");
    const { calculateGrade } = await import("../lib/grade.js");
    const { apiClient } = await import("../lib/api-client.js");

    const files = await scanLocalDirectory(tempDir);
    expect(files.length).toBeGreaterThan(0);

    const checkResults = runAllChecks(files);
    expect(checkResults).toHaveLength(8);

    const gradeResult = calculateGrade(checkResults);
    expect(["A", "B", "C", "D", "F"]).toContain(gradeResult.grade);

    // Submit to API (uses MSW mock)
    const res = await apiClient.postRaw("/api/mcp/scan", {
      checkResults,
      grade: gradeResult.grade,
      passCount: gradeResult.passCount,
      failCount: gradeResult.failCount,
      criticalCount: gradeResult.criticalCount,
      warningCount: gradeResult.warningCount,
      summary: gradeResult.summary,
      filesScanned: files.length,
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data).toHaveProperty("success", true);
  });

  it("handles API failure gracefully — local results still available", async () => {
    // Make API return 500
    server.use(
      http.post("https://test.example.com/api/mcp/scan", () => {
        return HttpResponse.json(
          { error: "Internal server error" },
          { status: 500 }
        );
      })
    );

    await writeFile(join(tempDir, "index.ts"), "export const x = 1;");
    await writeFile(join(tempDir, ".gitignore"), ".env\nnode_modules\n");

    const { scanLocalDirectory } = await import("../lib/local-scanner.js");
    const { runAllChecks } = await import("../lib/checks.js");
    const { calculateGrade } = await import("../lib/grade.js");
    const { apiClient } = await import("../lib/api-client.js");

    // Local scan should still work
    const files = await scanLocalDirectory(tempDir);
    const checkResults = runAllChecks(files);
    const gradeResult = calculateGrade(checkResults);

    expect(checkResults).toHaveLength(8);
    expect(gradeResult.grade).toBeDefined();

    // API call fails, but we handle it
    const res = await apiClient.postRaw("/api/mcp/scan", {
      checkResults,
      grade: gradeResult.grade,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(500);
  });

  it("handles 403 scan limit reached", async () => {
    server.use(
      http.post("https://test.example.com/api/mcp/scan", () => {
        return HttpResponse.json(
          { error: "Daily scan limit reached (20/20). Try again tomorrow." },
          { status: 403 }
        );
      })
    );

    const { apiClient } = await import("../lib/api-client.js");
    const res = await apiClient.postRaw("/api/mcp/scan", {});
    expect(res.status).toBe(403);

    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("scan limit");
  });

  it("detects security issues in a vulnerable project", async () => {
    // Create a project with known vulnerabilities
    await mkdir(join(tempDir, "src", "api", "auth"), { recursive: true });
    await writeFile(
      join(tempDir, "src", "api", "auth", "login.ts"),
      `export default async function handler(req, res) {
        const password = req.body.password;
        await db.user.create({ password: req.body.password });
      }`
    );
    await writeFile(
      join(tempDir, "src", "config.ts"),
      `const apiUrl = "http://api.production.com/v1";
       const key = "AKIAIOSFODNN7EXAMPLE";`
    );
    // No .gitignore

    const { scanLocalDirectory } = await import("../lib/local-scanner.js");
    const { runAllChecks } = await import("../lib/checks.js");
    const { calculateGrade } = await import("../lib/grade.js");

    const files = await scanLocalDirectory(tempDir);
    const results = runAllChecks(files);
    const grade = calculateGrade(results);

    // Should have several failures
    const failed = results.filter((r) => r.status === "fail");
    expect(failed.length).toBeGreaterThanOrEqual(3);
    // Grade should be poor
    expect(["D", "F"]).toContain(grade.grade);
  });
});
