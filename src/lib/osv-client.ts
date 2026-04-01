import type { RepoFile } from "./local-scanner.js";
import type { CheckResult } from "./checks.js";

/**
 * https://google.github.io/osv.dev
 */
export const OSV_API_URL = "https://api.osv.dev/v1/querybatch";

interface OsvVuln {
  id: string;
  summary?: string;
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string };
}

interface OsvBatchResponse {
  results: Array<{ vulns?: OsvVuln[] }>;
}

/**
 * https://google.github.io/osv.dev/post-v1-query/#parameters
 */
type OsvPostPayload =
  { page_token?: string }
  &
  ({
    version: string;
    package: {
      name: string;
      ecosystem: string;
    };
  } |
  {
    commit: string;
    package?: {
      name?: string;
      ecosystem?: string;
      purl?: string;
    };
  });

/**
 * https://google.github.io/osv.dev/post-v1-querybatch/
 */
interface OsvPostQueryBatchPayload {
  queries: OsvPostPayload[];
}

function extractVersion(versionSpec: string): string | null {
  const match = versionSpec.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

function mapSeverity(vulns: OsvVuln[]): "critical" | "warning" {
  for (const vuln of vulns) {
    const dbSev = vuln.database_specific?.severity?.toUpperCase();
    if (dbSev === "CRITICAL" || dbSev === "HIGH") return "critical";
    for (const s of vuln.severity ?? []) {
      const score = parseFloat(s.score);
      if (!isNaN(score) && score >= 7.0) return "critical";
    }
  }
  return "warning";
}

export async function checkDependencyVulns(
  files: RepoFile[]
): Promise<CheckResult[]> {
  const pkgFile = files.find((f) => f.path === "package.json");
  if (!pkgFile) return [];

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(pkgFile.content) as Record<string, unknown>;
  } catch {
    return [];
  }

  const deps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };

  const entries = Object.entries(deps)
    .map(([name, versionSpec]) => ({
      name,
      version: extractVersion(String(versionSpec)),
    }))
    .filter((e): e is { name: string; version: string } => e.version !== null)
    .slice(0, 100);

  if (entries.length === 0) return [];

  const payload: OsvPostQueryBatchPayload = {
    queries: entries.map((e) => ({
      version: e.version,
      package: { name: e.name, ecosystem: "npm" },
    })),
  };

  let response: OsvBatchResponse;
  try {
    const res = await fetch(OSV_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    response = (await res.json()) as OsvBatchResponse;
  } catch {
    // OSV API unreachable — fail-open
    return [];
  }

  const results: CheckResult[] = [];
  for (let i = 0; i < entries.length; i++) {
    const vulns = response.results[i]?.vulns;
    if (!vulns || vulns.length === 0) continue;

    const { name, version } = entries[i];
    const severity = mapSeverity(vulns);
    const safeKey = name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const cveIds = vulns
      .slice(0, 3)
      .map((v) => v.id)
      .join(", ");

    results.push({
      check_key: `dep_vuln_${safeKey}`,
      category: "dependencies",
      status: "fail",
      severity,
      title: `Vulnerable dependency: ${name}@${version}`,
      description: `${vulns.length} known vulnerabilit${vulns.length === 1 ? "y" : "ies"} (${cveIds}${vulns.length > 3 ? ", ..." : ""})`,
    });
  }

  return results;
}
