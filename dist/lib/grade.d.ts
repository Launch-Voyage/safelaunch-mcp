import type { CheckResult } from "./checks.js";
export type ScanGrade = "A" | "B" | "C" | "D" | "F";
export interface GradeResult {
    grade: ScanGrade;
    summary: string;
    passCount: number;
    failCount: number;
    criticalCount: number;
    warningCount: number;
}
export declare function calculateGrade(results: CheckResult[]): GradeResult;
