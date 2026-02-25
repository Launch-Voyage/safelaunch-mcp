import { apiClient } from "./api-client.js";

/**
 * Resolve project name from tool argument → env fallback.
 * Returns the project name or null if account-mode and no project specified.
 */
export function resolveProject(projectArg?: string): string | undefined {
  return projectArg || apiClient.getDefaultProject() || undefined;
}

/**
 * If account-mode and no project resolved, return an error message.
 * Returns null if project is resolved or not needed (project-key mode).
 */
export function getProjectRequiredError(project?: string): string | null {
  if (!apiClient.isAccountMode()) return null; // gr_sk_ auto-binds
  if (project) return null;

  return [
    "Project name is required.",
    "",
    "Specify a project:",
    '  Use the "project" parameter, or',
    "  Set GUARDRAIL_PROJECT in your MCP config env.",
    "",
    "Run guardrail_projects to list your projects.",
  ].join("\n");
}
