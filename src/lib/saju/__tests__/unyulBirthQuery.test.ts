import { describe, expect, it } from "vitest";
import {
  freeSajuBirthFromSearchParams,
  freeSajuBirthToQuery,
} from "@/lib/saju/free/unyulBirthQuery";

describe("unyulBirthQuery", () => {
  it("round-trips confirmed time", () => {
    const input = {
      calendar: "solar" as const,
      year: 1990,
      month: 1,
      day: 15,
      hour: 12,
      minute: 0,
    };
    const parsed = freeSajuBirthFromSearchParams(
      Object.fromEntries(new URLSearchParams(freeSajuBirthToQuery(input))),
    );
    expect(parsed).toEqual({ ok: true, input: { ...input, isLeapMonth: false, timeUnknown: false } });
  });

  it("round-trips unknown time without hour/minute", () => {
    const query = freeSajuBirthToQuery({
      calendar: "lunar",
      year: 1984,
      month: 1,
      day: 1,
      isLeapMonth: true,
      timeUnknown: true,
    });
    expect(query).not.toContain("h=");
    expect(query).toContain("unknown=1");
    expect(query).toContain("leap=1");

    const parsed = freeSajuBirthFromSearchParams(Object.fromEntries(new URLSearchParams(query)));
    expect(parsed).toEqual({
      ok: true,
      input: {
        calendar: "lunar",
        year: 1984,
        month: 1,
        day: 1,
        isLeapMonth: true,
        timeUnknown: true,
      },
    });
  });

  it("rejects missing birth date", () => {
    const parsed = freeSajuBirthFromSearchParams({ calendar: "solar" });
    expect(parsed.ok).toBe(false);
  });
});
