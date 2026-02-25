/**
 * Resolve project name from tool argument → env fallback.
 * Returns the project name or null if account-mode and no project specified.
 */
export declare function resolveProject(projectArg?: string): string | undefined;
/**
 * If account-mode and no project resolved, return an error message.
 * Returns null if project is resolved or not needed (project-key mode).
 */
export declare function getProjectRequiredError(project?: string): string | null;
