import { describe, expect, it } from "vitest";
import { buildFreeSajuPillars } from "@/lib/saju/free/buildFreeSajuPillars";

describe("buildFreeSajuPillars", () => {
  it("출생시간 확정 — hourCertainty confirmed", () => {
    const pillars = buildFreeSajuPillars({
      calendar: "solar",
      year: 1990,
      month: 1,
      day: 15,
      hour: 8,
      minute: 30,
    });

    expect(pillars.hour).not.toBe("unknown");
    expect(pillars.hourCertainty).toBe("confirmed");
  });

  it("출생시간 unknown — hourCertainty unknown", () => {
    const pillars = buildFreeSajuPillars({
      calendar: "solar",
      year: 1990,
      month: 1,
      day: 15,
      timeUnknown: true,
    });

    expect(pillars.hour).toBe("unknown");
    expect(pillars.hourCertainty).toBe("unknown");
  });

  it("양력 입력 — FourPillars를 반환한다", () => {
    const pillars = buildFreeSajuPillars({
      calendar: "solar",
      year: 2000,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
    });

    expect(pillars.year).toEqual({ stem: "己", branch: "卯" });
    expect(pillars.hourCertainty).toBe("confirmed");
  });

  it("음력 입력 — buildFourPillars 계약으로 변환한다", () => {
    const pillars = buildFreeSajuPillars({
      calendar: "lunar",
      year: 1984,
      month: 1,
      day: 1,
      isLeapMonth: false,
      hour: 12,
      minute: 0,
    });

    // 음력 1984-1-1 → 양력 1984-02-02 (pillars.test lunar conversion)
    expect(pillars.year).toBeDefined();
    expect(pillars.month).toBeDefined();
    expect(pillars.day).toBeDefined();
    expect(pillars.hourCertainty).toBe("confirmed");
    expect(pillars.hour).not.toBe("unknown");
  });
});
