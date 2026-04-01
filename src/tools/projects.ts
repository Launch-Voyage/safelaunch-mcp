import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiClient } from "../lib/api-client.js";

interface Project {
  id: string;
  name: string;
  url: string | null;
  github_repo: string | null;
  sdk_connected: boolean;
  created_at: string;
}

interface ProjectsResponse {
  projects: Project[];
}

export function registerProjectsTool(server: McpServer): void {
  server.registerTool(
    "safelaunch_projects",
    {
      description:
        "List all your SafeLaunch projects. Use project names with other tools like safelaunch_scan, safelaunch_status, etc.",
    },
    async () => {
      if (!apiClient.isConfigured()) {
        return {
          content: [
            { type: "text" as const, text: apiClient.getConfigError() },
          ],
        };
      }

      try {
        const data =
          await apiClient.get<ProjectsResponse>("/api/mcp/projects");

        if (data.projects.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No projects yet. Use safelaunch_create_project to create one.",
              },
            ],
          };
        }

        const lines: string[] = [];
        lines.push(`You have ${data.projects.length} project(s):`);
        lines.push("");

        for (const p of data.projects) {
          lines.push(`- ${p.name}`);
          if (p.url) lines.push(`  URL: ${p.url}`);
          if (p.github_repo) lines.push(`  Repo: ${p.github_repo}`);
          lines.push(`  SDK: ${p.sdk_connected ? "connected" : "not connected"}`);
        }

        if (apiClient.isAccountMode()) {
          const defaultProject = apiClient.getDefaultProject();
          if (defaultProject) {
            lines.push("");
            lines.push(`Default project (SAFELAUNCH_PROJECT): ${defaultProject}`);
          } else {
            lines.push("");
            lines.push(
              'Tip: Set SAFELAUNCH_PROJECT in your MCP config to avoid specifying project each time.'
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
              text: `Failed to list projects: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );
}
