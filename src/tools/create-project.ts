import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiClient } from "../lib/api-client.js";

interface CreateProjectResponse {
  project: { id: string; name: string };
}

export function registerCreateProjectTool(server: McpServer): void {
  server.registerTool(
    "safelaunch_create_project",
    {
      description:
        "Create a new SafeLaunch project. Free plan allows up to 3 projects. After creation, use the project name with safelaunch_scan to scan it.",
      inputSchema: {
        name: z.string().describe("Project name (e.g. 'my-saas-app')"),
        url: z
          .string()
          .optional()
          .describe("Project URL (e.g. 'https://myapp.com')"),
        github_repo: z
          .string()
          .optional()
          .describe(
            "GitHub repository URL (e.g. 'https://github.com/user/repo')"
          ),
      },
    },
    async ({ name, url, github_repo }) => {
      if (!apiClient.isConfigured()) {
        return {
          content: [
            { type: "text" as const, text: apiClient.getConfigError() },
          ],
        };
      }

      try {
        const data = await apiClient.post<CreateProjectResponse>(
          "/api/mcp/projects",
          { name, url, github_repo }
        );

        const lines: string[] = [];
        lines.push(`Project "${data.project.name}" created!`);
        lines.push("");
        lines.push(
          `You can now scan it: use safelaunch_scan with project="${data.project.name}"`
        );

        return {
          content: [{ type: "text" as const, text: lines.join("\n") }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create project: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );
}
