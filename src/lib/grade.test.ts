import { describe, it, expect } from "vitest";
import { calculateGrade, type GradeResult } from "./grade.js";
import type { CheckResult } from "./checks.js";

/** Helper: create N passing + remaining failing CheckResults */
function makeResults(
  passCount: number,
  opts: { criticalFails?: number } = {}
): CheckResult[] {
  const total = 8;
  const failCount = total - passCount;
  const criticalFails = opts.criticalFails ?? 0;
  const warningFails = failCount - criticalFails;

  const results: CheckResult[] = [];

  for (let i = 0; i < passCount; i++) {
    results.push({
      check_key: `check_pass_${i}`,
      category: "infra",
      status: "pass",
      severity: "warning",
    });
  }
  for (let i = 0; i < criticalFails; i++) {
    results.push({
      check_key: `check_critical_${i}`,
      category: "secrets",
      status: "fail",
      severity: "critical",
    });
  }
  for (let i = 0; i < warningFails; i++) {
    results.push({
      check_key: `check_warning_${i}`,
      category: "infra",
      status: "fail",
      severity: "warning",
    });
  }

  return results;
}

describe("calculateGrade", () => {
  it("returns A when all 8 checks pass", () => {
    const result = calculateGrade(makeResults(8));
    expect(result.grade).toBe("A");
    expect(result.passCount).toBe(8);
    expect(result.failCount).toBe(0);
    expect(result.summary).toBe("All clear — looking good!");
  });

  it("returns C when 7 pass and 0 critical (B unreachable — C condition catches first)", () => {
    // Note: The B branch (passCount === 7 && criticalCount === 0) is unreachable
    // because the C branch (passCount <= 7 && criticalCount <= 1) is checked first.
    const result = calculateGrade(makeResults(7, { criticalFails: 0 }));
    expect(result.grade).toBe("C");
    expect(result.passCount).toBe(7);
    expect(result.warningCount).toBe(1);
  });

  it("returns C when 7 pass with 1 critical", () => {
    const result = calculateGrade(makeResults(7, { criticalFails: 1 }));
    expect(result.grade).toBe("C");
    expect(result.criticalCount).toBe(1);
  });

  it("returns C when 5-6 pass with ≤1 critical", () => {
    const result5 = calculateGrade(makeResults(5, { criticalFails: 1 }));
    expect(result5.grade).toBe("C");

    const result6 = calculateGrade(makeResults(6, { criticalFails: 0 }));
    expect(result6.grade).toBe("C");
  });

  it("returns D when 3-4 pass", () => {
    const result3 = calculateGrade(makeResults(3, { criticalFails: 1 }));
    expect(result3.grade).toBe("D");

    const result4 = calculateGrade(makeResults(4, { criticalFails: 1 }));
    expect(result4.grade).toBe("D");
  });

  it("returns F when 2+ critical failures", () => {
    const result = calculateGrade(makeResults(6, { criticalFails: 2 }));
    expect(result.grade).toBe("F");
    expect(result.summary).toBe("Critical issues need attention");
  });

  it("returns F when ≤2 pass", () => {
    const result = calculateGrade(makeResults(2, { criticalFails: 1 }));
    expect(result.grade).toBe("F");

    const result0 = calculateGrade(makeResults(0, { criticalFails: 4 }));
    expect(result0.grade).toBe("F");
  });

  it("counts critical and warning separately", () => {
    const result = calculateGrade(makeResults(5, { criticalFails: 1 }));
    expect(result.criticalCount).toBe(1);
    expect(result.warningCount).toBe(2);
    expect(result.failCount).toBe(3);
  });
});
