import { apiClient } from "../lib/api-client.js";
export function registerUpgradeTool(server) {
    server.tool("guardrail_upgrade", "Upgrade your GuardRail plan to Pro. Pro includes unlimited scans, unlimited projects, priority support, and more. Opens a checkout link for payment.", {}, async () => {
        if (!apiClient.isConfigured()) {
            return {
                content: [
                    { type: "text", text: apiClient.getConfigError() },
                ],
            };
        }
        try {
            const data = await apiClient.post("/api/mcp/upgrade", {});
            if (data.status === "already_pro") {
                return {
                    content: [
                        {
                            type: "text",
                            text: "You're already on the Pro plan! No upgrade needed.",
                        },
                    ],
                };
            }
            const lines = [];
            lines.push("Ready to upgrade to Pro!");
            lines.push("");
            lines.push("Pro plan ($19/month) includes:");
            lines.push("- Unlimited projects");
            lines.push("- Unlimited scans");
            lines.push("- Priority support");
            lines.push("- 14-day free trial");
            lines.push("");
            lines.push("Complete your upgrade here:");
            lines.push(data.url || "");
            return {
                content: [{ type: "text", text: lines.join("\n") }],
            };
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to start upgrade: ${err instanceof Error ? err.message : "Unknown error"}`,
                    },
                ],
            };
        }
    });
}
