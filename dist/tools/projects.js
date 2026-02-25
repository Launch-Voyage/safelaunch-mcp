import { apiClient } from "../lib/api-client.js";
export function registerProjectsTool(server) {
    server.tool("guardrail_projects", "List all your GuardRail projects. Use project names with other tools like guardrail_scan, guardrail_status, etc.", {}, async () => {
        if (!apiClient.isConfigured()) {
            return {
                content: [
                    { type: "text", text: apiClient.getConfigError() },
                ],
            };
        }
        try {
            const data = await apiClient.get("/api/mcp/projects");
            if (data.projects.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "No projects yet. Use guardrail_create_project to create one.",
                        },
                    ],
                };
            }
            const lines = [];
            lines.push(`You have ${data.projects.length} project(s):`);
            lines.push("");
            for (const p of data.projects) {
                lines.push(`- ${p.name}`);
                if (p.url)
                    lines.push(`  URL: ${p.url}`);
                if (p.github_repo)
                    lines.push(`  Repo: ${p.github_repo}`);
                lines.push(`  SDK: ${p.sdk_connected ? "connected" : "not connected"}`);
            }
            if (apiClient.isAccountMode()) {
                const defaultProject = apiClient.getDefaultProject();
                if (defaultProject) {
                    lines.push("");
                    lines.push(`Default project (GUARDRAIL_PROJECT): ${defaultProject}`);
                }
                else {
                    lines.push("");
                    lines.push('Tip: Set GUARDRAIL_PROJECT in your MCP config to avoid specifying project each time.');
                }
            }
            return {
                content: [{ type: "text", text: lines.join("\n") }],
            };
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to list projects: ${err instanceof Error ? err.message : "Unknown error"}`,
                    },
                ],
            };
        }
    });
}
