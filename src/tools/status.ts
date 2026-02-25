import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiClient } from "../lib/api-client.js";
import {
  resolveProject,
  getProjectRequiredError,
} from "../lib/project-resolver.js";

interface StatusResponse {
  project: {
    name: string;
    url: string | null;
  };
  latestScan: {
    grade: string;
    summary: string;
    passedChecks: number;
    totalChecks: number;
    scannedAt: string;
    source: string;
  } | null;
  monitoring: {
    uptimePercentage: number | null;
    uptimeStatus: string;
    sslDaysRemaining: number | null;
    sslStatus: string;
  } | null;
}

export function registerStatusTool(server: McpServer): void {
  server.tool(
    "guardrail_status",
    "Get the current security status of your GuardRail project including the latest scan grade, uptime, and SSL certificate status.",
    {
      project: z
        .string()
        .optional()
        .describe(
          "Project name. Required when using an account API key (gr_ak_). Not needed with a project key (gr_sk_)."
        ),
    },
    async ({ project: projectArg }) => {
      if (!apiClient.isConfigured()) {
        return {
          content: [
            { type: "text" as const, text: apiClient.getConfigError() },
          ],
        };
      }

      const project = resolveProject(projectArg);
      const projectError = getProjectRequiredError(project);
      if (projectError) {
        return {
          content: [{ type: "text" as const, text: projectError }],
        };
      }

      try {
        const qs = project ? `?project=${encodeURIComponent(project)}` : "";
        const data = await apiClient.get<StatusResponse>(`/api/mcp/status${qs}`);

        const lines: string[] = [];
        lines.push(`Project: ${data.project.name}`);

        if (data.latestScan) {
          lines.push("");
          lines.push(`Grade: ${data.latestScan.grade} (${data.latestScan.summary})`);
          lines.push(
            `Checks: ${data.latestScan.passedChecks}/${data.latestScan.totalChecks} passed`
          );
          lines.push(`Last scan: ${data.latestScan.scannedAt} (${data.latestScan.source})`);
        } else {
          lines.push("");
          lines.push("No scans yet. Run guardrail_scan to scan your project.");
        }

        if (data.monitoring) {
          lines.push("");
          if (data.monitoring.uptimePercentage != null) {
            lines.push(
              `Uptime: ${data.monitoring.uptimePercentage}% (${data.monitoring.uptimeStatus})`
            );
          }
          if (data.monitoring.sslDaysRemaining != null) {
            lines.push(
              `SSL: ${data.monitoring.sslDaysRemaining}d remaining (${data.monitoring.sslStatus})`
            );
          }
        }

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get status: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );
}
