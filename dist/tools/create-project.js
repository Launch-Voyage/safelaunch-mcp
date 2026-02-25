import { z } from "zod";
import { apiClient } from "../lib/api-client.js";
export function registerCreateProjectTool(server) {
    server.tool("guardrail_create_project", "Create a new GuardRail project. Free plan allows up to 3 projects. After creation, use the project name with guardrail_scan to scan it.", {
        name: z.string().describe("Project name (e.g. 'my-saas-app')"),
        url: z
            .string()
            .optional()
            .describe("Project URL (e.g. 'https://myapp.com')"),
        github_repo: z
            .string()
            .optional()
            .describe("GitHub repository URL (e.g. 'https://github.com/user/repo')"),
    }, async ({ name, url, github_repo }) => {
        if (!apiClient.isConfigured()) {
            return {
                content: [
                    { type: "text", text: apiClient.getConfigError() },
                ],
            };
        }
        try {
            const data = await apiClient.post("/api/mcp/projects", { name, url, github_repo });
            const lines = [];
            lines.push(`Project "${data.project.name}" created!`);
            lines.push("");
            lines.push(`You can now scan it: use guardrail_scan with project="${data.project.name}"`);
            return {
                content: [{ type: "text", text: lines.join("\n") }],
            };
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to create project: ${err instanceof Error ? err.message : "Unknown error"}`,
                    },
                ],
            };
        }
    });
}
