import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { checkDependencyVulns, OSV_API_URL } from "./osv-client.js";
import type { RepoFile } from "./local-scanner.js";

function makeFiles(packageJson?: Record<string, unknown>): RepoFile[] {
  if (!packageJson) return [];
  return [
    {
      path: "package.json",
      content: JSON.stringify(packageJson),
    },
  ];
}

function mockFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchFail() {
  return vi.fn().mockRejectedValue(new Error("network down"));
}

describe("osv-client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty results when package.json is missing", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy;

    const result = await checkDependencyVulns([]);

    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns empty results when package.json is invalid JSON", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy;
    const files: RepoFile[] = [{ path: "package.json", content: "{invalid json" }];

    const result = await checkDependencyVulns(files);

    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns empty results when no valid semver dependencies are found", async () => {
    const spy = vi.fn();
    globalThis.fetch = spy;

    const files = makeFiles({
      dependencies: {
        one: "workspace:*",
        two: "github:acme/two",
      },
      devDependencies: {
        three: "latest",
      },
    });

    const result = await checkDependencyVulns(files);

    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("queries OSV and maps results to dependency findings", async () => {
    const spy = mockFetchOk({
      results: [
        {
          vulns: [
            { id: "CVE-2026-0001", database_specific: { severity: "LOW" } },
            { id: "CVE-2026-0002", severity: [{ type: "CVSS_V3", score: "5.2" }] },
            { id: "CVE-2026-0003", severity: [{ type: "CVSS_V3", score: "6.9" }] },
          ],
        },
        {
          vulns: [
            { id: "CVE-2026-1001", database_specific: { severity: "HIGH" } },
            { id: "CVE-2026-1002", severity: [{ type: "CVSS_V3", score: "9.1" }] },
            { id: "CVE-2026-1003", severity: [{ type: "CVSS_V3", score: "7.8" }] },
            { id: "CVE-2026-1004", severity: [{ type: "CVSS_V3", score: "7.2" }] },
          ],
        },
        {},
      ],
    });
    globalThis.fetch = spy;

    const files = makeFiles({
      dependencies: {
        "left-pad": "^1.3.0",
        "@scope/pkg": "~2.0.1",
      },
      devDependencies: {
        skipme: "workspace:*",
      },
    });

    const result = await checkDependencyVulns(files);

    expect(spy).toHaveBeenCalledTimes(1);

    const [url, options] = spy.mock.calls[0];
    expect(url).toBe(OSV_API_URL);
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.queries).toEqual([
      { version: "1.3.0", package: { name: "left-pad", ecosystem: "npm" } },
      { version: "2.0.1", package: { name: "@scope/pkg", ecosystem: "npm" } },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      check_key: "dep_vuln_left-pad",
      category: "dependencies",
      status: "fail",
      severity: "warning",
      title: "Vulnerable dependency: left-pad@1.3.0",
      description: "3 known vulnerabilities (CVE-2026-0001, CVE-2026-0002, CVE-2026-0003)",
    });
    expect(result[1]).toMatchObject({
      check_key: "dep_vuln__scope_pkg",
      category: "dependencies",
      status: "fail",
      severity: "critical",
      title: "Vulnerable dependency: @scope/pkg@2.0.1",
      description:
        "4 known vulnerabilities (CVE-2026-1001, CVE-2026-1002, CVE-2026-1003, ...)",
    });
  });

  it("fails open and returns empty results when OSV API call fails", async () => {
    globalThis.fetch = mockFetchFail();

    const files = makeFiles({
      dependencies: {
        react: "^19.2.4",
      },
    });

    const result = await checkDependencyVulns(files);
    expect(result).toEqual([]);
  });

  it("returns empty results when OSV API returns non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const files = makeFiles({
      dependencies: {
        react: "^19.2.4",
      },
    });

    const result = await checkDependencyVulns(files);
    expect(result).toEqual([]);
  });

  it("caps OSV queries to 100 dependencies", async () => {
    const spy = mockFetchOk({ results: [] });
    globalThis.fetch = spy;

    const dependencies: Record<string, string> = {};
    for (let i = 0; i < 120; i++) {
      dependencies[`pkg-${i}`] = `^1.0.${i}`;
    }

    await checkDependencyVulns(makeFiles({ dependencies }));

    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body.queries).toHaveLength(100);
  });
});
