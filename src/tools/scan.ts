import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scanLocalDirectory } from "../lib/local-scanner.js";
import { runAllChecks } from "../lib/checks.js";
import { checkDependencyVulns } from "../lib/osv-client.js";
import { calculateGrade } from "../lib/grade.js";
import { apiClient } from "../lib/api-client.js";
import {
  resolveProject,
  getProjectRequiredError,
} from "../lib/project-resolver.js";

const CHECK_LABELS: Record<string, string> = {
  stripe_key_exposed: "Stripe secret key exposed in code",
  webhook_no_verify: "Webhook signature not verified",
  password_plaintext: "Password stored in plaintext",
  no_rate_limit: "No rate limiting on auth endpoints",
  env_not_gitignored: ".env file not in .gitignore",
  api_key_hardcoded: "API key hardcoded in source code",
  no_https: "HTTPS not configured",
  no_privacy_policy: "No privacy policy found",
};

export function registerScanTool(server: McpServer): void {
  server.registerTool(
    "guardrail_scan",
    {
      description:
        "Scan your local project directory for security issues. Checks for exposed API keys, hardcoded secrets, missing rate limiting, and more. Results are saved to your GuardRail dashboard.",
      inputSchema: {
        directory: z
          .string()
          .optional()
          .describe(
            "Directory to scan. Defaults to the current working directory."
          ),
        project: z
          .string()
          .optional()
          .describe(
            "Project name to save results to. Required when using an account API key (gr_ak_). Not needed with a project key (gr_sk_)."
          ),
      },
    },
    async ({ directory, project: projectArg }) => {
      // Require API key — scan is gated behind authentication
      if (!apiClient.isConfigured()) {
        return {
          content: [
            {
              type: "text" as const,
              text: apiClient.getConfigError(),
            },
          ],
        };
      }

      // Resolve project for account-key users
      const project = resolveProject(projectArg);
      const projectError = getProjectRequiredError(project);
      if (projectError) {
        return {
          content: [{ type: "text" as const, text: projectError }],
        };
      }

      const dir = directory || process.cwd();

      // 1. Scan local files
      const files = await scanLocalDirectory(dir);
      if (files.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No scannable files found in ${dir}. Make sure you're in a project directory with source code files (.js, .ts, .py, etc.).`,
            },
          ],
        };
      }

      // 2. Run checks locally + dependency vulnerability scan
      const checkResults = runAllChecks(files);
      const depResults = await checkDependencyVulns(files);
      const allResults = [...checkResults, ...depResults];
      const gradeResult = calculateGrade(allResults);

      // 3. Try to save to API (non-blocking)
      let savedToCloud = false;
      let sdkConnected = false;
      let scanLimitReached = false;
      let scanLimitMessage = "";
      try {
        if (apiClient.isConfigured()) {
          const res = await apiClient.postRaw("/api/mcp/scan", {
            project,
            checkResults: allResults,
            grade: gradeResult.grade,
            passCount: gradeResult.passCount,
            failCount: gradeResult.failCount,
            criticalCount: gradeResult.criticalCount,
            warningCount: gradeResult.warningCount,
            summary: gradeResult.summary,
            filesScanned: files.length,
          });

          if (res.status === 403) {
            const data = await res.json();
            scanLimitReached = true;
            scanLimitMessage = data.error || "Scan limit reached.";
          } else if (res.ok) {
            const data = await res.json();
            savedToCloud = true;
            sdkConnected = data?.sdkConnected ?? false;
          }
        }
      } catch {
        // API save failed, but local results are still valid
      }

      // 4. Format output
      const failedChecks = allResults.filter((r) => r.status === "fail");
      const lines: string[] = [];

      lines.push(`Scan complete! Grade: ${gradeResult.grade}`);
      lines.push(`${gradeResult.passCount}/${allResults.length} checks passed`);
      lines.push("");

      if (failedChecks.length === 0) {
        lines.push("All checks passed! Your code looks secure.");
      } else {
        lines.push(
          `${failedChecks.length} issue${failedChecks.length > 1 ? "s" : ""} found:`
        );
        lines.push("");
        for (const check of failedChecks) {
          const label = check.title || CHECK_LABELS[check.check_key] || check.check_key;
          lines.push(`- [${check.severity}] ${label}`);
        }
        lines.push("");
        lines.push(
          "Use guardrail_fix with check_key to get detailed fix steps."
        );
      }

      if (scanLimitReached) {
        lines.push("");
        lines.push(`⚠️ ${scanLimitMessage}`);
        lines.push("Results shown above are from local analysis only (not saved to dashboard).");
      } else if (savedToCloud) {
        lines.push("");
        lines.push("Results saved to your GuardRail dashboard.");
      }

      lines.push("");
      lines.push(`Files scanned: ${files.length}`);

      // SDK setup prompt (only when API saved and SDK not connected)
      if (savedToCloud && !sdkConnected) {
        lines.push("");
        lines.push("---");
        lines.push(
          "Want real-time protection? Install the Guardrail SDK to detect brute force attacks, suspicious logins, and traffic spikes while your app runs."
        );
        lines.push("  npm install guardrail-sdk");
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
