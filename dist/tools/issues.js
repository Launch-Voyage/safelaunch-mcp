import { z } from "zod";
import { apiClient } from "../lib/api-client.js";
import { resolveProject, getProjectRequiredError, } from "../lib/project-resolver.js";
export function registerIssuesTool(server) {
    server.tool("guardrail_issues", "List all security issues found in the latest scan. Shows each issue's severity, category, and description.", {
        project: z
            .string()
            .optional()
            .describe("Project name. Required when using an account API key (gr_ak_). Not needed with a project key (gr_sk_)."),
    }, async ({ project: projectArg }) => {
        if (!apiClient.isConfigured()) {
            return {
                content: [
                    { type: "text", text: apiClient.getConfigError() },
                ],
            };
        }
        const project = resolveProject(projectArg);
        const projectError = getProjectRequiredError(project);
        if (projectError) {
            return {
                content: [{ type: "text", text: projectError }],
            };
        }
        try {
            const qs = project ? `?project=${encodeURIComponent(project)}` : "";
            const data = await apiClient.get(`/api/mcp/issues${qs}`);
            if (data.issues.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No issues found! Your project has a grade of ${data.grade}.\n\nAll security checks passed.`,
                        },
                    ],
                };
            }
            const lines = [];
            lines.push(`${data.issues.length} issue${data.issues.length > 1 ? "s" : ""} found (Grade: ${data.grade}):`);
            lines.push("");
            for (let i = 0; i < data.issues.length; i++) {
                const issue = data.issues[i];
                lines.push(`${i + 1}. [${issue.severity}] ${issue.title}`);
                lines.push(`   Category: ${issue.category}`);
                lines.push(`   ${issue.description}`);
                lines.push(`   Fix: use guardrail_fix with check_key="${issue.check_key}"`);
                lines.push("");
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
                        text: `Failed to get issues: ${err instanceof Error ? err.message : "Unknown error"}`,
                    },
                ],
            };
        }
    });
}
