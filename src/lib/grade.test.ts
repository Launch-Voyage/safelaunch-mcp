import { describe, it, expect, beforeEach } from "vitest";
import { calculateGrade } from "./grade.js";
import type { CheckResult } from "./checks.js";

const KEYS: CheckResult["check_key"][] = [
  "stripe_key_exposed",
  "webhook_no_verify",
  "password_plaintext",
  "no_rate_limit",
  "env_not_gitignored",
  "api_key_hardcoded",
  "no_https",
  "no_privacy_policy",
  "dep_vuln_test",
];
let keyIdx = 0;

function makeResult(
  status: "pass" | "fail" | "skipped",
  severity: "critical" | "warning" = "warning"
): CheckResult {
  return {
    check_key: KEYS[keyIdx++ % KEYS.length],
    category: "infra",
    status,
    severity,
  };
}

describe("calculateGrade", () => {
  beforeEach(() => {
    keyIdx = 0;
  });

  it("returns grade A when all checks pass", () => {
    const results = Array.from({ length: 8 }, () => makeResult("pass"));
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("A");
    expect(grade.passCount).toBe(8);
    expect(grade.failCount).toBe(0);
    expect(grade.criticalCount).toBe(0);
    expect(grade.warningCount).toBe(0);
    expect(grade.skippedCount).toBe(0);
    expect(grade.summary).toBe("All clear — looking good!");
  });

  it("returns grade A when all checks are skipped", () => {
    const results = Array.from({ length: 5 }, () => makeResult("skipped"));
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("A");
    expect(grade.skippedCount).toBe(5);
    expect(grade.passCount).toBe(0);
    expect(grade.failCount).toBe(0);
  });

  it("returns grade C when there is 1 warning failure (B branch is shadowed by C)", () => {
    const results = [
      ...Array.from({ length: 5 }, () => makeResult("pass")),
      makeResult("fail", "warning"),
    ];
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("C");
    expect(grade.failCount).toBe(1);
    expect(grade.warningCount).toBe(1);
    expect(grade.criticalCount).toBe(0);
  });

  it("returns grade C when there is 1 critical failure among many passes", () => {
    const results = [
      ...Array.from({ length: 6 }, () => makeResult("pass")),
      makeResult("fail", "critical"),
    ];
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("C");
    expect(grade.criticalCount).toBe(1);
  });

  it("returns grade C when there are a few warning failures", () => {
    const results = [
      ...Array.from({ length: 5 }, () => makeResult("pass")),
      makeResult("fail", "warning"),
      makeResult("fail", "warning"),
    ];
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("C");
  });

  it("returns grade F when 2+ critical failures", () => {
    const results = [
      ...Array.from({ length: 3 }, () => makeResult("pass")),
      makeResult("fail", "critical"),
      makeResult("fail", "critical"),
    ];
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("F");
    expect(grade.criticalCount).toBe(2);
    expect(grade.summary).toBe("Critical issues need attention");
  });

  it("returns grade F when <=25% pass among 4+ evaluated", () => {
    const results = [
      makeResult("pass"),
      makeResult("fail", "warning"),
      makeResult("fail", "warning"),
      makeResult("fail", "warning"),
    ];
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("F");
  });

  it("returns grade D when <=50% pass among 4+ evaluated", () => {
    const results = [
      makeResult("pass"),
      makeResult("pass"),
      makeResult("fail", "warning"),
      makeResult("fail", "warning"),
      makeResult("skipped"),
    ];
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("D");
    expect(grade.skippedCount).toBe(1);
  });

  it("excludes skipped checks from grade calculation", () => {
    const results = [
      ...Array.from({ length: 4 }, () => makeResult("pass")),
      ...Array.from({ length: 4 }, () => makeResult("skipped")),
    ];
    const grade = calculateGrade(results);

    expect(grade.grade).toBe("A");
    expect(grade.skippedCount).toBe(4);
    expect(grade.passCount).toBe(4);
  });

  it("returns correct counts for mixed results", () => {
    const results = [
      makeResult("pass"),
      makeResult("pass"),
      makeResult("pass"),
      makeResult("fail", "critical"),
      makeResult("fail", "warning"),
      makeResult("skipped"),
    ];
    const grade = calculateGrade(results);

    expect(grade.passCount).toBe(3);
    expect(grade.failCount).toBe(2);
    expect(grade.criticalCount).toBe(1);
    expect(grade.warningCount).toBe(1);
    expect(grade.skippedCount).toBe(1);
  });
});
