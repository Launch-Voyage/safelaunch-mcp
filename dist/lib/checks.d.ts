import type { RepoFile } from "./local-scanner.js";
export interface CheckResult {
    check_key: string;
    category: "payment" | "auth" | "secrets" | "infra" | "legal";
    status: "pass" | "fail";
    severity: "critical" | "warning";
}
export declare function runAllChecks(files: RepoFile[]): CheckResult[];
