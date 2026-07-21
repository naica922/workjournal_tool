import { describe, expect, it } from "vitest";
import { apprenticeshipYear, isProfileComplete } from "./apprenticeship";

describe("apprenticeshipYear", () => {
  it("is year 1 during the first year", () => {
    expect(
      apprenticeshipYear("2025-08-01", new Date("2026-07-21")),
    ).toBe(1);
  });

  it("moves to year 2 on the first anniversary", () => {
    expect(
      apprenticeshipYear("2025-08-01", new Date("2026-08-01")),
    ).toBe(2);
  });

  it("is year 3 two years after the start", () => {
    expect(
      apprenticeshipYear("2023-08-01", new Date("2026-07-21")),
    ).toBe(3);
  });

  it("never goes below year 1 for future start dates", () => {
    expect(
      apprenticeshipYear("2026-08-01", new Date("2026-07-21")),
    ).toBe(1);
  });
});

describe("isProfileComplete", () => {
  it("requires a birthday for everyone", () => {
    expect(isProfileComplete({ role: "host", birthday: null })).toBe(false);
    expect(isProfileComplete({ role: "host", birthday: "2000-01-01" })).toBe(
      true,
    );
  });

  it("requires the apprenticeship start for apprentices", () => {
    expect(
      isProfileComplete({
        role: "apprentice",
        birthday: "2007-03-14",
        apprenticeshipStart: null,
      }),
    ).toBe(false);
    expect(
      isProfileComplete({
        role: "apprentice",
        birthday: "2007-03-14",
        apprenticeshipStart: "2023-08-01",
      }),
    ).toBe(true);
  });
});
