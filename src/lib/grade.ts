import type { CheckResult } from "./checks.js";

export type ScanGrade = "A" | "B" | "C" | "D" | "F";

export interface GradeResult {
  grade: ScanGrade;
  summary: string;
  passCount: number;
  failCount: number;
  skippedCount: number;
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
  const evaluated = results.filter((r) => r.status !== "skipped");
  const skippedCount = results.length - evaluated.length;

  const passCount = evaluated.filter((r) => r.status === "pass").length;
  const failCount = evaluated.filter((r) => r.status === "fail").length;
  const criticalCount = evaluated.filter(
    (r) => r.status === "fail" && r.severity === "critical"
  ).length;
  const warningCount = evaluated.filter(
    (r) => r.status === "fail" && r.severity === "warning"
  ).length;

  const total = evaluated.length;
  let grade: ScanGrade;

  if (total === 0) {
    grade = "A";
  } else if (criticalCount >= 2 || (total > 2 && passCount <= total * 0.25)) {
    grade = "F";
  } else if (total > 2 && passCount <= total * 0.5) {
    grade = "D";
  } else if (failCount > 0 && criticalCount <= 1) {
    grade = "C";
  } else if (failCount === 1 && criticalCount === 0) {
    grade = "B";
  } else if (failCount === 0) {
    grade = "A";
  } else {
    grade = "C";
  }

  return {
    grade,
    summary: GRADE_SUMMARIES[grade],
    passCount,
    failCount,
    skippedCount,
    criticalCount,
    warningCount,
  };
}
