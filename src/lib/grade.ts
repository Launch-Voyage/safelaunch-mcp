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

const GRADE_SUMMARIES: Record<ScanGrade, string> = {
  A: "All clear — looking good!",
  B: "Almost there — one thing to check",
  C: "A few things need fixing",
  D: "Several issues found",
  F: "Critical issues need attention",
};

export function calculateGrade(results: CheckResult[]): GradeResult {
  const passCount = results.filter((r) => r.status === "pass").length;
  const failCount = results.length - passCount;
  const criticalCount = results.filter(
    (r) => r.status === "fail" && r.severity === "critical"
  ).length;
  const warningCount = results.filter(
    (r) => r.status === "fail" && r.severity === "warning"
  ).length;

  let grade: ScanGrade;

  if (criticalCount >= 2 || passCount <= 2) {
    grade = "F";
  } else if (passCount <= 4) {
    grade = "D";
  } else if (passCount <= 7 && criticalCount <= 1) {
    grade = "C";
  } else if (passCount === 7 && criticalCount === 0) {
    grade = "B";
  } else if (passCount === 8) {
    grade = "A";
  } else {
    grade = "C";
  }

  return {
    grade,
    summary: GRADE_SUMMARIES[grade],
    passCount,
    failCount,
    criticalCount,
    warningCount,
  };
}
