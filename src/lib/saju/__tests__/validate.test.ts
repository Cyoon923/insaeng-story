import { describe, expect, it } from "vitest";
import { validateBirthInput } from "@/lib/saju/calendar/validate";
import type { BirthInput } from "@/lib/saju/types";

function solarDate(year: number, month: number, day: number): BirthInput {
  return {
    calendar: "solar",
    year,
    month,
    day,
    isLeapMonth: false,
    time: { hour: 8, minute: 0 },
  };
}

describe("양력 그레고리력 날짜 검증", () => {
  it.each([
    [2024, 1, 31],
    [2024, 3, 31],
    [2024, 12, 31],
    [2024, 2, 29],
  ] as const)("accepts %i-%s-%s", (year, month, day) => {
    expect(() => validateBirthInput(solarDate(year, month, day))).not.toThrow();
  });

  it("rejects 2023-02-29", () => {
    expect(() => validateBirthInput(solarDate(2023, 2, 29))).toThrow("없는 양력 날짜");
  });

  it("rejects 2024-04-31", () => {
    expect(() => validateBirthInput(solarDate(2024, 4, 31))).toThrow("없는 양력 날짜");
  });

  it("rejects 2100-02-29", () => {
    expect(() => validateBirthInput(solarDate(2100, 2, 29))).toThrow("없는 양력 날짜");
  });

  it("rejects 2024-13-01", () => {
    expect(() => validateBirthInput(solarDate(2024, 13, 1))).toThrow("월은 1–12");
  });

  it("rejects 2024-00-01", () => {
    expect(() => validateBirthInput(solarDate(2024, 0, 1))).toThrow("월은 1–12");
  });
});
