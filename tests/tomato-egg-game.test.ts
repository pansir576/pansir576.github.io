import { describe, expect, it } from "vitest";
import {
  cookingBand,
  evaluateTomatoEgg,
  HEAT_PROFILES,
} from "../src/lib/tomato-egg-game";

const balanced = {
  heat: "medium" as const,
  eggCookMs: 4_500,
  tomatoCookMs: 5_600,
  stirCount: 4,
  salt: 1 as const,
  sugar: 0 as const,
};

describe("tomato egg prototype scoring", () => {
  it("awards three stars for balanced egg, tomato, stirring and seasoning", () => {
    const outcome = evaluateTomatoEgg(balanced);
    expect(outcome.kind).toBe("perfect");
    expect(outcome.stars).toBe(3);
    expect(outcome.score).toBeGreaterThanOrEqual(84);
  });

  it("distinguishes undercooked egg or tomato from burnt food", () => {
    const rawEgg = evaluateTomatoEgg({ ...balanced, eggCookMs: 1_000 });
    const rawTomato = evaluateTomatoEgg({ ...balanced, tomatoCookMs: 1_000 });
    const burnt = evaluateTomatoEgg({
      ...balanced,
      eggCookMs: HEAT_PROFILES.medium.egg.burnAtMs,
    });
    expect(rawEgg.kind).toBe("raw");
    expect(rawTomato.kind).toBe("raw");
    expect(burnt.kind).toBe("burnt");
    expect(rawEgg.voiceLineId).toBe("outcome-raw-egg");
    expect(rawTomato.voiceLineId).toBe("outcome-raw-tomato");
    expect(burnt.voiceLineId).toBe("outcome-burnt-egg");
    expect(rawEgg.dialogue).not.toBe(rawTomato.dialogue);
    expect(rawEgg.dialogue).not.toBe(burnt.dialogue);
  });

  it("turns salt amount and sugar choice into distinct outcomes", () => {
    const salty = evaluateTomatoEgg({ ...balanced, salt: 2 });
    const bland = evaluateTomatoEgg({ ...balanced, salt: 0 });
    const sweet = evaluateTomatoEgg({ ...balanced, sugar: 2 });
    expect(salty.kind).toBe("salty");
    expect(salty.voiceLineId).toBe("outcome-salty");
    expect(bland.kind).toBe("bland");
    expect(bland.voiceLineId).toBe("outcome-bland");
    expect(sweet.metrics.flavor).toBeLessThan(
      evaluateTomatoEgg(balanced).metrics.flavor,
    );
  });

  it("maps every result branch to a dedicated Xiami voice line", () => {
    expect(evaluateTomatoEgg(balanced).voiceLineId).toBe(
      "outcome-perfect",
    );
    expect(
      evaluateTomatoEgg({
        ...balanced,
        tomatoCookMs: HEAT_PROFILES.medium.tomato.burnAtMs,
      }).voiceLineId,
    ).toBe("outcome-burnt-tomato");
  });

  it("uses independent heat windows for egg and tomato", () => {
    expect(cookingBand("high", 2_500, "egg")).toBe("ready");
    expect(cookingBand("high", 2_500, "tomato")).toBe("raw");
    expect(cookingBand("medium", 5_000, "egg")).toBe("ready");
    expect(cookingBand("medium", 5_000, "tomato")).toBe("ready");
    expect(cookingBand("high", 6_500, "egg")).toBe("burnt");
  });

  it("does not require repeated stirring as a primary mechanic", () => {
    const oneMix = evaluateTomatoEgg({ ...balanced, stirCount: 2 });
    const repeated = evaluateTomatoEgg({ ...balanced, stirCount: 24 });
    expect(oneMix.score).toBeGreaterThan(repeated.score);
  });
});
