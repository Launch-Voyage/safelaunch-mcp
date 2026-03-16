import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiClient } from "../lib/api-client.js";
import {
  resolveProject,
  getProjectRequiredError,
} from "../lib/project-resolver.js";

interface FixStep {
  instruction: string;
  code?: string;
}

interface AiPrompt {
  text: string;
}

interface FixGuide {
  check_key: string;
  title: string;
  description: string;
  severity: string;
  why: string;
  steps: FixStep[];
  aiPrompts: AiPrompt[];
}

interface FixResponse {
  guide: FixGuide;
}

export function registerFixTool(server: McpServer): void {
  server.registerTool(
    "guardrail_fix",
    {
      description:
        "Get detailed fix instructions for a specific security issue. Includes step-by-step guide with code examples and AI prompts you can use.",
      inputSchema: {
        check_key: z
          .string()
          .describe(
            'The check_key of the issue to fix (e.g. "api_key_hardcoded", "stripe_key_exposed"). Get this from guardrail_issues.'
          ),
        project: z
          .string()
          .optional()
          .describe(
            "Project name. Required when using an account API key (gr_ak_). Not needed with a project key (gr_sk_)."
          ),
      },
    },
    async ({ check_key, project: projectArg }) => {
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
        const projectQs = project
          ? `&project=${encodeURIComponent(project)}`
          : "";
        const data = await apiClient.get<FixResponse>(
          `/api/mcp/issues?check_key=${encodeURIComponent(check_key)}${projectQs}`
        );

        const guide = data.guide;
        const lines: string[] = [];

        lines.push(`Fix: ${guide.title}`);
        lines.push(`Severity: ${guide.severity}`);
        lines.push("");
        lines.push(`Why it matters: ${guide.why}`);
        lines.push("");
        lines.push("Steps:");

        for (let i = 0; i < guide.steps.length; i++) {
          const step = guide.steps[i];
          lines.push(`${i + 1}. ${step.instruction}`);
          if (step.code) {
            lines.push(`   ${step.code}`);
          }
          lines.push("");
        }

        if (guide.aiPrompts.length > 0) {
          lines.push("AI Prompts (copy & paste to fix automatically):");
          for (const prompt of guide.aiPrompts) {
            lines.push(`  "${prompt.text}"`);
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
              text: `Failed to get fix guide: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          ],
        };
      }
    }
  );
}
