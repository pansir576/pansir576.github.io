import { describe, expect, it } from "vitest";
import { XIAMI_TOMATO_EGG_DIALOGUE } from "../src/lib/xiami-dialogue";

describe("Xiami recipe dialogue", () => {
  it("covers all five phases and seven outcomes", () => {
    expect(Object.keys(XIAMI_TOMATO_EGG_DIALOGUE)).toHaveLength(12);
    expect(XIAMI_TOMATO_EGG_DIALOGUE["phase-prep"]).toContain("番茄");
    expect(XIAMI_TOMATO_EGG_DIALOGUE["phase-tomato"]).toContain("出汁");
    expect(XIAMI_TOMATO_EGG_DIALOGUE["outcome-perfect"]).toContain(
      "火候",
    );
  });

  it("keeps every line voiced in character rather than generic UI copy", () => {
    for (const text of Object.values(XIAMI_TOMATO_EGG_DIALOGUE)) {
      expect(text.length).toBeGreaterThan(28);
      expect(text).not.toContain("当前步骤");
      expect(text).not.toContain("点击");
    }
  });
});
