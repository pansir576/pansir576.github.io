import { describe, expect, it } from "vitest";
import {
  evaluateGarlicLettuce,
  garlicCookingBand,
  greensCookingBand,
} from "../src/lib/garlic-lettuce-game";
import { XIAMI_GARLIC_LETTUCE_DIALOGUE } from "../src/lib/garlic-lettuce-dialogue";

const balanced = {
  heat: "high" as const,
  garlicCookMs: 1_100,
  greensCookMs: 3_400,
  stirCount: 2,
  salt: 1 as const,
};

describe("garlic lettuce scoring", () => {
  it("awards a perfect result when garlic and greens are both in window", () => {
    const outcome = evaluateGarlicLettuce(balanced);
    expect(outcome.kind).toBe("perfect");
    expect(outcome.stars).toBe(3);
    expect(outcome.voiceLineId).toBe("garlic-outcome-perfect");
  });

  it("distinguishes burnt and underdeveloped garlic", () => {
    const burnt = evaluateGarlicLettuce({
      ...balanced,
      garlicCookMs: 4_500,
    });
    const weak = evaluateGarlicLettuce({
      ...balanced,
      garlicCookMs: 250,
    });
    expect(burnt.kind).toBe("burnt-garlic");
    expect(burnt.voiceLineId).toBe("garlic-outcome-burnt-garlic");
    expect(weak.kind).toBe("weak-garlic");
    expect(weak.voiceLineId).toBe("garlic-outcome-weak-garlic");
  });

  it("distinguishes raw and overdone leafy greens", () => {
    expect(
      evaluateGarlicLettuce({ ...balanced, greensCookMs: 800 }).kind,
    ).toBe("raw-greens");
    expect(
      evaluateGarlicLettuce({ ...balanced, greensCookMs: 6_000 }).kind,
    ).toBe("over-greens");
  });

  it("uses salt to create distinct seasoning outcomes", () => {
    expect(
      evaluateGarlicLettuce({ ...balanced, salt: 2 }).voiceLineId,
    ).toBe("garlic-outcome-salty");
    expect(
      evaluateGarlicLettuce({ ...balanced, salt: 0 }).voiceLineId,
    ).toBe("garlic-outcome-bland");
  });

  it("keeps independent windows for garlic aroma and greens texture", () => {
    expect(garlicCookingBand("high", 1_000)).toBe("ready");
    expect(greensCookingBand("high", 1_000)).toBe("raw");
    expect(greensCookingBand("medium", 5_000)).toBe("ready");
  });
});

describe("garlic lettuce Xiami dialogue", () => {
  it("covers the five phases and seven outcomes", () => {
    expect(Object.keys(XIAMI_GARLIC_LETTUCE_DIALOGUE)).toHaveLength(12);
    expect(XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-phase-garlic"]).toContain(
      "蒜香",
    );
    expect(
      XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-over-greens"],
    ).toContain("叶绿素");
  });
});
